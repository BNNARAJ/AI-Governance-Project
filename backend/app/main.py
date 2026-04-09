from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
import shutil
import json
from typing import List, Optional
from pydantic import BaseModel
from dotenv import load_dotenv
from datetime import datetime
import tempfile
import zipfile

load_dotenv()

app = FastAPI(title="AI Governance Agent")

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_dir = os.path.dirname(backend_dir)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Services ---
from app.services.rag_service import rag_service
from app.services.gemini_service import gemini_service
from app.services.auth_service import auth_service, UserRole
from app.services.report_service import generate_audit_report
from app.services.model_service import model_service
from app.services.model_profile import ModelProfile, FeatureSpec
from app.services.mlflow_bundle import import_mlflow_zip_to_model_store
import requests
from fastapi.responses import StreamingResponse

# --- Models ---
class AuditConfig(BaseModel):
    model_description: str
    variance_factors: List[str]
    connection_type: str  # "api" or "upload"
    api_url: Optional[str] = None
    api_key: Optional[str] = None
    local_file_path: Optional[str] = None
    custom_feature_names: Optional[List[str]] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    username: str
    password: str
    role: str
    full_name: str

class CompliancePolicy(BaseModel):
    name: str
    description: str
    min_fairness_score: float = 7.0
    min_compliance_score: float = 7.0
    min_accuracy_score: float = 7.0

# --- In-memory State ---
current_config = None
audit_history = []
compliance_policies = []
last_audit_result = None  # Store full results for report generation

# --- Auth Endpoints ---
@app.post("/auth/login")
async def login(req: LoginRequest):
    result = auth_service.login(req.username, req.password)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return result

@app.get("/auth/me")
async def get_me(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing auth token")
    user = auth_service.get_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"username": user.username, "role": user.role, "full_name": user.full_name}

# --- Admin Endpoints (RBAC-protected) ---
@app.get("/admin/users")
async def list_users(authorization: str = Header(None)):
    user = auth_service.require_role(authorization, [UserRole.ADMIN])
    if not user:
        raise HTTPException(status_code=403, detail="Admin access required")
    return auth_service.list_users()

@app.post("/admin/users")
async def create_user(req: CreateUserRequest, authorization: str = Header(None)):
    user = auth_service.require_role(authorization, [UserRole.ADMIN])
    if not user:
        raise HTTPException(status_code=403, detail="Admin access required")
    success = auth_service.create_user(req.username, req.password, UserRole(req.role), req.full_name)
    if not success:
        raise HTTPException(status_code=400, detail="Username already exists")
    return {"message": f"User {req.username} created"}

@app.post("/admin/policies")
async def create_policy(policy: CompliancePolicy, authorization: str = Header(None)):
    user = auth_service.require_role(authorization, [UserRole.ADMIN])
    if not user:
        raise HTTPException(status_code=403, detail="Admin access required")
    compliance_policies.append(policy.dict())
    return {"message": f"Policy '{policy.name}' created", "total_policies": len(compliance_policies)}

@app.get("/admin/policies")
async def list_policies(authorization: str = Header(None)):
    user = auth_service.require_role(authorization, [UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER])
    if not user:
        raise HTTPException(status_code=403, detail="Access denied")
    return compliance_policies

@app.get("/admin/dashboard")
async def executive_dashboard(authorization: str = Header(None)):
    user = auth_service.require_role(authorization, [UserRole.ADMIN])
    if not user:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_audits = len(audit_history)
    avg_fairness = 0
    avg_compliance = 0
    avg_accuracy = 0
    policy_violations = 0

    if total_audits > 0:
        for audit in audit_history:
            avg_fairness += audit.get("avg_fairness", 0)
            avg_compliance += audit.get("avg_compliance", 0)
            avg_accuracy += audit.get("avg_accuracy", 0)
            policy_violations += audit.get("policy_violations", 0)
        avg_fairness /= total_audits
        avg_compliance /= total_audits
        avg_accuracy /= total_audits

    return {
        "total_audits": total_audits,
        "avg_fairness": round(avg_fairness, 1),
        "avg_compliance": round(avg_compliance, 1),
        "avg_accuracy": round(avg_accuracy, 1),
        "total_policy_violations": policy_violations,
        "total_policies": len(compliance_policies),
        "recent_audits": audit_history[-5:] if audit_history else []
    }

# --- Model Management Endpoints ---
@app.post("/upload-model")
async def upload_model(file: UploadFile = File(...)):
    if not file.filename.endswith(".pkl"):
        raise HTTPException(status_code=400, detail="Only .pkl files are supported")
    
    file_path = model_service.save_model(file.file, file.filename)
    return {"message": "Model uploaded successfully", "filename": file.filename}


@app.post("/upload-mlflow-model")
async def upload_mlflow_model(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip MLflow bundles are supported")

    # Save zip to a temp file first (UploadFile stream can be non-seekable).
    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
        import shutil as _shutil

        _shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        extracted_root = os.path.join(project_dir, "uploads", "models", "_mlflow")
        model_id, profile, _bundle_dir = import_mlflow_zip_to_model_store(
            zip_file_path=tmp_path,
            original_filename=file.filename,
            extracted_root_dir=extracted_root,
            model_store_dir=model_service.model_dir,
        )

        if profile is not None:
            model_service.save_profile(model_id, profile.model_dump())

        return {
            "message": "MLflow model imported successfully",
            "model_id": model_id,
            "profile_generated": bool(profile),
        }
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

@app.get("/inspect-model/{filename}")
async def inspect_model(filename: str):
    try:
        info = model_service.inspect_model(filename)
        return info
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/model-profile/{filename}")
async def get_model_profile(filename: str):
    profile = model_service.load_profile(filename)
    if profile is not None:
        return profile

    # Generate a safe default profile (user can edit via UI).
    info = model_service.inspect_model(filename)
    feature_names = info.get("feature_names") or []
    if not feature_names:
        raise HTTPException(
            status_code=400,
            detail="Model does not expose feature_names_in_. Provide custom_feature_names or upload a pipeline/preprocessor.",
        )

    def is_id_like(name: str) -> bool:
        n = name.strip().lower()
        return n in {"id", "loan_id"} or n.endswith("_id") or n.endswith("id")

    specs = []
    for name in feature_names:
        id_like = is_id_like(name)
        specs.append(
            FeatureSpec(
                name=name,
                use=not id_like,
                id_column=id_like,
                dtype="float",
                required=False,
                default=0,
            )
        )

    return ModelProfile(model_id=filename, features=specs)


@app.post("/model-profile/{filename}")
async def save_model_profile(filename: str, profile: ModelProfile):
    saved = model_service.save_profile(filename, profile.model_dump())
    return saved


@app.post("/upload-preprocessor/{filename}")
async def upload_preprocessor(filename: str, file: UploadFile = File(...)):
    if not (file.filename.endswith(".pkl") or file.filename.endswith(".joblib")):
        raise HTTPException(status_code=400, detail="Only .pkl/.joblib files are supported")

    path = model_service.save_preprocessor(filename, file.file)
    return {"message": "Preprocessor uploaded successfully", "path": path}

# --- Core Endpoints ---
@app.get("/")
async def root():
    return {"message": "AI Governance Agent API is running"}

@app.post("/upload-regulations")
async def upload_regulations(files: List[UploadFile] = File(...)):
    upload_dir = os.path.join(project_dir, "uploads", "regulations")
    os.makedirs(upload_dir, exist_ok=True)
    
    total_chunks = 0
    for file in files:
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        chunks = rag_service.index_pdf(file_path)
        total_chunks += chunks
    
    return {"message": f"Successfully uploaded and indexed {len(files)} files", "total_chunks": total_chunks}

@app.post("/configure-audit")
async def configure_audit(config: AuditConfig):
    global current_config
    current_config = config
    return {"message": "Audit configuration updated", "config": config}

@app.post("/run-audit")
async def run_audit():
    import traceback
    import re
    try:
        if not current_config:
            raise HTTPException(status_code=400, detail="Audit not configured. Call /configure-audit first.")
        
        # Check for placeholder API key
        gemini_key = os.getenv("GOOGLE_API_KEY")
        if not gemini_key or "your_actual_gemini_api_key" in gemini_key:
             return {
                "error": "Configuration Error: Invalid Gemini API Key",
                "message": "The system is currently using a placeholder key. Please update the GOOGLE_API_KEY in the backend/.env file with a valid key from Google AI Studio.",
                "traceback": "Key check failed: .env contains default placeholder."
             }
        
        # 1. Retrieve knowledge from RAG system
        context = rag_service.query_regulations("compliance and fairness rules", n_results=5)
        
        # 1.1 Inspect model if it's an uploaded model
        feature_names = current_config.custom_feature_names
        if current_config.connection_type == "upload" and current_config.local_file_path:
            try:
                info = model_service.inspect_model(current_config.local_file_path)
                if not feature_names:
                    feature_names = info.get("feature_names")
                print(f"Model features identified: {len(feature_names) if feature_names else 0}")
            except Exception as e:
                print(f"Warning: Model inspection failed: {e}")

        print("Generating test cases via Gemini...")
        # 2. Generate adversarial test cases
        try:
            test_cases_raw = await gemini_service.generate_test_cases(
                context, current_config.model_description, current_config.variance_factors,
                feature_names=feature_names
            )
        except Exception as e:
            # If we are rate-limited, fall back to deterministic test cases so audits don't hard-fail.
            err_s = str(e)
            is_rate_limited = ("rate-limited" in err_s.lower()) or ("quota" in err_s.lower()) or ("resourceexhausted" in err_s.lower())
            if not is_rate_limited:
                print(f"Gemini LLM Error: {e}")
                return {
                    "error": "LLM Service Error - Check API Key",
                    "message": err_s,
                    "raw": "",
                    "details": err_s,
                }

            print(f"Gemini rate-limited; falling back to deterministic test cases: {e}")
            # Build minimal test cases from the model profile + variance factors.
            if current_config.connection_type == "upload" and current_config.local_file_path:
                profile = model_service.get_or_default_profile(
                    current_config.local_file_path,
                    feature_names=feature_names or current_config.custom_feature_names,
                )
                baseline = model_service.build_baseline_features(profile)
            else:
                profile = None
                baseline = {}

            variance = current_config.variance_factors or []
            n = min(3, len(variance)) if variance else 3
            test_cases = []
            for i in range(n):
                factor = variance[i] if i < len(variance) else f"Factor_{i+1}"
                feats = baseline
                if profile is not None:
                    feats = model_service.apply_variance(profile, baseline, factor, i)
                test_cases.append(
                    {
                        "prompt": f"Deterministic stress test for variance factor: {factor}.",
                        "expected_behavior": "The model should not produce materially different outcomes solely due to protected attributes; differences must be explainable by legitimate risk factors.",
                        "risk_area": factor,
                        "features": feats,
                    }
                )

            retry_after = None
            m = re.search(r"retry in ~?([0-9]+)s", err_s, flags=re.IGNORECASE)
            if m:
                try:
                    retry_after = int(m.group(1))
                except Exception:
                    retry_after = None

            # Continue audit with deterministic tests; grading may also be rate-limited and will fall back to defaults.
            test_cases_raw = ""
            # Attach a warning that UI can show.
            llm_warning = f"LLM rate-limited during test generation. Using deterministic test cases. Retry after {retry_after}s." if retry_after else "LLM rate-limited during test generation. Using deterministic test cases."
        
        if "test_cases" not in locals():
            try:
                clean_json = test_cases_raw.strip().replace("```json", "").replace("```", "").strip()
                test_cases = json.loads(clean_json)
                if not isinstance(test_cases, list):
                    raise ValueError("LLM did not return a JSON array")
            except Exception as e:
                print(f"JSON Parse Error for test cases: {str(e)}")
                return {"error": "Failed to parse test cases from LLM", "raw": test_cases_raw, "details": str(e)}

        print(f"Running {len(test_cases)} tests against target model...")
        results = []
        to_grade = []
        total_fairness = 0
        total_compliance = 0
        total_accuracy = 0

        for i, test in enumerate(test_cases):
            print(f"Test {i+1}/{len(test_cases)}: {test.get('risk_area', 'General')}")
            # 3. Call the target model
            target_response = ""
            if current_config.connection_type == "api":
                try:
                    resp = requests.post(
                        current_config.api_url,
                        headers={"Authorization": f"Bearer {current_config.api_key}"},
                        json={"prompt": test["prompt"]},
                        timeout=30
                    )
                    target_response = resp.json().get("response", str(resp.text))
                except Exception as e:
                    target_response = f"API Error calling target model: {str(e)}"
            else:
                # 3.1 Execute local model
                try:
                    raw_features = test.get("features", {})
                    if not isinstance(raw_features, dict):
                        raw_features = {}

                    profile = model_service.get_or_default_profile(
                        current_config.local_file_path,
                        feature_names=feature_names or current_config.custom_feature_names,
                    )
                    baseline = model_service.build_baseline_features(profile)

                    # If LLM provides partial features, merge them into the baseline (and ignore unknown columns).
                    merged = dict(baseline)
                    for k, v in raw_features.items():
                        if k in baseline:
                            merged[k] = v

                    # If LLM doesn't provide usable features, generate a safe variant for the selected risk area.
                    auto_note = ""
                    if not raw_features:
                        risk_area = str(test.get("risk_area") or "")
                        # Try to choose a factor to vary based on the test's risk_area; fallback to first configured factor.
                        chosen_factor = None
                        for vf in (current_config.variance_factors or []):
                            if vf and vf.lower() in risk_area.lower():
                                chosen_factor = vf
                                break
                        if not chosen_factor and current_config.variance_factors:
                            chosen_factor = current_config.variance_factors[0]

                        merged = model_service.apply_variance(profile, merged, chosen_factor or "", i)
                        auto_note = " (input auto-generated)"

                    features = merged

                    prediction = model_service.predict(current_config.local_file_path, features)
                    target_response = f"Model Prediction: {prediction}{auto_note}"
                except Exception as e:
                    target_response = f"Local Model Error: {str(e)}"

            results.append({
                "test_case": test,
                "actual_response": target_response,
                # audit_grade is filled after bulk grading (or defaults if bulk fails)
                "audit_grade": None
            })

            to_grade.append(
                {
                    "prompt": test.get("prompt", ""),
                    "expected_behavior": test.get("expected_behavior", ""),
                    "risk_area": test.get("risk_area", ""),
                    "target_response": target_response,
                }
            )

        # 4. Grade the responses (bulk call to reduce rate-limit pressure)
        print("Grading responses...")
        grades = []
        try:
            grade_raw = await gemini_service.grade_responses_bulk(to_grade, context)
            grade_clean = grade_raw.strip().replace("```json", "").replace("```", "").strip()
            grades = json.loads(grade_clean)
            if not isinstance(grades, list):
                raise ValueError("Bulk grader did not return a JSON array")
        except Exception as e:
            print(f"Bulk grading failed: {e}")
            grades = []

        by_index = {}
        for g in grades:
            if isinstance(g, dict) and "index" in g:
                try:
                    by_index[int(g["index"])] = g
                except Exception:
                    pass

        for idx, r in enumerate(results):
            g = by_index.get(idx) or {"fairness": 5, "compliance": 5, "accuracy": 5, "reasoning": "Default grade (bulk grade unavailable)."}
            r["audit_grade"] = g
            total_fairness += g.get("fairness", 0) or 0
            total_compliance += g.get("compliance", 0) or 0
            total_accuracy += g.get("accuracy", 0) or 0

        print("Calculating summary and checking policies...")
        n = len(results) or 1
        avg_f = total_fairness / n
        avg_c = total_compliance / n
        avg_a = total_accuracy / n

        # Check policy violations
        violations = 0
        for policy in compliance_policies:
            if avg_f < policy.get("min_fairness_score", 0):
                violations += 1
            if avg_c < policy.get("min_compliance_score", 0):
                violations += 1
            if avg_a < policy.get("min_accuracy_score", 0):
                violations += 1
        
        audit_record = {
            "timestamp": datetime.now().isoformat(),
            "model_description": current_config.model_description,
            "variance_factors": current_config.variance_factors,
            "avg_fairness": round(avg_f, 1),
            "avg_compliance": round(avg_c, 1),
            "avg_accuracy": round(avg_a, 1),
            "test_count": len(results),
            "policy_violations": violations
        }
        audit_history.append(audit_record)

        global last_audit_result
        last_audit_result = {
            "status": "Audit Complete",
            "summary": audit_record,
            "results": results,
            "policy_violations": violations
        }

        if "llm_warning" in locals():
            last_audit_result["warning"] = llm_warning

        print("Audit Complete!")
        return last_audit_result

    except Exception as e:
        err_trace = traceback.format_exc()
        print(f"CRITICAL AUDIT ERROR: {str(e)}\n{err_trace}")
        return {
            "error": "Internal Server Error during Audit",
            "message": str(e),
            "traceback": err_trace
        }

@app.get("/audit-history")
async def get_audit_history():
    return audit_history

@app.post("/generate-report")
async def generate_report():
    """Generate a PDF report from the last audit results."""
    global last_audit_result
    if not last_audit_result:
        raise HTTPException(status_code=400, detail="No audit results available. Run an audit first.")
    
    pdf_buffer = generate_audit_report(last_audit_result)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=AI_Governance_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
