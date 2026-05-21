# app/services/statistical/fairness.py

import numpy as np
import pandas as pd
from fairlearn.metrics import (
    demographic_parity_difference,
    demographic_parity_ratio
)

# ---------------------------------------------------
# SAFE VALUE
# ---------------------------------------------------

def safe_metric_value(value):
    try:
        numeric_value = float(value)
        if np.isnan(numeric_value) or np.isinf(numeric_value):
            return None
        return round(numeric_value, 4)
    except:
        return None

def fairness_explanation(metric_name, value):
    if value is None:
        return "Fairness metric could not be computed."

    explanations = {
        "dir": f"Disparate Impact Ratio is {value}. Values below 0.80 may indicate bias.",
        "dpd": f"Demographic Parity Difference is {value}. Higher values indicate greater difference between groups."
    }
    return explanations.get(metric_name, "")

# ---------------------------------------------------
# VALIDATE SENSITIVE FEATURE
# ---------------------------------------------------

def validate_sensitive_feature(df, sensitive_column):
    if sensitive_column not in df.columns:
        raise Exception(f"Sensitive column '{sensitive_column}' not found")
    return True

# ---------------------------------------------------
# PREPARE SENSITIVE FEATURE
# ---------------------------------------------------

def prepare_sensitive_feature(df, sensitive_column):
    validate_sensitive_feature(df, sensitive_column)
    sensitive_series = df[sensitive_column]

    # Numeric continuous features
    if pd.api.types.is_numeric_dtype(sensitive_series) and sensitive_series.nunique() > 10:
        try:
            sensitive_series = pd.qcut(sensitive_series, q=4, duplicates="drop")
        except:
            pass

    return sensitive_series.astype(str).fillna("UNKNOWN")

# ---------------------------------------------------
# PREPARE LABELS
# ---------------------------------------------------

def prepare_fairness_labels(y_true, y_pred):
    y_true = pd.Series(y_true).reset_index(drop=True)
    y_pred = pd.Series(y_pred).reset_index(drop=True)
    unique_labels = pd.concat([y_true, y_pred]).dropna().unique()

    # Fairlearn parity metrics require binary outputs
    if len(unique_labels) != 2:
        raise Exception("Fairness metrics require binary classification")

    label_mapping = {
        label: index
        for index, label in enumerate(sorted(unique_labels))
    }
    encoded_y_true = y_true.map(label_mapping)
    encoded_y_pred = y_pred.map(label_mapping)

    return encoded_y_true, encoded_y_pred

# ---------------------------------------------------
# DEMOGRAPHIC PARITY
# ---------------------------------------------------

def calculate_demographic_parity(y_true, y_pred, sensitive_features):
    dpd_val = demographic_parity_difference(
        y_true=y_true,
        y_pred=y_pred,
        sensitive_features=sensitive_features
    )

    dir_val = demographic_parity_ratio(
        y_true=y_true,
        y_pred=y_pred,
        sensitive_features=sensitive_features
    )

    dpd_safe = safe_metric_value(dpd_val)
    dir_safe = safe_metric_value(dir_val)

    return {
        "dpd": {
            "value": dpd_safe,
            "explanation": fairness_explanation("dpd", dpd_safe)
        },
        "dir": {
            "value": dir_safe,
            "explanation": fairness_explanation("dir", dir_safe)
        }
    }

# ---------------------------------------------------
# POLICY EVALUATION
# ---------------------------------------------------

def evaluate_fairness_thresholds(parity_metrics):
    violations = []
    overall_status = "PASSED"

    dpd = parity_metrics.get("dpd", {}).get("value")
    dir_ratio = parity_metrics.get("dir", {}).get("value")

    # DIR Check
    if dir_ratio is not None and dir_ratio < 0.80:
        overall_status = "FAILED"
        violations.append("DIR below 0.80")

    # DPD Check
    if dpd is not None and abs(dpd) > 0.10:
        overall_status = "FAILED"
        violations.append("DPD exceeds 0.10")

    return {
        "overall_fairness_status": overall_status,
        "violations": violations
    }

# ---------------------------------------------------
# DISTRIBUTION
# ---------------------------------------------------

def sensitive_feature_distribution(sensitive_features):
    counts = sensitive_features.value_counts()
    total = counts.sum()
    distribution = {}

    for group, count in counts.items():
        distribution[str(group)] = {
            "count": int(count),
            "percentage": round((count / total) * 100, 2)
        }

    return distribution

# ---------------------------------------------------
# FAIRNESS ANALYSIS
# ---------------------------------------------------

def run_fairness_analysis(df, y_true, y_pred, sensitive_column):
    sensitive_features = prepare_sensitive_feature(df, sensitive_column)
    encoded_y_true, encoded_y_pred = prepare_fairness_labels(y_true, y_pred)

    parity_metrics = calculate_demographic_parity(
        encoded_y_true,
        encoded_y_pred,
        sensitive_features
    )

    policy_evaluation = evaluate_fairness_thresholds(parity_metrics)
    distribution = sensitive_feature_distribution(sensitive_features)

    return {
        "sensitive_feature": sensitive_column,
        "distribution": distribution,
        "demographic_parity": parity_metrics,
        "policy_evaluation": policy_evaluation
    }

# ---------------------------------------------------
# MULTI ANALYSIS
# ---------------------------------------------------

def run_multi_fairness_analysis(df, y_true, y_pred, sensitive_columns):
    results = {}
    for sensitive_column in sensitive_columns:
        try:
            results[sensitive_column] = run_fairness_analysis(
                df=df,
                y_true=y_true,
                y_pred=y_pred,
                sensitive_column=sensitive_column
            )
        except Exception as error:
            results[sensitive_column] = {
                "error": str(error)
            }

    return results
