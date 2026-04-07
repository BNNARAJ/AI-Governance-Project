import os
import chromadb
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from dotenv import load_dotenv

load_dotenv()

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
            self._embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-001")
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
