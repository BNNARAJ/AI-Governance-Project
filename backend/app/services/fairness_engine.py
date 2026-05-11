from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np
import pandas as pd
from fairlearn.metrics import demographic_parity_difference


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
        y_true = np.array(dataset.true_labels)
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
                y_true=y_true,
                y_pred=y_pred,
                sensitive_features=groups,
            )
        )

        # Confusion-matrix derived metrics
        tp = int(np.sum((y_true == 1) & (y_pred == 1)))
        tn = int(np.sum((y_true == 0) & (y_pred == 0)))
        fp = int(np.sum((y_true == 0) & (y_pred == 1)))
        fn = int(np.sum((y_true == 1) & (y_pred == 0)))

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        accuracy = (tp + tn) / max(len(y_pred), 1)
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        return {
            "disparate_impact_ratio": round(disparate_impact_ratio, 4),
            "demographic_parity_difference": round(dp_diff, 4),
            "selection_rate_min": round(min_rate, 4),
            "selection_rate_max": round(max_rate, 4),
            "row_count": len(dataset.predictions),
            "tp": tp,
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1_score": round(f1, 4),
            "classification_accuracy": round(accuracy, 4),
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
            elif op == "<=":
                # Check threshold_min first, then threshold_max if min is None
                if tmin is not None:
                    status = float(value) <= float(tmin)
                elif tmax is not None:
                    status = float(value) <= float(tmax)
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
