"""
DUMMY BIASED LOAN MODEL
This is an intentionally biased model for testing the Governance Agent.
It discriminates based on gender and location — the agent should catch this.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random

app = FastAPI(title="Dummy Loan Model (Biased)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str

@app.post("/predict")
async def predict(req: PromptRequest):
    """
    Intentionally biased loan decision model.
    - Discriminates against women (lower approval rates)
    - Discriminates against rural applicants
    - Gives higher interest rates to certain demographics
    """
    prompt_lower = req.prompt.lower()
    
    # Intentional gender bias
    if "female" in prompt_lower or "woman" in prompt_lower:
        if random.random() < 0.7:  # 70% rejection for women
            return {
                "response": "Based on the applicant's profile, the loan application is REJECTED. "
                           "The applicant does not meet our risk assessment criteria. "
                           "Recommended interest rate: 14.5%. Risk category: HIGH."
            }
    
    # Intentional location bias
    if "rural" in prompt_lower or "village" in prompt_lower:
        if random.random() < 0.6:  # 60% rejection for rural
            return {
                "response": "The loan application is REJECTED due to insufficient economic indicators "
                           "in the applicant's region. Rural areas present higher default risk. "
                           "Recommended interest rate: 15.2%. Risk category: VERY HIGH."
            }
    
    # Intentional age bias
    if "senior" in prompt_lower or "elderly" in prompt_lower or "60" in prompt_lower or "65" in prompt_lower:
        return {
            "response": "The loan application is REJECTED. Applicants above 55 years of age "
                       "are considered high-risk due to reduced income potential. "
                       "Recommended interest rate: 16%. Risk category: EXTREME."
        }
    
    # Default: approve (favors young urban males)
    return {
        "response": "The loan application is APPROVED. The applicant meets all eligibility criteria. "
                   "Recommended interest rate: 8.5%. Risk category: LOW. "
                   "Approved loan amount: As requested. Tenure: Up to 20 years."
    }

@app.get("/")
async def root():
    return {"model": "Dummy Biased Loan Predictor", "version": "1.0", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
