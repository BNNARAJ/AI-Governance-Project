import os
import pickle
import joblib
import json
import pandas as pd
from typing import List, Dict, Optional, Any
import traceback

from app.services.model_profile import ModelProfile, FeatureSpec

class ModelService:
    def __init__(self):
        # Look for model directories relative to the app root
        self.backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.project_dir = os.path.dirname(self.backend_dir)
        self.model_dir = os.path.join(self.project_dir, "uploads", "models")
        os.makedirs(self.model_dir, exist_ok=True)
        self._loaded_models: Dict[str, Any] = {}
        self._loaded_preprocessors: Dict[str, Any] = {}

    def get_or_default_profile(
        self,
        model_id: str,
        feature_names: Optional[List[str]] = None,
    ) -> ModelProfile:
        existing = self.load_profile(model_id)
        if existing is not None:
            return existing

        if not feature_names:
            try:
                info = self.inspect_model(model_id)
                feature_names = info.get("feature_names") or []
            except Exception:
                feature_names = []

        def is_id_like(name: str) -> bool:
            n = name.strip().lower().replace(" ", "_")
            return n in {"id", "loan_id"} or n.endswith("_id") or n.endswith("id")

        specs: List[FeatureSpec] = []
        for name in feature_names or []:
            id_like = is_id_like(name)
            specs.append(
                FeatureSpec(
                    name=name,
                    use=not id_like,
                    id_column=id_like,
                    dtype="float",
                    required=False,
                    default=0,
                )
            )

        return ModelProfile(model_id=model_id, features=specs)

    def build_baseline_features(self, profile: ModelProfile) -> Dict[str, Any]:
        row: Dict[str, Any] = {}
        for spec in profile.features:
            if spec.id_column or not spec.use:
                continue
            if spec.default is not None:
                row[spec.name] = spec.default
            else:
                row[spec.name] = 0
        return row

    def apply_variance(self, profile: ModelProfile, base: Dict[str, Any], factor: str, variant_index: int) -> Dict[str, Any]:
        if not factor:
            return dict(base)

        def norm(s: str) -> str:
            return "".join(ch for ch in s.lower() if ch.isalnum())

        factor_n = norm(factor)
        if not factor_n:
            return dict(base)

        out = dict(base)
        matched = [
            s
            for s in profile.features
            if s.use
            and not s.id_column
            and s.name
            and (factor_n in norm(s.name) or norm(s.name) in factor_n)
        ]
        if not matched:
            return out

        alt = 0 if (variant_index % 2 == 0) else 1
        for spec in matched:
            if spec.dtype in ("bool", "int"):
                out[spec.name] = alt
            elif spec.dtype == "float":
                try:
                    cur = float(out.get(spec.name, 0) or 0)
                    if cur == 0:
                        out[spec.name] = float(alt)
                    else:
                        out[spec.name] = cur * (0.7 if alt == 0 else 1.3)
                except Exception:
                    out[spec.name] = float(alt)
            elif spec.dtype == "category":
                # If no encoding/preprocessor is provided, prefer numeric fallback to avoid fragile crashes.
                if spec.encoding:
                    keys = sorted(list(spec.encoding.keys()))
                    out[spec.name] = keys[variant_index % len(keys)]
                elif spec.allowed_values:
                    vals = list(spec.allowed_values)
                    out[spec.name] = vals[variant_index % len(vals)]
                else:
                    out[spec.name] = alt
            else:  # "string"
                out[spec.name] = str(out.get(spec.name, ""))

        return out

    def _profile_path(self, model_id: str) -> str:
        return os.path.join(self.model_dir, f"{model_id}.profile.json")

    def _preprocessor_path(self, model_id: str) -> str:
        return os.path.join(self.model_dir, f"{model_id}.preprocessor.pkl")

    def load_profile(self, model_id: str) -> Optional[ModelProfile]:
        path = self._profile_path(model_id)
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        profile = ModelProfile.model_validate(data)
        if profile.model_id != model_id:
            profile = ModelProfile.model_validate({**profile.model_dump(), "model_id": model_id})
        return profile

    def save_profile(self, model_id: str, profile_data: Dict[str, Any]) -> ModelProfile:
        # Normalize/validate and persist deterministically.
        profile = ModelProfile.model_validate({**profile_data, "model_id": model_id})
        path = self._profile_path(model_id)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(profile.model_dump(), f, indent=2)
        return profile

    def save_preprocessor(self, model_id: str, file_obj) -> str:
        path = self._preprocessor_path(model_id)
        with open(path, "wb") as buffer:
            import shutil
            shutil.copyfileobj(file_obj, buffer)
        # Clear cache so next load uses the new artifact.
        self._loaded_preprocessors.pop(model_id, None)
        return path

    def load_preprocessor(self, model_id: str) -> Optional[Any]:
        if model_id in self._loaded_preprocessors:
            return self._loaded_preprocessors[model_id]

        path = self._preprocessor_path(model_id)
        if not os.path.exists(path):
            return None

        try:
            pre = joblib.load(path)
        except Exception:
            with open(path, "rb") as f:
                pre = pickle.load(f)
        self._loaded_preprocessors[model_id] = pre
        return pre

    def save_model(self, model_file, filename: str) -> str:
        file_path = os.path.join(self.model_dir, filename)
        with open(file_path, "wb") as buffer:
            import shutil
            shutil.copyfileobj(model_file, buffer)
        return file_path

    def load_model(self, model_id: str) -> Any:
        if model_id in self._loaded_models:
            return self._loaded_models[model_id]
        
        file_path = os.path.join(self.model_dir, model_id)
        if not os.path.exists(file_path):
            # Try absolute project uploads first, then backend uploads
            fallbacks = [
                os.path.join(self.project_dir, "uploads", model_id),
                os.path.join(self.backend_dir, "uploads", model_id),
                os.path.join("uploads", model_id)
            ]
            found = False
            for fb in fallbacks:
                if os.path.exists(fb):
                    file_path = fb
                    found = True
                    break
            
            if not found:
                raise FileNotFoundError(f"Model file {model_id} not found in any standard location.")

        try:
            # Use joblib as it's better for sklearn models
            model = joblib.load(file_path)
            self._loaded_models[model_id] = model
            return model
        except Exception as e:
            # Fallback to pickle
            with open(file_path, "rb") as f:
                model = pickle.load(f)
            self._loaded_models[model_id] = model
            return model

    def inspect_model(self, model_id: str) -> Dict[str, Any]:
        model = self.load_model(model_id)
        info = {
            "type": str(type(model)),
            "feature_names": [],
            "n_features": 0
        }

        # Handle sklearn feature names
        if hasattr(model, "feature_names_in_"):
            info["feature_names"] = list(model.feature_names_in_)
            info["n_features"] = len(model.feature_names_in_)
        elif hasattr(model, "n_features_in_"):
            info["n_features"] = model.n_features_in_
        
        # Check for pipeline steps
        if hasattr(model, "steps"):
            info["pipeline_steps"] = [name for name, _ in model.steps]

        return info

    def predict(self, model_id: str, features: Dict[str, Any]) -> Any:
        model = self.load_model(model_id)

        preprocessor = self.load_preprocessor(model_id)
        allow_strings = preprocessor is not None or hasattr(model, "steps")

        profile = self.load_profile(model_id)
        if profile is not None and profile.features:
            df = self._coerce_with_profile(features, profile, allow_strings=allow_strings)
        else:
            # Convert features to DataFrame (legacy behavior)
            df = pd.DataFrame([features])
        
        # 1. Handle feature name alignment if possible
        if hasattr(model, "feature_names_in_"):
            # Ensure all required features are present, fill missing with 0
            for col in model.feature_names_in_:
                if col not in df.columns:
                    df[col] = 0
            df = df[model.feature_names_in_]
        else:
            # 2. Fallback: If no feature names, try to be robust
            # Drop obvious non-numeric columns like 'Loan_ID' or 'ID' if they are strings
            id_cols = ['Loan_ID', 'ID', 'Id', 'id', 'Loan_Status']
            for col in id_cols:
                if col in df.columns:
                    # Only drop if it's a string (IDs usually are)
                    if isinstance(df[col].iloc[0], str):
                        print(f"Dropping inferred ID/Status column: {col}")
                        df = df.drop(columns=[col])

            # Ensure we only have numeric data if it's a base RandomForest/etc.
            expected_n = getattr(model, "n_features_in_", None)
            if expected_n and len(df.columns) > expected_n:
                print(f"Truncating features from {len(df.columns)} to {expected_n} to match model.")
                df = df.iloc[:, :expected_n]

        # Final check: ensure numeric-only estimators don't crash on strings.
        # If the model is a Pipeline or we have a preprocessor, preserve strings.
        if not allow_strings:
            for col in df.columns:
                if df[col].dtype == object and isinstance(df[col].iloc[0], str):
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        # Optional preprocessing artifact (separate from model pickle)
        if preprocessor is not None and hasattr(preprocessor, "transform"):
            X = preprocessor.transform(df)
            prediction = model.predict(X)
        else:
            prediction = model.predict(df)
        
        # Convert numpy types to native python
        if hasattr(prediction, "tolist"):
            prediction = prediction.tolist()
            
        return prediction[0] if isinstance(prediction, list) else prediction

    def _coerce_with_profile(self, features: Dict[str, Any], profile: ModelProfile, allow_strings: bool) -> pd.DataFrame:
        row: Dict[str, Any] = {}
        active_specs: List[FeatureSpec] = []

        for spec in profile.features:
            if spec.id_column or not spec.use:
                continue
            active_specs.append(spec)

            raw = features.get(spec.name, None)
            if raw is None or raw == "":
                if spec.default is not None:
                    raw = spec.default
                elif spec.required:
                    raise ValueError(f"Missing required feature: {spec.name}")
                else:
                    raw = 0

            val: Any = raw
            try:
                if spec.dtype == "float":
                    val = float(val)
                elif spec.dtype == "int":
                    val = int(float(val))
                elif spec.dtype == "bool":
                    if isinstance(val, str):
                        val = val.strip().lower() in ("1", "true", "yes", "y", "t")
                    val = int(bool(val))
                elif spec.dtype == "category":
                    if spec.encoding:
                        key = str(val)
                        if key not in spec.encoding:
                            raise ValueError(f"Unknown category for {spec.name}: {val}")
                        val = spec.encoding[key]
                    else:
                        if allow_strings:
                            # Keep as-is; user should provide an encoder or use a Pipeline/preprocessor.
                            val = str(val)
                        else:
                            # Numeric-only estimators: accept numeric codes when present, otherwise fall back safely.
                            if isinstance(val, (int, float)):
                                val = val
                            else:
                                try:
                                    val = float(val)
                                except Exception:
                                    val = 0
                else:  # "string"
                    val = str(val) if allow_strings else 0
            except Exception:
                # Last resort: coerce to numeric 0 to avoid hard model crashes.
                if spec.dtype in ("float", "int", "bool"):
                    val = 0
                else:
                    val = str(raw)

            if spec.min is not None:
                try:
                    val = max(float(val), spec.min)
                except Exception:
                    pass
            if spec.max is not None:
                try:
                    val = min(float(val), spec.max)
                except Exception:
                    pass

            row[spec.name] = val

        df = pd.DataFrame([row])

        # Align to model feature order when possible.
        cached_model = self._loaded_models.get(profile.model_id)
        if cached_model is not None and hasattr(cached_model, "feature_names_in_"):
            for col in cached_model.feature_names_in_:
                if col not in df.columns:
                    df[col] = 0
            df = df[list(cached_model.feature_names_in_)]
        else:
            df = df.reindex(columns=[s.name for s in active_specs])

        # Ensure no accidental object dtypes in numeric columns.
        spec_by_name = {s.name: s for s in active_specs}
        for col in df.columns:
            spec = spec_by_name.get(col)
            if spec is not None and spec.dtype in ("category", "string"):
                continue
            if df[col].dtype == object and isinstance(df[col].iloc[0], str):
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        return df

model_service = ModelService()
