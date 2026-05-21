# Plain-language explanations for audit metrics (non-technical readers).

METRIC_GLOSSARY = {
    "true_positive": {
        "short_label": "True Positive (TP)",
        "explanation": "Correctly flagged positive cases.",
    },
    "true_negative": {
        "short_label": "True Negative (TN)",
        "explanation": "Correctly cleared negative cases.",
    },
    "false_positive": {
        "short_label": "False Positive (FP)",
        "explanation": "Incorrect alarm — flagged positive but the actual outcome was negative (false alarm).",
    },
    "false_negative": {
        "short_label": "False Negative (FN)",
        "explanation": "Missed case — predicted negative but the actual outcome was positive (missed).",
    },
    "accuracy": {
        "short_label": "Accuracy",
        "explanation": "Share of all predictions that were correct (both positives and negatives).",
    },
    "precision": {
        "short_label": "Precision",
        "explanation": "When the model says “positive,” how often it is right (fewer false alarms).",
    },
    "recall": {
        "short_label": "Recall (TPR)",
        "explanation": "Of all actual positives, how many the model caught (fewer missed cases).",
    },
    "tpr": {
        "short_label": "True Positive Rate (TPR)",
        "explanation": "Same as recall: fraction of real positives the model correctly identified.",
    },
    "fpr": {
        "short_label": "False Positive Rate (FPR)",
        "explanation": "Of all actual negatives, how many were wrongly flagged as positive (false alarm rate).",
    },
    "f1_score": {
        "short_label": "F1 Score",
        "explanation": "Balance between precision and recall; higher means better overall classification quality.",
    },
    "disparate_impact_ratio": {
        "short_label": "Disparate Impact Ratio (DIR)",
        "explanation": "Compares approval/selection rates across groups; values below 0.80 often signal disparate impact.",
    },
    "demographic_parity_difference": {
        "short_label": "Demographic Parity Difference (DPD)",
        "explanation": "Difference in positive prediction rates between groups; larger absolute values mean more imbalance.",
    },
    "selection_rate_min": {
        "short_label": "Selection Rate (Min)",
        "explanation": "Lowest group-level rate of positive predictions (e.g., lowest approval rate).",
    },
    "selection_rate_max": {
        "short_label": "Selection Rate (Max)",
        "explanation": "Highest group-level rate of positive predictions (e.g., highest approval rate).",
    },
    "confusion_matrix": {
        "short_label": "Confusion Matrix",
        "explanation": "Table of outcomes: [[TN, FP], [FN, TP]] — counts of correct and incorrect predictions.",
    },
    "true_label": {
        "short_label": "True Label",
        "explanation": "Actual outcome from your dataset (ground truth), such as fraud=1 or approved=1.",
    },
    "prediction": {
        "short_label": "Prediction",
        "explanation": "What the uploaded ML model predicted for that row after seeing its features.",
    },
    "sensitive_feature": {
        "short_label": "Sensitive Feature",
        "explanation": "Protected or demographic attribute used for fairness comparison (e.g., gender group).",
    },
}


def get_metric_glossary() -> dict:
    return METRIC_GLOSSARY
