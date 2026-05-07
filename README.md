# AI Governance Agent

A generalized AI governance platform to audit AI models for fairness, compliance, and accuracy across domains like finance, agriculture, and healthcare.

## Architecture

1. Input Layer
- Upload regulation PDFs.
- Configure variance factors.
- Connect model via API or local model upload.

2. RAG Layer
- Indexes regulation PDFs into ChromaDB.
- Uses Gemini embeddings for retrieval.
- Supplies compliance context to audit generation and grading.

3. Test Generation Layer
- Generates synthetic audit scenarios for configured variance factors.
- Supports deterministic fallback when LLM rate limits occur.

4. Model Testing Layer
- Executes test scenarios against API models or uploaded local models.

5. Output Layer
- Produces fairness/compliance/accuracy scores.
- Generates downloadable audit reports.

## Intelligent RAG Chunking (New)

`backend/app/services/rag_service.py` now uses structure-aware chunking inspired by the CodeSight approach, adapted for regulation PDFs.

- Section-aware chunk boundaries instead of naive fixed-size-only splitting.
- Heading detection for legal style sections (`Section`, `Article`, numbered clauses, uppercase headings).
- Paragraph-preserving chunk assembly to reduce meaning breaks.
- Sentence-level overlap carry-forward between neighboring chunks.
- Text normalization for PDF artifacts (line-break hyphenation and whitespace cleanup).
- Rich chunk metadata: `source_file`, `page_number`, `section_heading`, `chunk_index`.
- Retrieval output includes source/page/section context for traceability.

Recommended migration after this update:

1. Stop backend.
2. Delete old vector store at `data/chroma_db`.
3. Restart backend.
4. Re-upload regulation PDFs so they are re-indexed with the new chunking strategy.

## Quick Start

### Option A: One-click run (Windows)

Double-click `run_app.bat` from the project root.

### Option B: Manual setup

Prerequisites:
- Python 3.11+
- Google AI Studio API key

Setup:

```bash
cd "AI Governance Project"
python -m venv backend\venv
.\backend\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Configure API key in `backend/.env`:

```env
GOOGLE_API_KEY=your_actual_gemini_api_key
```

Run backend:

```bash
cd backend
.\venv\Scripts\python.exe -m app.main
```

Backend docs: `http://localhost:8000/docs`

Run frontend:

```bash
cd frontend
python -m http.server 3000
```

Frontend URL: `http://localhost:3000`

## Usage

1. Upload one or more regulation PDFs.
2. Configure audit details and variance factors.
3. Set test case count and run audit.
4. Review scenario-level grades and report.

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Python, FastAPI |
| LLM | Gemini (generation + grading) |
| Embeddings | Gemini Embeddings API |
| Vector DB | ChromaDB |
| PDF Loader | LangChain PyPDFLoader |

## Project Structure

```text
AI Governance Project/
|-- backend/
|   |-- app/
|   |   |-- main.py
|   |   `-- services/
|   |       |-- gemini_service.py
|   |       |-- model_service.py
|   |       `-- rag_service.py
|   |-- requirements.txt
|   `-- .env
|-- frontend/
|   |-- index.html
|   |-- script.js
|   `-- style.css
|-- data/
|-- uploads/
`-- README.md
```

## Default Login Users

- `admin` / `admin123`
- `compliance` / `compliance123`
- `developer` / `developer123`

## Troubleshooting

- API offline: ensure backend is running on port 8000.
- Gemini errors: verify `GOOGLE_API_KEY` and API quota.
- Empty/poor retrieval: clear `data/chroma_db` and re-upload regulations.

## License

For educational and research use.
