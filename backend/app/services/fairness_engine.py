from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from fairlearn.metrics import demographic_parity_difference
from sklearn.metrics import confusion_matrix


@dataclass
class FairnessDataset:
    true_labels: list[int]
    predictions: list[int]
    sensitive_feature: list[str]


class FairnessEngine:
    def _to_binary(self, values: list[Any]) -> list[int]:
        out: list[int] = []
        for value in values:
            s = str(value).strip().lower()
            if s in {"1", "true", "yes", "approved", "approve", "pass"}:
                out.append(1)
            else:
                out.append(0)
        return out

    def load_csv_dataset(self, csv_path: str) -> FairnessDataset:
        df = pd.read_csv(csv_path)
        required = {"true_label", "prediction", "sensitive_feature"}
        missing = [c for c in required if c not in df.columns]
        if missing:
            raise ValueError(f"Missing required columns in CSV: {missing}")
        return FairnessDataset(
            true_labels=self._to_binary(df["true_label"].tolist()),
            predictions=self._to_binary(df["prediction"].tolist()),
            sensitive_feature=[str(v) for v in df["sensitive_feature"].tolist()],
        )

    def build_dummy_dataset(self, n_rows: int = 300, seed: int = 42) -> FairnessDataset:
        n_rows = max(60, int(n_rows))
        rng = np.random.default_rng(seed)
        groups = rng.choice(["group_a", "group_b"], size=n_rows, p=[0.52, 0.48])

        true_labels = rng.binomial(1, 0.58, size=n_rows)
        predictions = []
        for y, g in zip(true_labels, groups):
            # Inject a small controlled disparity for audit realism.
            base = 0.80 if y == 1 else 0.18
            if g == "group_b":
                base -= 0.07
            predictions.append(int(rng.random() < base))

        return FairnessDataset(
            true_labels=true_labels.tolist(),
            predictions=predictions,
            sensitive_feature=groups.tolist(),
        )

    def compute_metrics(self, dataset: FairnessDataset) -> dict[str, float]:
        y_pred = np.array(dataset.predictions)
        groups = np.array(dataset.sensitive_feature)

        unique = list(pd.Series(groups).dropna().unique())
        if len(unique) < 2:
            raise ValueError("Sensitive feature must contain at least two groups.")

        rates: dict[str, float] = {}
        for g in unique:
            mask = groups == g
            group_preds = y_pred[mask]
            rates[str(g)] = float(group_preds.mean()) if len(group_preds) else 0.0

        max_rate = max(rates.values())
        min_rate = min(rates.values())
        disparate_impact_ratio = (min_rate / max_rate) if max_rate > 0 else 0.0
        dp_diff = float(
            demographic_parity_difference(
                y_true=np.array(dataset.true_labels),
                y_pred=y_pred,
                sensitive_features=groups,
            )
        )

        return {
            "disparate_impact_ratio": round(disparate_impact_ratio, 4),
            "demographic_parity_difference": round(dp_diff, 4),
            "selection_rate_min": round(min_rate, 4),
            "selection_rate_max": round(max_rate, 4),
            "row_count": len(dataset.predictions),
        }

    def to_rows(self, dataset: FairnessDataset) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for t, p, s in zip(dataset.true_labels, dataset.predictions, dataset.sensitive_feature):
            rows.append(
                {
                    "true_label": int(t),
                    "prediction": int(p),
                    "sensitive_feature": str(s),
                }
            )
        return rows

    def compute_matrices(self, dataset: FairnessDataset) -> dict[str, Any]:
        y_true = np.array(dataset.true_labels)
        y_pred = np.array(dataset.predictions)
        groups = np.array(dataset.sensitive_feature)

        def _safe_rates(cm: np.ndarray) -> dict[str, float]:
            tn, fp, fn, tp = cm.ravel()
            total = max(int(tn + fp + fn + tp), 1)
            tpr = (tp / (tp + fn)) if (tp + fn) else 0.0
            fpr = (fp / (fp + tn)) if (fp + tn) else 0.0
            precision = (tp / (tp + fp)) if (tp + fp) else 0.0
            accuracy = (tp + tn) / total
            return {
                "tpr": round(float(tpr), 4),
                "fpr": round(float(fpr), 4),
                "precision": round(float(precision), 4),
                "accuracy": round(float(accuracy), 4),
            }

        overall_cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
        by_group: dict[str, Any] = {}
        tpr_values: list[float] = []
        fpr_values: list[float] = []
        for g in pd.Series(groups).dropna().unique():
            mask = groups == g
            cm = confusion_matrix(y_true[mask], y_pred[mask], labels=[0, 1])
            rates = _safe_rates(cm)
            tpr_values.append(rates["tpr"])
            fpr_values.append(rates["fpr"])
            by_group[str(g)] = {
                "confusion_matrix": cm.tolist(),
                "rates": rates,
                "count": int(mask.sum()),
            }

        tpr_diff = (max(tpr_values) - min(tpr_values)) if tpr_values else 0.0
        fpr_diff = (max(fpr_values) - min(fpr_values)) if fpr_values else 0.0

        return {
            "overall_confusion_matrix": overall_cm.tolist(),
            "overall_rates": _safe_rates(overall_cm),
            "by_group": by_group,
            "equalized_odds_gap": {
                "tpr_gap": round(float(tpr_diff), 4),
                "fpr_gap": round(float(fpr_diff), 4),
            },
        }

    def evaluate_rules(self, rules: list[dict[str, Any]], metrics: dict[str, float]) -> list[dict[str, Any]]:
        evaluations: list[dict[str, Any]] = []
        for rule in rules:
            metric_name = str(rule.get("metric_name", "")).strip()
            op = str(rule.get("operator", "")).strip()
            value = metrics.get(metric_name)
            if value is None:
                evaluations.append({**rule, "actual_value": None, "status": "FAIL", "reason": "Metric not available"})
                continue

            tmin = rule.get("threshold_min")
            tmax = rule.get("threshold_max")
            status = False
            if op == ">=" and tmin is not None:
                status = float(value) >= float(tmin)
            elif op == "<=" and tmin is not None:
                status = float(value) <= float(tmin)
            elif op == "between" and tmin is not None and tmax is not None:
                status = float(tmin) <= float(value) <= float(tmax)

            evaluations.append(
                {
                    **rule,
                    "actual_value": value,
                    "status": "PASS" if status else "FAIL",
                }
            )
        return evaluations


fairness_engine = FairnessEngine()
