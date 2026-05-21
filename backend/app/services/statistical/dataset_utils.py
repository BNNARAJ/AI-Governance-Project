# app/services/statistical/dataset_utils.py

import json
import os
from typing import Iterable, Optional

import numpy as np
import pandas as pd

TARGET_COLUMN_CANDIDATES = [
    "approved",
    "fraud",
    "target",
    "label",
    "class",
    "outcome",
    "loan_status",
    "default",
    "is_fraud",
    "y",
]

SENSITIVE_KEYWORDS = [
    "gender",
    "sex",
    "age",
    "race",
    "religion",
    "ethnicity",
    "marital",
    "disability",
    "region",
    "nationality",
]


def load_schema_feature_names(model_path: str) -> list[str]:
    """Read MLflow-style schema.json inputs when present."""
    if not model_path or not os.path.isdir(model_path):
        return []

    schema_path = os.path.join(model_path, "schema.json")
    if not os.path.exists(schema_path):
        return []

    try:
        with open(schema_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle) or {}
        inputs = payload.get("inputs", [])
        if isinstance(inputs, list):
            return [
                str(item.get("name"))
                for item in inputs
                if isinstance(item, dict) and item.get("name")
            ]
    except Exception:
        return []

    return []


def load_sample_input_columns(model_path: str) -> list[str]:
    """Use sample_input.csv headers as a feature-name fallback."""
    if not model_path or not os.path.isdir(model_path):
        return []

    sample_path = os.path.join(model_path, "sample_input.csv")
    if not os.path.exists(sample_path):
        return []

    try:
        sample_df = pd.read_csv(sample_path, nrows=5)
        return [str(col) for col in sample_df.columns]
    except Exception:
        return []


def resolve_model_feature_names(
    model,
    metadata: dict | None,
    model_path: str,
    inspection: dict | None = None,
) -> list[str]:
    """Best-effort feature list for models without feature_names_in_."""
    inspection = inspection or {}
    feature_names = list(inspection.get("feature_names") or [])

    if feature_names:
        return feature_names

    if hasattr(model, "feature_names_in_"):
        return list(model.feature_names_in_)

    schema_features = load_schema_feature_names(model_path)
    if schema_features:
        return schema_features

    sample_columns = load_sample_input_columns(model_path)
    if sample_columns:
        return sample_columns

    n_features = getattr(model, "n_features_in_", None)
    if n_features:
        return [f"feature_{i}" for i in range(int(n_features))]

    return []


def infer_target_column(
    df: pd.DataFrame,
    feature_names: Iterable[str],
    explicit: Optional[str] = None,
) -> str:
    """Pick a target/label column from the dataset."""
    columns = list(df.columns)

    if explicit:
        explicit_lower = explicit.lower()
        for col in columns:
            if col.lower() == explicit_lower:
                return col
        if explicit in columns:
            return explicit

    feature_set = {name.lower() for name in feature_names}

    for candidate in TARGET_COLUMN_CANDIDATES:
        for col in columns:
            if col.lower() == candidate and col.lower() not in feature_set:
                return col

    for col in columns:
        lower = col.lower()
        if lower in feature_set:
            continue
        if any(keyword in lower for keyword in ("target", "label", "outcome", "fraud", "approved")):
            return col

    non_feature = [col for col in columns if col.lower() not in feature_set]
    if len(non_feature) == 1:
        return non_feature[0]

    raise ValueError(
        "Could not infer target column. Include a column such as "
        "'approved', 'fraud', or 'target' in the uploaded CSV."
    )


def resolve_sensitive_column(
    df: pd.DataFrame,
    hints: Iterable[str] | None = None,
    inspection_candidates: Iterable[str] | None = None,
) -> str:
    """Map UI variance factors to an actual dataset column."""
    columns = list(df.columns)
    lower_map = {col.lower(): col for col in columns}

    search_terms: list[str] = []
    for hint in hints or []:
        if hint:
            search_terms.append(str(hint).strip().lower())
    for candidate in inspection_candidates or []:
        if candidate:
            search_terms.append(str(candidate).strip().lower())

    gender_one_hot = [
        col for col in columns
        if col.lower().startswith("gender_")
    ]
    wants_gender = any(
        "gender" in term or "sex" in term
        for term in search_terms
    )
    if wants_gender and len(gender_one_hot) >= 2:
        return "gender"

    for term in search_terms:
        if term in lower_map:
            return lower_map[term]
        for col in columns:
            if term in col.lower():
                return col

    for col in columns:
        lower = col.lower()
        if any(keyword in lower for keyword in SENSITIVE_KEYWORDS):
            return col

    if gender_one_hot:
        return gender_one_hot[0]

    raise ValueError(
        "Could not resolve sensitive feature column. "
        "Add a column such as 'Gender' or include it in variance factors."
    )


def ensure_sensitive_column(
    df: pd.DataFrame,
    sensitive_column: str,
    hints: Iterable[str] | None = None,
    model_features: Iterable[str] | None = None,
) -> tuple[pd.DataFrame, str]:
    """
    Guarantee a usable sensitive column exists.
    Creates unified gender labels from one-hot columns when needed.
    """
    if sensitive_column in df.columns:
        return df, sensitive_column

    hints = [str(h).lower() for h in (hints or []) if h]
    wants_gender = any("gender" in h or "sex" in h for h in hints) or "gender" in sensitive_column.lower()

    gender_one_hot = [col for col in df.columns if col.lower().startswith("gender_")]
    model_feature_set = {str(f).lower() for f in (model_features or [])}
    if wants_gender and gender_one_hot:
        out = df.copy()

        def _gender_label(row):
            for col in gender_one_hot:
                value = row.get(col)
                if pd.notna(value) and float(value) >= 0.5:
                    return col.split("_", 1)[-1]
            return "unknown"

        out["gender"] = out.apply(_gender_label, axis=1)
        drop_cols = [
            col for col in gender_one_hot
            if col.lower() not in model_feature_set
        ]
        out = out.drop(columns=drop_cols, errors="ignore")
        return out, "gender"

    out = df.copy()
    out[sensitive_column] = np.random.choice(["Group A", "Group B"], size=len(out))
    return out, sensitive_column


def build_audit_dataset_preview(
    df: pd.DataFrame,
    y_true,
    y_pred,
    sensitive_column: str,
    limit: int = 10,
) -> list[dict]:
    """Rows formatted for the Results UI."""
    y_true_series = pd.Series(y_true).reset_index(drop=True)
    y_pred_series = pd.Series(y_pred).reset_index(drop=True)

    if sensitive_column in df.columns:
        sensitive_series = df[sensitive_column].reset_index(drop=True)
    else:
        gender_cols = [c for c in df.columns if c.lower().startswith("gender_")]
        if gender_cols:
            sensitive_series = df[gender_cols[0]].reset_index(drop=True)
        else:
            sensitive_series = pd.Series(["unknown"] * len(df))

    preview = []
    row_count = min(limit, len(y_true_series))
    for idx in range(row_count):
        preview.append({
            "true_label": _format_audit_cell(y_true_series.iloc[idx]),
            "prediction": _format_audit_cell(y_pred_series.iloc[idx]),
            "sensitive_feature": _format_audit_cell(sensitive_series.iloc[idx]),
        })
    return preview


def _format_audit_cell(value):
    """Normalize preview values for UI (preserve 0 and 1)."""
    if pd.isna(value):
        return "N/A"
    if isinstance(value, (np.integer, int)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        if float(value).is_integer():
            return int(value)
        return round(float(value), 4)
    return str(value)


def prepare_uploaded_dataset(
    df: pd.DataFrame,
    target_column: str,
    sensitive_column: str,
    hints: Iterable[str] | None = None,
) -> tuple[pd.DataFrame, str, str]:
    """Normalize uploaded CSV columns for governance metrics."""
    working = df.copy()
    target = infer_target_column(working, [], explicit=target_column)
    sensitive = resolve_sensitive_column(working, hints=hints)
    working, sensitive = ensure_sensitive_column(
        working,
        sensitive,
        hints=hints,
        model_features=[
            col for col in working.columns
            if col.lower() != target.lower()
        ],
    )
    return working, target, sensitive
