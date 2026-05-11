import argparse
import json
import os
import shutil
import zipfile
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier


def build_bundle(output_dir: str, base_name: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bundle_root = os.path.join(output_dir, f"{base_name}_{ts}")
    model_dir = os.path.join(bundle_root, "model")
    os.makedirs(model_dir, exist_ok=True)

    # Train a tiny deterministic demo model with governance-friendly features.
    rng = np.random.default_rng(42)
    n = 500
    df = pd.DataFrame(
        {
            "age": rng.integers(21, 65, size=n),
            "income": rng.integers(20000, 150000, size=n),
            "credit_score": rng.integers(300, 850, size=n),
            "loan_amount": rng.integers(2000, 50000, size=n),
            "gender": rng.integers(0, 2, size=n),
            "location": rng.integers(0, 2, size=n),
        }
    )
    y = (
        (df["credit_score"] > 620).astype(int)
        & (df["income"] > 35000).astype(int)
        & (df["loan_amount"] < 35000).astype(int)
    ).astype(int)

    feature_cols = ["age", "income", "credit_score", "loan_amount", "gender", "location"]
    X = df[feature_cols]

    model = RandomForestClassifier(n_estimators=80, random_state=42)
    model.fit(X, y)

    model_path = os.path.join(model_dir, "model.pkl")
    joblib.dump(model, model_path)

    mlmodel_text = """artifact_path: model
flavors:
  sklearn:
    pickled_model: model.pkl
    sklearn_version: 1.0
"""
    with open(os.path.join(model_dir, "MLmodel"), "w", encoding="utf-8") as f:
        f.write(mlmodel_text)

    schema = {
        "inputs": [{"name": c, "type": "double"} for c in feature_cols],
        "outputs": [{"name": "prediction", "type": "long"}],
    }
    with open(os.path.join(model_dir, "schema.json"), "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)

    sample_input = pd.DataFrame(
        [
            {
                "age": 35,
                "income": 62000,
                "credit_score": 710,
                "loan_amount": 15000,
                "gender": 1,
                "location": 0,
            }
        ]
    )
    sample_input.to_csv(os.path.join(model_dir, "sample_input.csv"), index=False)

    zip_path = os.path.join(output_dir, f"{base_name}_{ts}.zip")
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for root, _dirs, files in os.walk(bundle_root):
            for name in files:
                abs_path = os.path.join(root, name)
                rel_path = os.path.relpath(abs_path, bundle_root)
                zf.write(abs_path, rel_path)

    return zip_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a quick MLflow-style sklearn zip bundle.")
    parser.add_argument(
        "--output-dir",
        default=os.path.join("uploads", "models", "generated"),
        help="Directory where zip should be written.",
    )
    parser.add_argument("--base-name", default="quick_mlflow_sklearn_bundle")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    zip_path = build_bundle(args.output_dir, args.base_name)
    print(f"Created MLflow-style bundle: {zip_path}")
    print("Upload this .zip using /upload-mlflow-model in your UI.")


if __name__ == "__main__":
    main()
