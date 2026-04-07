"""Run the complete Compliance Officer user story via API."""
import requests
import json
import sys

API = "http://localhost:8000"

# Step 1: Upload the RBI regulation PDF
print("=" * 60)
print("STEP 1: Uploading RBI Fair Lending Guidelines PDF...")
print("=" * 60)
pdf_path = r"c:\Users\bnnar\Desktop\AI Governance Project\uploads\RBI_Fair_Lending_Guidelines_2025.pdf"
with open(pdf_path, "rb") as f:
    resp = requests.post(
        f"{API}/upload-regulations",
        files=[("files", ("RBI_Fair_Lending_Guidelines_2025.pdf", f, "application/pdf"))],
        timeout=60
    )

print(f"Status: {resp.status_code}")
try:
    upload_res = resp.json()
    print(f"Response: {json.dumps(upload_res, indent=2)}")
except Exception:
    print(f"Failed to decode upload response: {resp.text}")
    sys.exit(1)
print()
sys.stdout.flush()

# Step 2: Configure the audit  
print("=" * 60)
print("STEP 2: Configuring audit against dummy biased loan model...")
print("=" * 60)
config = {
    "model_description": "Loan eligibility prediction model for Indian banks. Determines loan approval/rejection, interest rates, and risk categories for applicants across demographics.",
    "variance_factors": ["Gender", "Age", "Location", "Income"],
    "connection_type": "api",
    "api_url": "http://localhost:8001/predict",
    "api_key": ""
}
resp = requests.post(f"{API}/configure-audit", json=config, timeout=10)
print(f"Status: {resp.status_code}")
try:
    print(f"Response: {json.dumps(resp.json(), indent=2)}")
except Exception:
    print(f"Failed to decode config response: {resp.text}")
print()
sys.stdout.flush()

# Step 3: Run the audit
print("=" * 60)
print("STEP 3: Running Governance Audit...")
print("This calls Gemini to generate test cases, tests the dummy model,")
print("and grades each response. Please wait (retry logic active)...")
print("=" * 60)
sys.stdout.flush()

try:
    resp = requests.post(f"{API}/run-audit", timeout=600)
    print(f"Status: {resp.status_code}")
    data = resp.json()
except Exception as e:
    print(f"Error during audit call: {str(e)}")
    if 'resp' in locals():
        print(f"Server returned: {resp.text}")
    sys.exit(1)

if "error" in data:
    err = data.get("error", "Unknown")
    raw = data.get("raw", "")[:1000]
    print(f"ERROR: {err}")
    print(f"Raw Details: {raw}")
    sys.exit(1)

summary = data.get("summary", {})
print()
print("=" * 60)
print("FAIRNESS SCORECARD")
print("=" * 60)
desc = summary.get("model_description", "N/A")[:60]
print(f"Model: {desc}...")
factors = ", ".join(summary.get("variance_factors", []))
print(f"Factors: {factors}")
print(f"Tests Run: {summary.get('test_count', 0)}")
print(f"Timestamp: {summary.get('timestamp', 'N/A')}")
print("---")
print(f"Fairness Score:   {summary.get('avg_fairness', 'N/A')}/10")
print(f"Compliance Score: {summary.get('avg_compliance', 'N/A')}/10")
print(f"Accuracy Score:   {summary.get('avg_accuracy', 'N/A')}/10")
violations = data.get("policy_violations", 0)
print(f"Policy Violations: {violations}")
print()
sys.stdout.flush()

for i, r in enumerate(data.get("results", [])):
    g = r.get("audit_grade", {})
    tc = r.get("test_case", {})
    risk = tc.get("risk_area", "General")
    print(f"--- Test {i+1} [{risk}] ---")
    print(f"  Prompt:    {tc.get('prompt', '')[:100]}...")
    print(f"  Response:  {r.get('actual_response', '')[:100]}...")
    print(f"  Scores:    F={g.get('fairness')} C={g.get('compliance')} A={g.get('accuracy')}")
    print(f"  Reasoning: {g.get('reasoning', '')[:150]}...")
    print()
    sys.stdout.flush()

# Step 4: Generate PDF report
print("=" * 60)
print("STEP 4: Generating PDF Report...")
print("=" * 60)
resp = requests.post(f"{API}/generate-report", timeout=30)
if resp.status_code == 200:
    report_path = r"c:\Users\bnnar\Desktop\AI Governance Project\uploads\Governance_Audit_Report.pdf"
    with open(report_path, "wb") as f:
        f.write(resp.content)
    print(f"PDF saved to: {report_path}")
    print(f"Size: {len(resp.content)} bytes")
else:
    print(f"Report generation failed: {resp.status_code}")

print()
print("COMPLIANCE OFFICER USER STORY COMPLETE!")
