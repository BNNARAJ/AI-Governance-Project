# AI Governance Agent

Lightweight, enterprise-style AI governance platform for auditing AI systems on fairness, compliance, and performance quality.

The platform supports both:
- Behavioral governance for LLMs (adversarial test generation + policy-grounded grading)
- Deterministic governance for ML models (Fairlearn metrics + threshold-based validation)

## What Is Implemented

1. Hybrid governance architecture (RAG + LLM + deterministic math)
2. Dual audit engine routing by model type
3. ML ingestion assurance levels (MLflow-first, then fallback levels)
4. Strict policy threshold extraction (JSON contract)
5. Hybrid validator with PASS/FAIL rollup
6. Power BI-ready CSV export

## Execution Flow (Step-Wise)

### Phase 1: Policy Ingestion and Retrieval (RAG)
- Upload regulation PDFs.
- PDFs are chunked with structure-aware logic and indexed in ChromaDB.
- Context is retrieved during audit runs.

### Phase 2: Rule and Scenario Layer
- Policy thresholds are extracted into strict JSON rules.
- For LLM/behavioral audits, adversarial scenarios are generated per variance factor.
- If Gemini is rate-limited/unavailable, deterministic fallbacks are used.

### Phase 3: Deterministic Fairness Engine
- Computes fairness metrics using Fairlearn:
  - `disparate_impact_ratio`
  - `demographic_parity_difference`
- Supports:
  - Dummy dataset mode (fast demo and fallback)
  - Uploaded fairness CSV mode (`true_label`, `prediction`, `sensitive_feature`)

### Phase 4: Hybrid Validator and Export
- Compares extracted policy rules against deterministic metrics.
- Produces rule-level statuses and overall PASS/FAIL.
- Exports flattened CSV for Power BI and stores audit JSON for persistence.

## Dual Engine Routing

`AuditConfig.model_type` controls execution:
- `llm`: runs behavioral phase only
- `ml`: runs deterministic phase only
- `unknown`: runs both and merges output
- `auto` (default): inferred from connection mode

## ML Ingestion Levels and Assurance

The backend classifies ML readiness to avoid false confidence:

1. `level_1_mlflow_bundle`
- Full MLflow bundle import (recommended production path)
- Assurance: `full`

2. `level_2_model_preprocessor_schema`
- Model + preprocessor + feature schema/profile
- Assurance: `strong`

3. `level_2_model_schema_only`
- Model + schema, no preprocessor parity
- Assurance: `limited`

4. `level_3_api_contract`
- Feature-based API contract (schema-driven)
- Assurance: `limited`

When ingestion is incomplete, audit is marked limited-assurance and does not hard-fail solely for missing artifacts.

## Intelligent RAG Chunking

`backend/app/services/rag_service.py` uses structure-aware chunking:
- Section-aware splitting
- Heading detection for legal sections
- Paragraph-preserving chunk assembly
- Sentence-overlap carry-forward
- Text normalization for PDF artifacts
- Metadata-rich chunks (`source_file`, `page_number`, `section_heading`, `chunk_index`)

If you upgraded from old chunking:
1. Stop backend
2. Delete `data/chroma_db`
3. Restart backend
4. Re-upload regulations

## Quick Start

### Option A: One-click run (Windows)
- Double-click `run_app.bat`

### Option B: Manual setup

Prerequisites:
- Python 3.11+
- Google AI Studio key (for Gemini phases)

```bash
cd "AI Governance Project"
python -m venv backend\venv
.\backend\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
```

Create `backend/.env`:

```env
GOOGLE_API_KEY=your_actual_gemini_api_key
```

Run backend:

```bash
cd backend
.\venv\Scripts\python.exe -m app.main
```

Backend docs:
- `http://localhost:8000/docs`

Run frontend:

```bash
cd frontend
python -m http.server 3000
```

Frontend URL:
- `http://localhost:3000`

## Core API Endpoints

### Governance inputs
- `POST /upload-regulations`
- `POST /configure-audit`
- `POST /run-audit`

### ML artifact management
- `POST /upload-model`
- `POST /upload-mlflow-model`
- `POST /upload-preprocessor/{filename}`
- `POST /upload-feature-schema/{filename}`
- `GET /inspect-model/{filename}`
- `GET /model-profile/{filename}`
- `POST /model-profile/{filename}`

### Deterministic fairness dataset
- `POST /upload-fairness-data`

### Outputs
- `POST /generate-report`
- `GET /audit-history`

## AuditConfig Fields (Important)

`/configure-audit` accepts:
- `model_description: str`
- `variance_factors: list[str]`
- `n_test_cases: int`
- `model_type: "auto" | "llm" | "ml" | "unknown"`
- `connection_type: "api" | "upload"`
- `api_mode: "prompt" | "features"`
- `api_url: str | null`
- `api_key: str | null`
- `local_file_path: str | null`
- `custom_feature_names: list[str] | null`
- `fairness_data_mode: "dummy" | "upload"`
- `fairness_data_file: str | null`

## Example Configure Payloads

### LLM behavioral audit
```json
{
  "model_description": "Customer support assistant",
  "variance_factors": ["gender", "age", "location"],
  "n_test_cases": 8,
  "model_type": "llm",
  "connection_type": "api",
  "api_mode": "prompt",
  "api_url": "http://localhost:9000/chat",
  "api_key": null,
  "fairness_data_mode": "dummy"
}
```

### ML deterministic audit (uploaded model)
```json
{
  "model_description": "Loan approval model",
  "variance_factors": ["gender", "age"],
  "n_test_cases": 6,
  "model_type": "ml",
  "connection_type": "upload",
  "local_file_path": "loan_model_mlflow_20260507_101010.pkl",
  "fairness_data_mode": "upload",
  "fairness_data_file": "C:/.../uploads/fairness_data/loan_predictions.csv"
}
```

## Outputs Returned by `/run-audit`

- `summary`: top-level run stats and resolved execution mode
- `results`: scenario-level behavioral records (if behavioral phase executed)
- `hybrid_validation`:
  - `overall_status`
  - `fairness_metrics`
  - `rule_results`
- `execution_plan`:
  - `model_type`
  - phase execution flags
  - rule source (`llm_extraction`, `cache`, or fallback)
  - ML readiness and assurance details
- `csv_export_path`: exported governance CSV path

## Tech Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JS |
| Backend | Python, FastAPI |
| LLM | Google Gemini |
| Vector DB | ChromaDB |
| Embeddings | Gemini Embeddings API |
| Deterministic Fairness | Fairlearn |
| PDF Loader | LangChain PyPDFLoader |
| Reporting | ReportLab |

## Project Structure

```text
AI Governance Project/
|-- backend/
|   |-- app/
|   |   |-- main.py
|   |   `-- services/
|   |       |-- fairness_engine.py
|   |       |-- gemini_service.py
|   |       |-- model_service.py
|   |       |-- rag_service.py
|   |       `-- report_service.py
|   |-- requirements.txt
|   `-- .env
|-- frontend/
|-- data/
|-- uploads/
`-- README.md
```

## Default Login Users

- `admin` / `admin123`
- `compliance` / `compliance123`
- `developer` / `developer123`

## Troubleshooting

- Backend unavailable: verify backend is running on `8000`.
- Gemini failures: verify `GOOGLE_API_KEY` and quota.
- Empty retrieval: reset `data/chroma_db` and re-upload regulations.
- Deterministic CSV rejected: ensure required columns are exactly:
  - `true_label`
  - `prediction`
  - `sensitive_feature`

## License

For educational and research use.
