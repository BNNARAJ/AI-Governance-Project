import requests

API = "http://localhost:8000"
config = {
    "model_description": "Loan model",
    "variance_factors": ["Gender"],
    "connection_type": "upload",
    "local_file_path": "model.pkl",
    "custom_feature_names": [
        "Loan_ID", "Gender", "Married", "Dependents", "Education", "Self_Employed", 
        "ApplicantIncome", "CoapplicantIncome", "LoanAmount", "Loan_Amount_Term", 
        "Credit_History", "Property_Area"
    ]
}

requests.post(f"{API}/configure-audit", json=config)
res = requests.post(f"{API}/run-audit")
print(f"Status: {res.status_code}")
try:
    data = res.json()
    if "error" in data:
        print(f"Error: {data['error']}\nMessage: {data.get('message')}\nTrace: {data.get('traceback')}")
    else:
        print("Success!")
except:
    print(res.text)
