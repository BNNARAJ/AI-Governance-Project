# Refine Implementation to Hybrid Governance Model (Free/Open-Source Stack)

Since access to enterprise Azure services is not available, we will adapt the 4-phase architecture described in `example_approach` to use **free and open-source tools**. This allows us to build the exact same enterprise-grade *logic* and *architecture* (Agentic RAG + Deterministic Math) without incurring costs.

## Architecture Mapping (Enterprise vs. Open-Source)
- **Vector Database**: Azure AI Search ➡️ **ChromaDB** (Local, free, already in codebase)
- **LLM & Embeddings**: Azure OpenAI ➡️ **Google Gemini API** (Free tier, already integrated)
- **Statistical Engine**: IBM Watson OpenScale / Azure ML ➡️ **Fairlearn** (Open-source Python library)
- **Data Export**: Azure SQL ➡️ **Local CSV / Power BI Star Schema Export**

## User Review Required

> [!IMPORTANT]
> Since we are using free tools, the Gemini API is subject to rate limits. We will add robust error handling to ensure the pipeline falls back gracefully if we hit these limits during rule extraction.

## Open Questions

1. **Target Model Data**: To calculate mathematical fairness using Fairlearn (Phase 3), we need actual datasets (or at least synthetic mock data representing `true_labels`, `predictions`, and `sensitive_feature`). Shall I create a mechanism to generate **dummy datasets** on the fly for demonstration purposes, or would you prefer to upload a CSV of test predictions?
2. **Phase 4 Export**: Does exporting the final audit report as a structured CSV file (which you can manually load into Power BI/Excel) satisfy your requirements?

## Proposed Changes

### Phase 1: The RAG Pipeline (Policy Ingestion)
- Retain the current `rag_service.py` that uses ChromaDB and Gemini Embeddings.
- Ensure the PDF chunking strategy remains optimized for regulatory text (already partially implemented).

### Phase 2: The Agentic Extractor
- Modify `gemini_service.py` to add an extraction agent.
- Instead of just generating unstructured "test cases," we will prompt Gemini to query the ChromaDB vector store and extract strict technical thresholds from the policies, outputting **STRICTLY JSON** (e.g., `metric_name`, `sensitive_feature`, and `acceptable_range`).

#### [MODIFY] [gemini_service.py](file:///c:/Users/bnnar/Desktop/work/AI%20Governance%20Project/backend/app/services/gemini_service.py)

### Phase 3: The Statistical Engine (Math/Validation)
- Integrate `fairlearn.metrics` for deterministic fairness calculations (Disparate Impact Ratio, Demographic Parity Difference).
- Construct a new service `fairness_engine.py` that takes target model outputs alongside ground truth data (dummy or uploaded) and calculates fairness mathematically.

#### [NEW] [fairness_engine.py](file:///c:/Users/bnnar/Desktop/work/AI%20Governance%20Project/backend/app/services/fairness_engine.py)
#### [MODIFY] [requirements.txt](file:///c:/Users/bnnar/Desktop/work/AI%20Governance%20Project/backend/requirements.txt) (Add `fairlearn` and `scikit-learn` if needed)

### Phase 4: The Hybrid Validator & Export
- Refactor the orchestration logic in `main.py` (`/run-audit` endpoint).
- Implement the "Hybrid Validator" logic: Compare the JSON thresholds extracted in Phase 2 against the mathematical scores computed by Fairlearn in Phase 3.
- Generate a strict `PASS/FAIL` audit compliance report.
- Export this final state to a structured CSV format designed for Power BI dashboards.

#### [MODIFY] [main.py](file:///c:/Users/bnnar/Desktop/work/AI%20Governance%20Project/backend/app/main.py)
#### [MODIFY] [report_service.py](file:///c:/Users/bnnar/Desktop/work/AI%20Governance%20Project/backend/app/services/report_service.py)

## Verification Plan

### Automated Tests
- Run internal test scripts to verify the structured JSON extraction logic works reliably with the Gemini API.
- Validate that `fairlearn` mathematically calculates Disparate Impact correctly against a dummy dataset.

### Manual Verification
- Upload a dummy regulatory PDF via the UI.
- Run a model audit and verify the pipeline logs execution across the 4 phases.
- Check the `uploads/audit_results` folder for the generated Power BI-ready CSV.
