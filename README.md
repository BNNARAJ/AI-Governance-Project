# 🛡️ AI Governance Agent

A **generalized AI governance platform** that audits any AI model for bias, fairness, and regulatory compliance — across any industry domain (Finance, Agriculture, Healthcare, etc.).

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1 — INPUT LAYER (Frontend Dashboard)                     │
│  Upload regulations (PDF) · Define variance factors · Connect   │
│  your model via API endpoint or file upload                     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2 — RAG LAYER (ChromaDB + Gemini Embeddings)             │
│  Chunks uploaded PDFs · Stores as vectors · Builds compliance   │
│  knowledge base for contextual retrieval                        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3 — TEST GENERATION (Gemini 1.5 Pro)                     │
│  Generates synthetic adversarial test cases targeting the       │
│  user-defined variance factors (e.g., Gender, Crop Type)        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4 — MODEL TESTING                                        │
│  Sends test cases to the target model · Captures responses      │
│  for evaluation against the compliance knowledge base           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5 — OUTPUT LAYER (Scorecard & Reports)                   │
│  Grades each response on Fairness, Compliance, Accuracy (0-10)  │
│  Generates detailed audit reports with actionable insights      │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

#### Option A: One-Click Run (Windows)
Double-click `run_app.bat` in the root folder. It will start the backend and open the dashboard in your browser.

#### Option B: Manual Setup
### Prerequisites
- **Python 3.11+**
- **Google AI Studio API Key** ([Get one here](https://aistudio.google.com/apikey))

### 1. Clone & Setup

```bash
# Navigate to the project
cd "AI Governance Project"

# Create virtual environment (skip if already done)
python -m venv backend\venv

# Activate virtual environment
.\backend\venv\Scripts\Activate.ps1    # Windows PowerShell
# source backend/venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r backend\requirements.txt
```

### 2. Configure API Key

Edit `backend/.env` and replace with your key:
```
GOOGLE_API_KEY=your_actual_gemini_api_key
```

### 3. Launch the Backend

The backend is a FastAPI application that handles RAG indexing and LLM orchestration.

```bash
# Navigate to backend directory
cd backend

# Run the backend
.\venv\Scripts\python.exe -m app.main
```

The API will be live at **http://localhost:8000**. You can verify at http://localhost:8000/docs (Swagger UI).

### 4. Open the Frontend

The frontend is a premium glassmorphism dashboard built with Vanilla HTML/JS. You can open it directly or serve it via a local web server (recommended).

**Option A: Local Server (Recommended)**
```bash
# In a new terminal
cd frontend
python -m http.server 3000
```
Then visit **http://localhost:3000** in your browser.

**Option B: Direct File Open**
- Simply open `frontend/index.html` in your web browser.
- Ensure the **"API Online"** status pill in the top right is green.
- **Login Credentials:**
    - `admin` / `admin123` (Full access)
    - `compliance` / `compliance123`
    - `developer` / `developer123`

## 📋 Usage

1. **Upload Regulations** — Drag & drop any PDF (RBI guidelines, agricultural standards, healthcare protocols, etc.)
2. **Configure Audit** — Describe the model, add variance factors (custom or preset), and connect your model's API endpoint
3. **Run Audit** — The agent generates adversarial test cases, tests your model, and grades each response
4. **View Results** — Get a Fairness Scorecard with scores on Fairness, Compliance, and Accuracy

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS (Glassmorphism), Vanilla JS |
| Backend | Python, FastAPI |
| LLM | Google Gemini 1.5 Flash |
| Vector DB | ChromaDB |
| RAG | LangChain + Gemini Embeddings |
| PDF Parsing | PyPDF |

## 📁 Project Structure

```
AI Governance Project/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI routes & orchestration
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── gemini_service.py # LLM logic (test gen + grading)
│   │       └── rag_service.py    # PDF indexing & vector search
│   ├── .env                     # API key (not committed)
│   ├── requirements.txt
│   └── venv/                    # Python virtual environment
├── frontend/
│   ├── index.html               # Dashboard UI
│   ├── style.css                # Premium dark theme
│   └── script.js                # Frontend logic
├── data/                        # ChromaDB persistence
├── uploads/                     # Uploaded regulation PDFs
└── README.md
```

## 👥 User Roles

| Role | Capabilities |
|---|---|
| **Compliance Officer** | Upload regulations, define variance factors, review audit reports |
| **AI Developer** | Connect model API, view Fairness Scorecard, debug biased behavior |
| **Admin** | Manage access, set compliance policies, monitor system-wide fairness |

## 🛠️ Troubleshooting

- **API Offline:** Ensure the backend is running on port 8000. Check if any other process is using that port.
- **Gemini Errors:** Verify your `GOOGLE_API_KEY` in `backend/.env`. Ensure you have quotas for `gemini-1.5-flash`.
- **CORS Issues:** If the frontend cannot talk to the backend, ensure you are accessing the frontend via `file://` or a local server, and the backend has CORS enabled (it is by default in `main.py`).

## 📄 License

This project is for educational and research purposes.
