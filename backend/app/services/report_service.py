"""
PDF Report Generation Service
Generates a professional governance audit report using ReportLab.
"""
import os
from io import BytesIO
from datetime import datetime
import csv
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Circle, String, Line, Rect
from reportlab.graphics import renderPDF


# Color palette matching the frontend dark theme
PRIMARY = HexColor("#6366f1")
PRIMARY_LIGHT = HexColor("#a5b4fc")
ACCENT = HexColor("#10b981")
WARNING = HexColor("#f59e0b")
DANGER = HexColor("#ef4444")
BG_DARK = HexColor("#0a0e1a")
BG_SURFACE = HexColor("#1e293b")
TEXT_WHITE = HexColor("#f1f5f9")
TEXT_MUTED = HexColor("#64748b")
BORDER = HexColor("#334155")


def _get_score_color(score):
    if score >= 7:
        return ACCENT
    elif score >= 4:
        return WARNING
    return DANGER


def _get_score_label(score):
    if score >= 8:
        return "Excellent"
    elif score >= 7:
        return "Good"
    elif score >= 5:
        return "Fair"
    elif score >= 3:
        return "Poor"
    return "Critical"


def _build_styles():
    styles = getSampleStyleSheet()

    styles.add(ParagraphStyle(
        "ReportTitle", fontName="Helvetica-Bold", fontSize=26,
        textColor=PRIMARY, spaceAfter=12, alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        "ReportSubtitle", fontName="Helvetica", fontSize=10,
        textColor=TEXT_MUTED, spaceAfter=2, alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        "HeaderInfo", fontName="Helvetica", fontSize=9,
        textColor=TEXT_MUTED, spaceAfter=16, alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        "SectionHeading", fontName="Helvetica-Bold", fontSize=15,
        textColor=PRIMARY, spaceBefore=14, spaceAfter=10, textTransform='uppercase',
        borderColor=PRIMARY, borderWidth=0, borderPadding=8
    ))
    styles.add(ParagraphStyle(
        "ReportBodyText", fontName="Helvetica", fontSize=10,
        textColor=HexColor("#1e293b"), leading=14, spaceAfter=6,
        alignment=TA_JUSTIFY
    ))
    styles.add(ParagraphStyle(
        "SmallMuted", fontName="Helvetica", fontSize=8.5,
        textColor=TEXT_MUTED, spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        "ScoreLabel", fontName="Helvetica-Bold", fontSize=10,
        textColor=HexColor("#1e293b"), alignment=TA_CENTER
    ))
    styles.add(ParagraphStyle(
        "TestCaseNumber", fontName="Helvetica-Bold", fontSize=11,
        textColor=PRIMARY, spaceAfter=6
    ))
    # Add custom styles for colored text
    styles.add(ParagraphStyle(
        "ErrorText", fontName="Helvetica-Bold", fontSize=10,
        textColor=HexColor("#ef4444"), leading=14, spaceAfter=6,
        alignment=TA_JUSTIFY
    ))
    styles.add(ParagraphStyle(
        "SuccessText", fontName="Helvetica-Bold", fontSize=10,
        textColor=HexColor("#10b981"), leading=14, spaceAfter=6,
        alignment=TA_JUSTIFY
    ))
    styles.add(ParagraphStyle(
        "WarningText", fontName="Helvetica-Bold", fontSize=10,
        textColor=HexColor("#f59e0b"), leading=14, spaceAfter=6,
        alignment=TA_JUSTIFY
    ))
    styles.add(ParagraphStyle(
        "FooterText", fontName="Helvetica", fontSize=8,
        textColor=TEXT_MUTED, spaceAfter=4, alignment=TA_CENTER
    ))
    
    return styles


def _draw_gauge(score, label, x_offset=0):
    """Draw a circular gauge for a score (0-10)."""
    d = Drawing(120, 100)
    cx, cy, r = 60, 55, 35
    color = _get_score_color(score)

    # Background circle
    d.add(Circle(cx, cy, r, strokeColor=HexColor("#e2e8f0"), strokeWidth=6, fillColor=None))

    # Score arc (simplified as colored circle overlay)
    d.add(Circle(cx, cy, r, strokeColor=color, strokeWidth=6, fillColor=None))

    # Score text
    d.add(String(cx, cy - 5, f"{score}", fontSize=20, fontName="Helvetica-Bold",
                 fillColor=color, textAnchor="middle"))

    # /10 text
    d.add(String(cx, cy - 18, "/10", fontSize=9, fontName="Helvetica",
                 fillColor=TEXT_MUTED, textAnchor="middle"))

    # Label
    d.add(String(cx, 8, label, fontSize=9, fontName="Helvetica-Bold",
                 fillColor=HexColor("#1e293b"), textAnchor="middle"))

    # Rating
    d.add(String(cx, -2, _get_score_label(score), fontSize=7.5, fontName="Helvetica",
                 fillColor=color, textAnchor="middle"))

    return d


def generate_audit_report(audit_data: dict) -> BytesIO:
    """
    Generate a PDF report from audit results.
    Returns a BytesIO buffer containing the PDF.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
        title="AI Governance Audit Report"
    )
    styles = _build_styles()
    story = []

    summary = audit_data.get("summary", {})
    results = audit_data.get("results", [])
    violations = audit_data.get("policy_violations", 0)

    # ─── HEADER ───
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph("🛡️ AI GOVERNANCE AUDIT REPORT", styles["ReportTitle"]))
    story.append(Paragraph(
        f"Report Generated: {datetime.now().strftime('%B %d, %Y')} at {datetime.now().strftime('%I:%M %p')}",
        styles["ReportSubtitle"]
    ))
    story.append(Paragraph(
        f"Test Cases Executed: {summary.get('test_count', 0)} · "
        f"Audit ID: {summary.get('timestamp', 'N/A')}",
        styles["HeaderInfo"]
    ))
    story.append(HRFlowable(width="100%", color=PRIMARY_LIGHT, thickness=1))
    story.append(Spacer(1, 0.4*cm))

    # ─── EXECUTIVE SUMMARY ───
    story.append(Paragraph("Executive Summary", styles["SectionHeading"]))

    exec_data = [
        ["Model Under Audit", summary.get("model_description", "N/A")],
        ["Variance Factors", ", ".join(summary.get("variance_factors", [])) or "None"],
        ["Test Cases Run", str(summary.get("test_count", 0))],
        ["Policy Violations", f"{violations} violation(s)" if violations else "✓ All policies passed"],
    ]
    exec_table = Table(exec_data, colWidths=[130, 350])
    exec_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("TEXTCOLOR", (1, 0), (1, -1), HexColor("#1e293b")),
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f0f4ff")),
        ("BACKGROUND", (0, 2), (-1, 2), HexColor("#f8fafc")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 0.5*cm))

    # ─── SCORECARD GAUGES ───
    story.append(Paragraph("Fairness Scorecard", styles["SectionHeading"]))

    avg_f = summary.get("avg_fairness", 0)
    avg_c = summary.get("avg_compliance", 0)
    avg_a = summary.get("avg_accuracy", 0)

    gauge_f = _draw_gauge(avg_f, "Fairness")
    gauge_c = _draw_gauge(avg_c, "Compliance")
    gauge_a = _draw_gauge(avg_a, "Accuracy")

    # Overall score
    overall = round((avg_f + avg_c + avg_a) / 3, 1)
    gauge_overall = _draw_gauge(overall, "Overall")

    gauge_table = Table(
        [[gauge_overall, gauge_f, gauge_c, gauge_a]],
        colWidths=[130, 115, 115, 115]
    )
    gauge_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f8f9ff")),
    ]))
    story.append(gauge_table)
    story.append(Spacer(1, 0.3*cm))

    # Score interpretation
    if violations > 0:
        story.append(Paragraph(
            f"<b>⚠️ COMPLIANCE STATUS: {violations} violation(s) detected</b><br/>"
            f"The model does not meet the configured compliance policy thresholds. "
            f"Immediate action is recommended.",
            styles["ErrorText"]
        ))
    else:
        story.append(Paragraph(
            f"<b>✅ COMPLIANCE STATUS: ALL POLICIES PASSED</b><br/>"
            f"The model meets all configured compliance policy thresholds.",
            styles["SuccessText"]
        ))

    story.append(Spacer(1, 0.5*cm))
    story.append(HRFlowable(width="100%", color=PRIMARY_LIGHT, thickness=1))
    story.append(Spacer(1, 0.5*cm))

    # ─── DETAILED RESULTS ───
    if results:
        story.append(Paragraph("Detailed Test Results", styles["SectionHeading"]))
        story.append(Spacer(1, 0.2*cm))

        for i, result in enumerate(results):
            tc = result.get("test_case", {})
            grade = result.get("audit_grade", {})
            actual = result.get("actual_response", "")
            
            test_block = []

            f_score = grade.get("fairness", "?")
            c_score = grade.get("compliance", "?")
            a_score = grade.get("accuracy", "?")

            # Score colors - use appropriate styles
            def _get_score_style(s):
                try:
                    score = float(s)
                    if score >= 7:
                        return styles["SuccessText"]
                    elif score >= 4:
                        return styles["WarningText"]
                    else:
                        return styles["ErrorText"]
                except (ValueError, TypeError):
                    return styles["ScoreLabel"]

            # Test case header
            test_num = i + 1
            test_block.append(Paragraph(f"Test Case #{test_num}", styles["TestCaseNumber"]))
            test_block.append(Spacer(1, 3))

            # Scores row
            score_data = [[
                Paragraph(f"<b>Fairness</b><br/>{f_score}/10", _get_score_style(f_score)),
                Paragraph(f"<b>Compliance</b><br/>{c_score}/10", _get_score_style(c_score)),
                Paragraph(f"<b>Accuracy</b><br/>{a_score}/10", _get_score_style(a_score)),
            ]]
            score_table = Table(score_data, colWidths=[155, 155, 155])
            score_table.setStyle(TableStyle([
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f0f4ff")),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#c7d2e8")),
            ]))
            test_block.append(score_table)
            test_block.append(Spacer(1, 6))

            # Reasoning
            reasoning = grade.get("reasoning", "")
            if reasoning:
                test_block.append(Paragraph(
                    f"<b>Evaluation Reasoning:</b><br/><i>{str(reasoning)[:400]}</i>",
                    styles["SmallMuted"]
                ))
                test_block.append(Spacer(1, 8))

            # Separator
            test_block.append(HRFlowable(width="100%", color=HexColor("#dce5f5"), thickness=0.5))
            test_block.append(Spacer(1, 8))

            story.append(KeepTogether(test_block))
            
            # Add page break after every 5 test cases for better readability
            if (i + 1) % 5 == 0 and (i + 1) < len(results):
                story.append(PageBreak())
                story.append(Spacer(1, 0.5*cm))

    # ─── FOOTER ───
    story.append(Spacer(1, 0.8*cm))
    story.append(HRFlowable(width="100%", color=PRIMARY_LIGHT, thickness=1))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(
        "<b>Report Disclaimer</b><br/>"
        "This report was auto-generated by the AI Governance Agent. Scores are derived from "
        "LLM-based evaluation using Google Gemini 1.5 Pro against the uploaded regulatory corpus. "
        "Results should be reviewed and validated by a qualified compliance officer before "
        "making production decisions.",
        styles["FooterText"]
    ))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')}",
        styles["FooterText"]
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer


def export_hybrid_audit_csv(audit_data: dict, output_path: str) -> str:
    """
    Export a Power BI-ready flattened CSV for hybrid governance output.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    summary = audit_data.get("summary", {})
    hybrid = audit_data.get("hybrid_validation", {})
    rules = hybrid.get("rule_results", []) or []
    metrics = hybrid.get("fairness_metrics", {}) or {}

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "audit_timestamp",
                "model_description",
                "overall_status",
                "rule_metric_name",
                "rule_sensitive_feature",
                "rule_operator",
                "threshold_min",
                "threshold_max",
                "actual_value",
                "rule_status",
                "source_excerpt",
                "confidence",
                "disparate_impact_ratio",
                "demographic_parity_difference",
                "selection_rate_min",
                "selection_rate_max",
                "row_count",
            ],
        )
        writer.writeheader()
        if not rules:
            rules = [{}]
        for r in rules:
            writer.writerow(
                {
                    "audit_timestamp": summary.get("timestamp"),
                    "model_description": summary.get("model_description"),
                    "overall_status": hybrid.get("overall_status"),
                    "rule_metric_name": r.get("metric_name"),
                    "rule_sensitive_feature": r.get("sensitive_feature"),
                    "rule_operator": r.get("operator"),
                    "threshold_min": r.get("threshold_min"),
                    "threshold_max": r.get("threshold_max"),
                    "actual_value": r.get("actual_value"),
                    "rule_status": r.get("status"),
                    "source_excerpt": r.get("source_excerpt"),
                    "confidence": r.get("confidence"),
                    "disparate_impact_ratio": metrics.get("disparate_impact_ratio"),
                    "demographic_parity_difference": metrics.get("demographic_parity_difference"),
                    "selection_rate_min": metrics.get("selection_rate_min"),
                    "selection_rate_max": metrics.get("selection_rate_max"),
                    "row_count": metrics.get("row_count"),
                }
            )
    return output_path
