import os
import re
import requests
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from dotenv import load_dotenv

load_dotenv()

class GeminiEmbeddings:
    def __init__(self, model_name: str | None = None, validate_model: bool = True):
        self.api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("Missing GEMINI_API_KEY/GOOGLE_API_KEY for embeddings.")

        self.api_base = os.getenv(
            "GEMINI_API_BASE",
            "https://generativelanguage.googleapis.com/v1beta",
        )
        default_model = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
        self.model_name = self._normalize_model_name(model_name or default_model)

        self.embed_url = f"{self.api_base}/{self.model_name}:embedContent?key={self.api_key}"
        self.batch_url = f"{self.api_base}/{self.model_name}:batchEmbedContents?key={self.api_key}"

        self.task_type_query = "RETRIEVAL_QUERY"
        self.task_type_document = "RETRIEVAL_DOCUMENT"

        if validate_model:
            self._ensure_model_supported()

    def _normalize_model_name(self, model_name: str) -> str:
        return model_name if model_name.startswith("models/") else f"models/{model_name}"

    def _ensure_model_supported(self) -> None:
        try:
            response = requests.get(f"{self.api_base}/models?key={self.api_key}", timeout=20)
            if response.status_code != 200:
                return
            models = response.json().get("models", [])
            match = next((m for m in models if m.get("name") == self.model_name), None)
            if match is None:
                embed_models = [
                    m.get("name")
                    for m in models
                    if "embedContent" in (m.get("supportedActions") or [])
                ]
                hint = (
                    f" Available embedContent models: {', '.join(embed_models[:10])}."
                    if embed_models
                    else ""
                )
                raise ValueError(
                    f"Embedding model {self.model_name} not found via models.list."
                    f"{hint} Set GEMINI_EMBEDDING_MODEL to a valid model."
                )
            actions = match.get("supportedActions") or []
            if "embedContent" not in actions:
                raise ValueError(
                    f"Model {self.model_name} does not support embedContent. "
                    f"supportedActions={actions}"
                )
        except Exception:
            # Do not block startup if model validation fails unexpectedly.
            return

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed(text, task_type=self.task_type_document) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._embed(text, task_type=self.task_type_query)

    def _embed(self, text: str, task_type: str) -> list[float]:
        try:
            data = {
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
            }
            response = requests.post(self.embed_url, json=data, timeout=30)
            if response.status_code == 200:
                return response.json()["embedding"]["values"]
            if response.status_code == 404:
                raise Exception(
                    "REST Embedding Failed: 404 NOT_FOUND. "
                    f"Model {self.model_name} is not available for embedContent. "
                    "Check models.list and set GEMINI_EMBEDDING_MODEL accordingly."
                )
            raise Exception(f"REST Embedding Failed: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"REST Embedding Error: {e}")
            raise e

class RAGService:
    def __init__(self):
        self.persist_directory = "data/chroma_db"
        os.makedirs(self.persist_directory, exist_ok=True)
        self._embeddings = None
        # Tuned for policy/regulation documents where section continuity matters.
        self.chunk_size = 1300
        self.chunk_overlap = 260
        self.min_chunk_size = 250

    def _get_embeddings(self):
        if self._embeddings is None:
            self._embeddings = GeminiEmbeddings()
        return self._embeddings

    def _normalize_text(self, text: str) -> str:
        if not text:
            return ""
        # Merge hyphenated line-break words: regula-\ntion -> regulation
        text = re.sub(r"(\w)-\s*\n\s*(\w)", r"\1\2", text)
        text = text.replace("\r", "\n")
        # Normalize whitespace while preserving paragraph boundaries.
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def _is_heading(self, paragraph: str) -> bool:
        if not paragraph:
            return False
        p = " ".join(paragraph.split()).strip()
        if not p:
            return False
        if len(p) > 120:
            return False

        # Numeric/legal title patterns: "1.", "2.1", "Section 4", "Article 3", etc.
        heading_patterns = [
            r"^(section|article|chapter|part|rule|schedule|annex)\s+[a-z0-9ivx]+[\s\-\.:)]",
            r"^\d+(\.\d+){0,3}[\)\.\-:]\s+[a-z]",
            r"^\([a-z0-9ivx]+\)\s+[a-z]",
        ]
        lower = p.lower()
        if any(re.match(pattern, lower) for pattern in heading_patterns):
            return True

        # ALL CAPS headings are common in regulatory PDFs.
        words = p.split()
        if 2 <= len(words) <= 12 and p.upper() == p and re.search(r"[A-Z]", p):
            return True
        return False

    def _split_paragraphs(self, page_text: str) -> list[str]:
        blocks = [b.strip() for b in re.split(r"\n\s*\n", page_text) if b.strip()]
        return blocks

    def _section_aware_units(self, page_text: str) -> list[dict]:
        units = []
        current_heading = ""
        for block in self._split_paragraphs(page_text):
            if self._is_heading(block):
                current_heading = " ".join(block.split())
                continue
            units.append(
                {
                    "heading": current_heading,
                    "text": " ".join(block.split()),
                }
            )

        # Fallback for unstructured scans/OCR-ish text.
        if not units and page_text.strip():
            units.append({"heading": "", "text": " ".join(page_text.split())})
        return units

    def _tail_overlap(self, text: str, max_chars: int) -> str:
        if not text:
            return ""
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        if not sentences:
            return text[-max_chars:]

        picked = []
        total = 0
        for sentence in reversed(sentences):
            if total and total + len(sentence) + 1 > max_chars:
                break
            picked.append(sentence)
            total += len(sentence) + 1
            if total >= max_chars:
                break
        return " ".join(reversed(picked)).strip()

    def _chunks_from_page(self, page_text: str, metadata: dict) -> list[Document]:
        units = self._section_aware_units(page_text)
        if not units:
            return []

        raw_chunks: list[dict] = []
        current_parts: list[str] = []
        current_size = 0
        current_heading = ""

        for unit in units:
            heading = unit["heading"]
            unit_text = unit["text"]
            if heading:
                unit_text = f"{heading}\n{unit_text}"

            add_size = len(unit_text) + (2 if current_parts else 0)
            if current_parts and current_size + add_size > self.chunk_size:
                raw_chunks.append(
                    {
                        "text": "\n\n".join(current_parts).strip(),
                        "heading": current_heading or heading,
                    }
                )
                current_parts = []
                current_size = 0
                current_heading = ""

            if not current_heading and heading:
                current_heading = heading
            current_parts.append(unit_text)
            current_size += len(unit_text) + (2 if len(current_parts) > 1 else 0)

        if current_parts:
            raw_chunks.append(
                {
                    "text": "\n\n".join(current_parts).strip(),
                    "heading": current_heading,
                }
            )

        documents: list[Document] = []
        for idx, chunk in enumerate(raw_chunks):
            chunk_text = chunk["text"]
            if len(chunk_text) < self.min_chunk_size and documents:
                # Attach tiny tail chunks to previous one to avoid low-signal fragments.
                prev = documents[-1]
                merged = f"{prev.page_content}\n\n{chunk_text}".strip()
                documents[-1] = Document(page_content=merged, metadata=prev.metadata)
                continue

            if idx > 0:
                overlap = self._tail_overlap(raw_chunks[idx - 1]["text"], self.chunk_overlap)
                if overlap:
                    chunk_text = f"[Context]\n{overlap}\n\n{chunk_text}"

            chunk_meta = dict(metadata)
            chunk_meta.update(
                {
                    "chunk_index": idx,
                    "section_heading": chunk.get("heading", ""),
                }
            )
            documents.append(Document(page_content=chunk_text, metadata=chunk_meta))

        return documents

    def index_pdf(self, file_path: str) -> int:
        loader = PyPDFLoader(file_path)
        pages = loader.load()
        chunks: list[Document] = []

        for page_number, page in enumerate(pages, start=1):
            normalized = self._normalize_text(page.page_content)
            if not normalized:
                continue
            metadata = dict(page.metadata or {})
            metadata.update(
                {
                    "source_file": os.path.basename(file_path),
                    "page_number": page_number,
                }
            )
            chunks.extend(self._chunks_from_page(normalized, metadata))

        if not chunks:
            return 0

        vector_store = Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self._get_embeddings(),
            collection_name="regulations",
        )
        vector_store.add_documents(chunks)
        if hasattr(vector_store, "persist"):
            vector_store.persist()
        return len(chunks)

    def query_regulations(self, query: str, n_results: int = 3) -> str:
        vector_store = Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self._get_embeddings(),
            collection_name="regulations"
        )
        results = vector_store.similarity_search(query, k=n_results)
        if not results:
            return "No regulations indexed yet. Please upload PDF documents first."

        formatted = []
        for r in results:
            md = r.metadata or {}
            source = md.get("source_file", "unknown")
            page = md.get("page_number", "?")
            heading = md.get("section_heading", "")
            prefix = f"[{source} | p.{page}]"
            if heading:
                prefix = f"{prefix} {heading}"
            formatted.append(f"{prefix}\n{r.page_content}")
        return "\n\n---\n\n".join(formatted)

rag_service = RAGService()
