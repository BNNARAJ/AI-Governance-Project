from __future__ import annotations

import json
import os
import re
import shutil
import zipfile
import csv
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml

from app.services.model_profile import FeatureSpec, ModelProfile


def _slugify(name: str) -> str:
    name = name.strip()
    if not name:
        return "mlflow_model"
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return name.strip("._-") or "mlflow_model"


def safe_extract_zip(zip_path: str, dest_dir: str) -> None:
    dest = Path(dest_dir).resolve()
    dest.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path) as zf:
        for member in zf.infolist():
            member_path = Path(member.filename)
            # Skip absolute paths and directory traversal attempts.
            if member_path.is_absolute() or ".." in member_path.parts:
                continue
            target_path = (dest / member_path).resolve()
            if not str(target_path).startswith(str(dest) + os.sep):
                continue

            if member.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
                continue

            target_path.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(member, "r") as src, open(target_path, "wb") as dst:
                shutil.copyfileobj(src, dst)


def find_mlmodel(root_dir: str) -> Optional[str]:
    root = Path(root_dir)
    direct = root / "MLmodel"
    if direct.exists():
        return str(direct)
    matches = list(root.rglob("MLmodel"))
    return str(matches[0]) if matches else None


def parse_mlmodel(mlmodel_path: str) -> Dict[str, Any]:
    with open(mlmodel_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def _parse_signature_inputs(signature: Any) -> List[Dict[str, Any]]:
    if not signature:
        return []
    if isinstance(signature, str):
        try:
            signature = json.loads(signature)
        except Exception:
            return []
    if isinstance(signature, dict):
        inputs = signature.get("inputs")
        if isinstance(inputs, str):
            try:
                inputs = json.loads(inputs)
            except Exception:
                inputs = None
        if isinstance(inputs, list):
            return [x for x in inputs if isinstance(x, dict)]
    return []


def _dtype_from_mlflow(t: Any) -> str:
    if not t:
        return "float"
    if isinstance(t, dict):
        # Some signatures use {"type": "tensor", "tensor-spec": {"dtype": "float64", ...}}
        inner = t.get("type") or t.get("dtype") or t.get("dataType")
        return _dtype_from_mlflow(inner)
    s = str(t).lower()
    if "bool" in s:
        return "bool"
    if "int" in s or "long" in s:
        return "int"
    if "double" in s or "float" in s or "number" in s:
        return "float"
    if "string" in s:
        return "category"
    return "float"


def infer_profile_from_mlflow(mlmodel: Dict[str, Any], model_id: str, extracted_root: str) -> Optional[ModelProfile]:
    sig_inputs = _parse_signature_inputs(mlmodel.get("signature"))
    features: List[FeatureSpec] = []

    for inp in sig_inputs:
        name = inp.get("name")
        if not name:
            continue
        dtype = _dtype_from_mlflow(inp.get("type") or inp.get("dataType") or inp.get("dtype"))
        features.append(FeatureSpec(name=str(name), dtype=dtype, default=0, required=False, use=True, id_column=False))

    if not features:
        # Fallback: schema.json (common lightweight signature export).
        root = Path(extracted_root)
        schema_candidates = list(root.rglob("schema.json"))
        if schema_candidates:
            try:
                schema = json.loads(schema_candidates[0].read_text(encoding="utf-8"))
                inputs = schema.get("inputs") if isinstance(schema, dict) else None
                if isinstance(inputs, list):
                    for inp in inputs:
                        if not isinstance(inp, dict):
                            continue
                        name = inp.get("name")
                        if not name:
                            continue
                        dtype = _dtype_from_mlflow(inp.get("type") or inp.get("dtype"))
                        features.append(
                            FeatureSpec(
                                name=str(name),
                                dtype=dtype,
                                default=0,
                                required=False,
                                use=True,
                                id_column=False,
                            )
                        )
            except Exception:
                pass

    if not features:
        # Fallback: try to infer from an input example file if present.
        root = Path(extracted_root)
        candidates = list(root.rglob("input_example.json"))
        if candidates:
            try:
                data = json.loads(candidates[0].read_text(encoding="utf-8"))
                row = None
                if isinstance(data, dict):
                    row = data
                elif isinstance(data, list) and data and isinstance(data[0], dict):
                    row = data[0]
                if isinstance(row, dict):
                    for k, v in row.items():
                        if isinstance(v, bool):
                            dtype = "bool"
                        elif isinstance(v, int):
                            dtype = "int"
                        elif isinstance(v, float):
                            dtype = "float"
                        elif v is None:
                            dtype = "float"
                        else:
                            dtype = "category"
                        features.append(
                            FeatureSpec(name=str(k), dtype=dtype, default=0, required=False, use=True, id_column=False)
                        )
            except Exception:
                pass

    # Optional: use sample_input.csv first row for defaults.
    if features:
        root = Path(extracted_root)
        csv_candidates = list(root.rglob("sample_input.csv"))
        if csv_candidates:
            try:
                with open(csv_candidates[0], "r", encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    first = next(reader, None)
                if isinstance(first, dict):
                    by_name = {fs.name: fs for fs in features}
                    for k, v in first.items():
                        if k not in by_name:
                            continue
                        spec = by_name[k]
                        if v is None or v == "":
                            continue
                        try:
                            if spec.dtype == "int":
                                spec.default = int(float(v))
                            elif spec.dtype == "float":
                                spec.default = float(v)
                            elif spec.dtype == "bool":
                                spec.default = 1 if str(v).strip().lower() in ("1", "true", "yes", "y") else 0
                            else:
                                spec.default = v
                        except Exception:
                            pass
            except Exception:
                pass

    if not features:
        return None

    return ModelProfile(model_id=model_id, features=features)


def extract_sklearn_pickled_model_path(mlmodel: Dict[str, Any]) -> Optional[str]:
    flavors = mlmodel.get("flavors") or {}
    skl = flavors.get("sklearn") or {}
    pickled = skl.get("pickled_model")
    if pickled:
        return str(pickled)
    return None


def import_mlflow_zip_to_model_store(
    zip_file_path: str,
    original_filename: str,
    extracted_root_dir: str,
    model_store_dir: str,
) -> Tuple[str, Optional[ModelProfile], str]:
    """
    Imports an MLflow model zip into our model store:
    - extracts zip safely to extracted_root_dir
    - reads MLmodel, extracts sklearn pickled model, copies it into model_store_dir
    - infers a ModelProfile if possible

    Returns: (model_id, inferred_profile_or_none, extracted_dir)
    """
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    base = _slugify(Path(original_filename).stem)
    bundle_dir = os.path.join(extracted_root_dir, f"{base}_{ts}")
    os.makedirs(bundle_dir, exist_ok=True)
    safe_extract_zip(zip_file_path, bundle_dir)

    mlmodel_path = find_mlmodel(bundle_dir)
    if not mlmodel_path:
        raise ValueError("Invalid MLflow bundle: MLmodel file not found.")

    mlmodel = parse_mlmodel(mlmodel_path)
    rel_pickled = extract_sklearn_pickled_model_path(mlmodel)
    if not rel_pickled:
        raise ValueError("Unsupported MLflow bundle: only sklearn flavor is supported right now.")

    src_model_path = str((Path(mlmodel_path).parent / rel_pickled).resolve())
    if not os.path.exists(src_model_path):
        raise ValueError("Invalid MLflow bundle: sklearn pickled model file not found.")

    model_id = f"{base}_mlflow_{ts}.pkl"
    dest_model_path = os.path.join(model_store_dir, model_id)
    os.makedirs(model_store_dir, exist_ok=True)
    shutil.copy2(src_model_path, dest_model_path)

    profile = infer_profile_from_mlflow(mlmodel, model_id=model_id, extracted_root=bundle_dir)
    return model_id, profile, bundle_dir
