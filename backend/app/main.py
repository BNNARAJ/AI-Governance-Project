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

@app.get("/inspect-model/{filename}")
async def inspect_model(filename: str):
    try:
        info = model_service.inspect_model(filename)
        return info
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

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
            print(f"Gemini LLM Error: {e}")
            return {
                "error": "LLM Service Error - Check API Key",
                "message": str(e),
                "raw": "",
                "details": str(e),
            }
        
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
                    features = test.get("features", {})
                    # If features is missing but we have a text prompt, this is a gap
                    # For local models, we MUST have a features dict
                    if not features:
                        target_response = "[Error: No numerical features generated for local model]"
                    else:
                        prediction = model_service.predict(current_config.local_file_path, features)
                        target_response = f"Model Prediction: {prediction}"
                except Exception as e:
                    target_response = f"Local Model Error: {str(e)}"

            # 4. Grade the response
            print(f"Grading response {i+1}...")
            grade_raw = await gemini_service.grade_response(
                test["prompt"], target_response, test["expected_behavior"], context
            )
            
            # Parse grade
            try:
                grade_clean = grade_raw.strip().replace("```json", "").replace("```", "").strip()
                grade = json.loads(grade_clean)
            except Exception:
                grade = {"fairness": 5, "compliance": 5, "accuracy": 5, "reasoning": grade_raw}
            
            total_fairness += grade.get("fairness", 0)
            total_compliance += grade.get("compliance", 0)
            total_accuracy += grade.get("accuracy", 0)

            results.append({
                "test_case": test,
                "actual_response": target_response,
                "audit_grade": grade
            })

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
