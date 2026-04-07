"""
PDF Report Generation Service
Generates a professional governance audit report using ReportLab.
"""
import os
from io import BytesIO
from datetime import datetime
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
        "ReportTitle", fontName="Helvetica-Bold", fontSize=22,
        textColor=PRIMARY, spaceAfter=4, alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        "ReportSubtitle", fontName="Helvetica", fontSize=11,
        textColor=TEXT_MUTED, spaceAfter=20, alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        "SectionHeading", fontName="Helvetica-Bold", fontSize=14,
        textColor=PRIMARY, spaceBefore=18, spaceAfter=8
    ))
    styles.add(ParagraphStyle(
        "BodyText", fontName="Helvetica", fontSize=10,
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
        "TestPrompt", fontName="Courier", fontSize=9,
        textColor=HexColor("#1e293b"), leading=12, spaceAfter=4,
        leftIndent=8, borderPadding=4, backColor=HexColor("#f1f5f9")
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
    story.append(Paragraph("🛡️ AI Governance Audit Report", styles["ReportTitle"]))
    story.append(Paragraph(
        f"Generated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')} · "
        f"{summary.get('test_count', 0)} test cases executed",
        styles["ReportSubtitle"]
    ))

    # ─── EXECUTIVE SUMMARY ───
    story.append(Paragraph("Executive Summary", styles["SectionHeading"]))

    exec_data = [
        ["Model Under Audit", summary.get("model_description", "N/A")],
        ["Variance Factors", ", ".join(summary.get("variance_factors", []))],
        ["Test Cases Run", str(summary.get("test_count", 0))],
        ["Policy Violations", f"{violations} violation(s)" if violations else "✓ All policies passed"],
        ["Audit Timestamp", summary.get("timestamp", "N/A")],
    ]
    exec_table = Table(exec_data, colWidths=[140, 340])
    exec_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("TEXTCOLOR", (0, 0), (0, -1), PRIMARY),
        ("TEXTCOLOR", (1, 0), (1, -1), HexColor("#1e293b")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, HexColor("#e2e8f0")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(exec_table)
    story.append(Spacer(1, 16))

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
        colWidths=[120, 120, 120, 120]
    )
    gauge_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(gauge_table)
    story.append(Spacer(1, 8))

    # Score interpretation
    if violations > 0:
        story.append(Paragraph(
            f"⚠️ <font color='#ef4444'><b>{violations} policy violation(s)</b></font> detected. "
            "The model does not meet the configured compliance policy thresholds.",
            styles["BodyText"]
        ))
    else:
        story.append(Paragraph(
            "✅ <font color='#10b981'><b>All policies passed.</b></font> "
            "The model meets the configured compliance policy thresholds.",
            styles["BodyText"]
        ))

    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", color=HexColor("#e2e8f0"), thickness=0.5))
    story.append(Spacer(1, 8))

    # ─── DETAILED RESULTS ───
    story.append(Paragraph("Detailed Test Results", styles["SectionHeading"]))

    for i, result in enumerate(results):
        tc = result.get("test_case", {})
        grade = result.get("audit_grade", {})
        actual = result.get("actual_response", "")

        f_score = grade.get("fairness", "?")
        c_score = grade.get("compliance", "?")
        a_score = grade.get("accuracy", "?")

        # Score colors
        def _color_str(s):
            try:
                return _get_score_color(float(s)).hexval()
            except (ValueError, TypeError):
                return "#64748b"

        test_block = []
        test_block.append(Paragraph(
            f"<b>Test {i + 1}</b> — <font color='#f59e0b'>{tc.get('risk_area', 'General')}</font>",
            styles["SectionHeading"]
        ))

        test_block.append(Paragraph("<b>Prompt Sent:</b>", styles["SmallMuted"]))
        test_block.append(Paragraph(tc.get("prompt", "N/A"), styles["TestPrompt"]))

        test_block.append(Paragraph("<b>Expected Behavior:</b>", styles["SmallMuted"]))
        test_block.append(Paragraph(
            f"<font color='#10b981'>{tc.get('expected_behavior', 'N/A')}</font>",
            styles["BodyText"]
        ))

        test_block.append(Paragraph("<b>Actual Response:</b>", styles["SmallMuted"]))
        test_block.append(Paragraph(str(actual)[:500], styles["BodyText"]))

        # Scores row
        score_data = [[
            Paragraph(f"<font color='{_color_str(f_score)}'><b>Fairness: {f_score}/10</b></font>", styles["ScoreLabel"]),
            Paragraph(f"<font color='{_color_str(c_score)}'><b>Compliance: {c_score}/10</b></font>", styles["ScoreLabel"]),
            Paragraph(f"<font color='{_color_str(a_score)}'><b>Accuracy: {a_score}/10</b></font>", styles["ScoreLabel"]),
        ]]
        score_table = Table(score_data, colWidths=[160, 160, 160])
        score_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#f8fafc")),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        test_block.append(Spacer(1, 4))
        test_block.append(score_table)

        # Reasoning
        reasoning = grade.get("reasoning", "")
        if reasoning:
            test_block.append(Spacer(1, 4))
            test_block.append(Paragraph(f"<i>{str(reasoning)[:300]}</i>", styles["SmallMuted"]))

        test_block.append(Spacer(1, 6))
        test_block.append(HRFlowable(width="100%", color=HexColor("#e2e8f0"), thickness=0.5))
        test_block.append(Spacer(1, 6))

        story.append(KeepTogether(test_block))

    # ─── FOOTER ───
    story.append(Spacer(1, 20))
    story.append(Paragraph(
        "This report was auto-generated by the <b>AI Governance Agent</b>. "
        "Scores are derived from LLM-based evaluation using Google Gemini 1.5 Pro against "
        "the uploaded regulatory corpus. Results should be reviewed by a qualified compliance officer.",
        styles["SmallMuted"]
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer
