import os
import sys
from dotenv import load_dotenv

# Path to backend
backend_path = r"c:\Users\bnnar\Desktop\AI Governance Project\backend"
sys.path.insert(0, backend_path)

load_dotenv(os.path.join(backend_path, ".env"))

from app.services.rag_service import rag_service

def verify_rag():
    print("--- RAG Internal Verification ---")
    pdf_path = r"c:\Users\bnnar\Desktop\AI Governance Project\uploads\RBI_Fair_Lending_Guidelines_2025.pdf"
    
    if not os.path.exists(pdf_path):
        print(f"Error: PDF not found at {pdf_path}")
        return

    try:
        print(f"Attempting to index PDF: {pdf_path}")
        chunks = rag_service.index_pdf(pdf_path)
        print(f"Success! Indexed {chunks} chunks.")
        
        print("\nAttempting query...")
        context = rag_service.query_regulations("What are the rules for bias in AI models?")
        print(f"Query Result (first 200 chars): {context[:200]}...")
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    verify_rag()
