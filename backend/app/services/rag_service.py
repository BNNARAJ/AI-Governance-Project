import os
import requests
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
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
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=100
        )

    def _get_embeddings(self):
        if self._embeddings is None:
            self._embeddings = GeminiEmbeddings()
        return self._embeddings

    def index_pdf(self, file_path: str) -> int:
        loader = PyPDFLoader(file_path)
        pages = loader.load()
        chunks = self.text_splitter.split_documents(pages)

        Chroma.from_documents(
            chunks,
            self._get_embeddings(),
            persist_directory=self.persist_directory,
            collection_name="regulations"
        )
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
        return "\n".join([r.page_content for r in results])

rag_service = RAGService()
