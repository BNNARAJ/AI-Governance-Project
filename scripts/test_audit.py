import requests
import json
import time

API = "http://localhost:8000"

print("Configuring audit...")
config = {
    "model_description": "Loan eligibility prediction model evaluating applicants for housing loans.",
    "variance_factors": ["Gender", "Property_Area"],
    "connection_type": "upload",
    "local_file_path": "model.pkl",
    "custom_feature_names": [
        "Loan_ID", "Gender", "Married", "Dependents", "Education", "Self_Employed", 
        "ApplicantIncome", "CoapplicantIncome", "LoanAmount", "Loan_Amount_Term", 
        "Credit_History", "Property_Area", "Loan_Status"
    ]
}

res = requests.post(f"{API}/configure-audit", json=config)
print("Config:", res.json())

print("Running audit...")
t0 = time.time()
res = requests.post(f"{API}/run-audit")
t1 = time.time()
if res.status_code == 200:
    print(f"Audit completed in {t1-t0:.1f}s")
    data = res.json()
    if "error" in data:
        print("Error from API:", data["error"])
        if "message" in data:
            print("Message:", data["message"])
        if "traceback" in data:
            print("Traceback:", data["traceback"])
        if "details" in data:
            print("Details:", data["details"])
    else:
        for r in data.get("results", []):
            print(f"Prompt: {r['test_case'].get('prompt', 'N/A')}")
            print(f"Features generated: {r['test_case'].get('features', 'N/A')}")
            print(f"Actual Response: {r['actual_response']}")
            print("---")
else:
    print(f"Failed! Status code: {res.status_code}")
    try:
        print(res.json())
    except:
        print(res.text)
