"""Generate a sample RBI Fair Lending Guidelines PDF for testing."""
import sys
sys.path.insert(0, r"c:\Users\bnnar\Desktop\AI Governance Project\backend\venv\Lib\site-packages")

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

doc = SimpleDocTemplate(
    r"c:\Users\bnnar\Desktop\AI Governance Project\uploads\RBI_Fair_Lending_Guidelines_2025.pdf",
    pagesize=A4,
    topMargin=2*cm, bottomMargin=2*cm,
    leftMargin=2.5*cm, rightMargin=2.5*cm,
    title="RBI Fair Lending Guidelines 2025"
)

styles = getSampleStyleSheet()
styles.add(ParagraphStyle("DocTitle", fontName="Helvetica-Bold", fontSize=18,
    textColor=HexColor("#1a365d"), spaceAfter=8, alignment=TA_CENTER))
styles.add(ParagraphStyle("DocSub", fontName="Helvetica", fontSize=11,
    textColor=HexColor("#4a5568"), spaceAfter=20, alignment=TA_CENTER))
styles.add(ParagraphStyle("Section", fontName="Helvetica-Bold", fontSize=13,
    textColor=HexColor("#2d3748"), spaceBefore=16, spaceAfter=8))
styles.add(ParagraphStyle("Body", fontName="Helvetica", fontSize=10.5,
    leading=14, spaceAfter=8, alignment=TA_JUSTIFY))
styles.add(ParagraphStyle("Clause", fontName="Helvetica", fontSize=10,
    leading=13, spaceAfter=6, leftIndent=18, alignment=TA_JUSTIFY))

story = []

story.append(Paragraph("RESERVE BANK OF INDIA", styles["DocTitle"]))
story.append(Paragraph("Master Direction on Fair Lending Practices<br/>RBI/2025-26/FL/001 | Effective: April 1, 2025", styles["DocSub"]))
story.append(HRFlowable(width="100%", color=HexColor("#2d3748"), thickness=1))
story.append(Spacer(1, 12))

# Chapter 1
story.append(Paragraph("Chapter 1: Scope and Applicability", styles["Section"]))
story.append(Paragraph(
    "1.1 These directions apply to all Scheduled Commercial Banks, Non-Banking Financial Companies (NBFCs), "
    "Housing Finance Companies, and any entity regulated by the RBI that deploys Artificial Intelligence (AI) "
    "or Machine Learning (ML) models for credit decisions, loan eligibility assessments, interest rate determination, "
    "or customer risk categorization.", styles["Body"]))
story.append(Paragraph(
    "1.2 The objective of this Master Direction is to ensure that AI/ML-based lending systems operate in a manner "
    "that is fair, transparent, non-discriminatory, and compliant with the principles enshrined in the Constitution "
    "of India, the Banking Regulation Act 1949, and the Reserve Bank of India Act 1934.", styles["Body"]))

# Chapter 2
story.append(Paragraph("Chapter 2: Non-Discrimination and Fairness Requirements", styles["Section"]))
story.append(Paragraph(
    "2.1 Prohibited Discrimination Variables: No AI/ML model used for lending decisions shall discriminate "
    "against applicants based on:", styles["Body"]))
story.append(Paragraph("(a) Gender, sex, or gender identity;", styles["Clause"]))
story.append(Paragraph("(b) Religion, caste, or ethnic origin;", styles["Clause"]))
story.append(Paragraph("(c) Age, except where age is a bona fide factor in loan tenure calculations;", styles["Clause"]))
story.append(Paragraph("(d) Geographic location, including urban vs. rural classification;", styles["Clause"]))
story.append(Paragraph("(e) Marital status or family composition;", styles["Clause"]))
story.append(Paragraph("(f) Disability status.", styles["Clause"]))
story.append(Paragraph(
    "2.2 Equal Treatment Mandate: Two applicants with substantially similar financial profiles (income, credit score, "
    "debt-to-income ratio, employment stability) MUST receive substantially similar loan terms — including approval/rejection "
    "decisions, interest rates, loan amounts, and tenure offered — regardless of the prohibited variables listed in 2.1.", styles["Body"]))
story.append(Paragraph(
    "2.3 Interest Rate Fairness: The difference in interest rates offered to applicants from different demographic groups, "
    "after controlling for financial risk factors, shall not exceed 50 basis points (0.5%). Any systematic deviation "
    "beyond this threshold shall be treated as prima facie evidence of discriminatory pricing.", styles["Body"]))
story.append(Paragraph(
    "2.4 Rejection Rate Parity: The rejection rate disparity between any two demographic groups, after controlling for "
    "creditworthiness indicators, shall not exceed 10 percentage points. Regulated entities must monitor and report "
    "these metrics quarterly.", styles["Body"]))

# Chapter 3
story.append(Paragraph("Chapter 3: Transparency and Explainability", styles["Section"]))
story.append(Paragraph(
    "3.1 Right to Explanation: Every applicant whose loan is rejected or offered unfavorable terms by an AI/ML system "
    "has the right to receive a clear, human-readable explanation of the factors that influenced the decision.", styles["Body"]))
story.append(Paragraph(
    "3.2 The explanation must NOT reference any prohibited variable (listed in Section 2.1) as a factor in the decision. "
    "If the model internally uses proxy variables that correlate with prohibited variables, the regulated entity must "
    "demonstrate that adequate bias mitigation measures are in place.", styles["Body"]))
story.append(Paragraph(
    "3.3 Model Documentation: Regulated entities shall maintain comprehensive documentation of all AI/ML models used "
    "in lending, including training data composition, feature selection rationale, validation methodology, and bias "
    "audit results.", styles["Body"]))

# Chapter 4
story.append(Paragraph("Chapter 4: Periodic Auditing Requirements", styles["Section"]))
story.append(Paragraph(
    "4.1 Mandatory AI Audit: Every regulated entity using AI/ML in lending decisions shall conduct a comprehensive "
    "bias and fairness audit at least once every quarter (every 3 months).", styles["Body"]))
story.append(Paragraph(
    "4.2 The audit shall include: (a) testing with synthetic adversarial inputs across all protected categories; "
    "(b) measurement of Equalized Odds, Demographic Parity, and Calibration metrics; (c) analysis of model drift "
    "from baseline fairness benchmarks.", styles["Body"]))
story.append(Paragraph(
    "4.3 Audit Results Reporting: Audit results must be submitted to the RBI's Department of Supervision within 30 days "
    "of audit completion. Results showing fairness scores below 7/10 on any protected category shall trigger a mandatory "
    "remediation plan.", styles["Body"]))
story.append(Paragraph(
    "4.4 Non-Compliance Penalties: Regulated entities found to be operating discriminatory AI/ML lending systems shall be "
    "subject to: (a) monetary penalties up to ₹5 crore per violation; (b) mandatory suspension of the AI/ML system; "
    "(c) public disclosure of the violation.", styles["Body"]))

# Chapter 5
story.append(Paragraph("Chapter 5: Rural and Agricultural Lending", styles["Section"]))
story.append(Paragraph(
    "5.1 Priority Sector Compliance: AI/ML models used for agricultural and rural lending must ensure that farmers, "
    "rural entrepreneurs, and self-help groups receive equitable access to credit.", styles["Body"]))
story.append(Paragraph(
    "5.2 Rural applicants shall NOT be assigned higher risk scores solely based on their geographic classification. "
    "Risk models must use individual financial indicators rather than area-level statistics.", styles["Body"]))
story.append(Paragraph(
    "5.3 Crop Type Neutrality: Loan decisions for agricultural purposes shall not discriminate based on the type of crop "
    "cultivated. Farmers growing subsistence crops shall receive the same eligibility treatment as those growing "
    "commercial crops, given similar financial standing.", styles["Body"]))

# Footer
story.append(Spacer(1, 30))
story.append(HRFlowable(width="100%", color=HexColor("#2d3748"), thickness=0.5))
story.append(Paragraph(
    "<i>Issued under the authority of the Reserve Bank of India. This is a sample document for educational purposes.</i>",
    ParagraphStyle("Footer", fontName="Helvetica-Oblique", fontSize=8, textColor=HexColor("#a0aec0"), alignment=TA_CENTER)
))

import os
os.makedirs(r"c:\Users\bnnar\Desktop\AI Governance Project\uploads", exist_ok=True)
doc.build(story)
print("✅ PDF generated: uploads/RBI_Fair_Lending_Guidelines_2025.pdf")
