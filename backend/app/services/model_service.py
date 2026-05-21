import os
import pickle
import joblib
import json
import random
import pandas as pd
import numpy as np

from typing import List, Dict, Optional, Any
import traceback

from app.services.model_profile import ModelProfile, FeatureSpec
from app.services.statistical.utils import align_features_to_model



class ModelService:

    def __init__(self):

        # =====================================================
        # PATHS
        # =====================================================

        self.backend_dir = os.path.dirname(
            os.path.dirname(
                os.path.dirname(
                    os.path.abspath(__file__)
                )
            )
        )

        self.project_dir = os.path.dirname(
            self.backend_dir
        )

        self.model_dir = os.path.join(
            self.project_dir,
            "uploads",
            "models"
        )

        os.makedirs(
            self.model_dir,
            exist_ok=True
        )

        self._loaded_models: Dict[str, Any] = {}
        self._loaded_preprocessors: Dict[str, Any] = {}

    # =========================================================
    # PROFILE
    # =========================================================

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
                feature_names = (
                    info.get("feature_names")
                    or []
                )

            except Exception:
                feature_names = []

        def is_id_like(name: str) -> bool:

            n = (
                name.strip()
                .lower()
                .replace(" ", "_")
            )

            return (
                n in {"id", "loan_id"}
                or n.endswith("_id")
                or n.endswith("id")
            )

        specs: List[FeatureSpec] = []

        for name in feature_names or []:

            id_like = is_id_like(name)

            inferred_dtype = self._infer_feature_dtype(name)

            specs.append(
                FeatureSpec(
                    name=name,
                    use=not id_like,
                    id_column=id_like,
                    dtype=inferred_dtype,
                    required=False,
                    default=self._default_for_dtype(
                        inferred_dtype
                    ),
                )
            )

        return ModelProfile(
            model_id=model_id,
            features=specs,
        )

    # =========================================================
    # SMART FEATURE TYPE INFERENCE
    # =========================================================

    def _infer_feature_dtype(
        self,
        feature_name: str
    ) -> str:

        n = feature_name.lower()

        category_keywords = [
            "gender",
            "married",
            "education",
            "property",
            "self_employed",
            "occupation",
            "city",
            "state",
            "country",
            "race",
            "ethnicity",
        ]

        int_keywords = [
            "dependents",
            "children",
            "count",
            "number",
        ]

        bool_keywords = [
            "approved",
            "is_",
            "has_",
        ]

        for k in category_keywords:
            if k in n:
                return "category"

        for k in int_keywords:
            if k in n:
                return "int"

        for k in bool_keywords:
            if k in n:
                return "bool"

        return "float"

    def _default_for_dtype(
        self,
        dtype: str
    ):

        if dtype == "float":
            return 0.0

        if dtype == "int":
            return 0

        if dtype == "bool":
            return 0

        if dtype == "category":
            return "unknown"

        return ""

    # =========================================================
    # BASELINE FEATURES
    # =========================================================

    def build_baseline_features(
        self,
        profile: ModelProfile
    ) -> Dict[str, Any]:

        row: Dict[str, Any] = {}

        for spec in profile.features:

            if spec.id_column or not spec.use:
                continue

            feature_name = spec.name.lower()

            # =============================================
            # REALISTIC BASE VALUES
            # =============================================

            if "income" in feature_name:
                row[spec.name] = 75000

            elif "credit" in feature_name:
                row[spec.name] = 720

            elif "age" in feature_name:
                row[spec.name] = 35

            elif "loan" in feature_name:
                row[spec.name] = 200000

            elif "debt" in feature_name:
                row[spec.name] = 0.30

            elif "experience" in feature_name:
                row[spec.name] = 10

            elif "salary" in feature_name:
                row[spec.name] = 85000

            elif "score" in feature_name:
                row[spec.name] = 80

            elif spec.dtype == "category":
                row[spec.name] = "A"

            elif spec.default is not None:
                row[spec.name] = spec.default

            else:
                row[spec.name] = 0

        return row

    # =========================================================
    # APPLY VARIANCE
    # =========================================================

    def apply_variance(
        self,
        profile: ModelProfile,
        base: Dict[str, Any],
        factor: str,
        variant_index: int
    ) -> Dict[str, Any]:
        
        out = dict(base)

        random.seed(variant_index)

        # =====================================================
        # CREATE COMPLETELY DIFFERENT RISK PROFILES
        # =====================================================

        risk_bucket = variant_index % 3

        for spec in profile.features:

            if spec.id_column or not spec.use:
                continue

            feature = spec.name.lower()

            try:

                # =========================================
                # INCOME FEATURES
                # =========================================

                if "income" in feature or "salary" in feature:

                    if risk_bucket == 0:
                        out[spec.name] = random.randint(20000, 40000)

                    elif risk_bucket == 1:
                        out[spec.name] = random.randint(50000, 80000)

                    else:
                        out[spec.name] = random.randint(90000, 150000)

                # =========================================
                # CREDIT SCORE FEATURES
                # =========================================

                elif "credit" in feature or "cibil" in feature:

                    if risk_bucket == 0:
                        out[spec.name] = random.randint(300, 550)

                    elif risk_bucket == 1:
                        out[spec.name] = random.randint(580, 700)

                    else:
                        out[spec.name] = random.randint(720, 850)

                # =========================================
                # AGE
                # =========================================

                elif "age" in feature:

                    out[spec.name] = random.randint(21, 65)

                # =========================================
                # LOAN AMOUNT
                # =========================================

                elif "loan" in feature:

                    if risk_bucket == 0:
                        out[spec.name] = random.randint(300000, 600000)

                    elif risk_bucket == 1:
                        out[spec.name] = random.randint(100000, 300000)

                    else:
                        out[spec.name] = random.randint(50000, 150000)

                # =========================================
                # DEBT RATIO
                # =========================================

                elif "debt" in feature:

                    if risk_bucket == 0:
                        out[spec.name] = round(random.uniform(0.6, 0.9), 2)

                    elif risk_bucket == 1:
                        out[spec.name] = round(random.uniform(0.3, 0.6), 2)

                    else:
                        out[spec.name] = round(random.uniform(0.1, 0.3), 2)

                # =========================================
                # EXPERIENCE
                # =========================================

                elif "experience" in feature:

                    if risk_bucket == 0:
                        out[spec.name] = random.randint(0, 2)

                    elif risk_bucket == 1:
                        out[spec.name] = random.randint(3, 7)

                    else:
                        out[spec.name] = random.randint(8, 20)

                # =========================================
                # FLOAT GENERIC
                # =========================================

                elif spec.dtype == "float":

                    out[spec.name] = round(
                        random.uniform(0, 100),
                        2
                    )

                # =========================================
                # INTEGER GENERIC
                # =========================================

                elif spec.dtype == "int":

                    out[spec.name] = random.randint(0, 10)

                # =========================================
                # BOOLEAN
                # =========================================

                elif spec.dtype == "bool":

                    out[spec.name] = random.randint(0, 1)

                # =========================================
                # CATEGORY
                # =========================================

                elif spec.dtype == "category":

                    categories = ["A", "B", "C"]

                    out[spec.name] = random.choice(categories)

            except Exception:
                pass

        return out
    # =========================================================
    # PATHS
    # =========================================================

    def _profile_path(
        self,
        model_id: str
    ) -> str:

        return os.path.join(
            self.model_dir,
            f"{model_id}.profile.json"
        )

    def _preprocessor_path(
        self,
        model_id: str
    ) -> str:

        return os.path.join(
            self.model_dir,
            f"{model_id}.preprocessor.pkl"
        )

    # =========================================================
    # PROFILE LOAD/SAVE
    # =========================================================

    def load_profile(
        self,
        model_id: str
    ) -> Optional[ModelProfile]:

        path = self._profile_path(model_id)

        if not os.path.exists(path):
            return None

        with open(
            path,
            "r",
            encoding="utf-8"
        ) as f:

            data = json.load(f)

        profile = ModelProfile.model_validate(data)

        return profile

    def save_profile(
        self,
        model_id: str,
        profile_data: Dict[str, Any]
    ) -> ModelProfile:

        profile = ModelProfile.model_validate(
            {
                **profile_data,
                "model_id": model_id,
            }
        )

        path = self._profile_path(model_id)

        with open(
            path,
            "w",
            encoding="utf-8"
        ) as f:

            json.dump(
                profile.model_dump(),
                f,
                indent=2,
            )

        return profile

    # =========================================================
    # PREPROCESSOR
    # =========================================================

    def save_preprocessor(
        self,
        model_id: str,
        file_obj
    ) -> str:

        path = self._preprocessor_path(model_id)

        with open(path, "wb") as buffer:

            import shutil

            shutil.copyfileobj(
                file_obj,
                buffer
            )

        self._loaded_preprocessors.pop(
            model_id,
            None
        )

        return path

    def load_preprocessor(
        self,
        model_id: str
    ) -> Optional[Any]:

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

        self._loaded_preprocessors[
            model_id
        ] = pre

        return pre

    # =========================================================
    # MODEL SAVE/LOAD
    # =========================================================

    def save_model(
        self,
        model_file,
        filename: str
    ) -> str:

        file_path = os.path.join(
            self.model_dir,
            filename
        )

        with open(file_path, "wb") as buffer:

            import shutil

            shutil.copyfileobj(
                model_file,
                buffer
            )

        return file_path

    def load_model(
        self,
        model_id: str
    ) -> Any:

        if model_id in self._loaded_models:
            return self._loaded_models[model_id]

        file_path = os.path.join(
            self.model_dir,
            model_id
        )

        if not os.path.exists(file_path):

            fallbacks = [
                os.path.join(
                    self.project_dir,
                    "uploads",
                    "models",
                    model_id
                ),
                os.path.join(
                    self.project_dir,
                    "uploads",
                    model_id
                ),
                os.path.join(
                    self.backend_dir,
                    "uploaded_models",
                    model_id
                ),
                os.path.join(
                    "uploaded_models",
                    model_id
                ),
            ]

            found = False

            for fb in fallbacks:

                if os.path.exists(fb):
                    file_path = fb
                    found = True
                    break

            if not found:

                raise FileNotFoundError(
                    f"Model file or directory {model_id} not found."
                )

        if os.path.isdir(file_path):
            extracted_path = os.path.join(file_path, "extracted")
            if os.path.exists(extracted_path):
                from app.services.statistical.inspector import find_model_files
                from app.services.statistical.utils import load_model as stat_load_model
                artifacts = find_model_files(extracted_path)
                loaded = stat_load_model(artifacts)
                model = loaded["model"]
            else:
                raise FileNotFoundError(f"Model directory {file_path} does not contain 'extracted' folder.")
        else:
            try:
                model = joblib.load(file_path)
            except Exception:
                with open(file_path, "rb") as f:
                    model = pickle.load(f)

        self._loaded_models[
            model_id
        ] = model

        return model

    # =========================================================
    # INSPECT MODEL
    # =========================================================

    def inspect_model(
        self,
        model_id: str
    ) -> Dict[str, Any]:

        model = self.load_model(model_id)

        info = {
            "type": str(type(model)),
            "feature_names": [],
            "n_features": 0,
        }

        if hasattr(model, "feature_names_in_"):

            info["feature_names"] = list(
                model.feature_names_in_
            )

            info["n_features"] = len(
                model.feature_names_in_
            )

        elif hasattr(model, "n_features_in_"):

            info["n_features"] = (
                model.n_features_in_
            )

        if hasattr(model, "steps"):

            info["pipeline_steps"] = [
                name
                for name, _ in model.steps
            ]

        return info

    # =========================================================
    # PREDICT
    # =========================================================

    def predict(
        self,
        model_id: str,
        features: Dict[str, Any]
    ) -> Any:

        model = self.load_model(model_id)

        preprocessor = self.load_preprocessor(
            model_id
        )

        allow_strings = (
            preprocessor is not None
            or hasattr(model, "steps")
        )

        profile = self.load_profile(model_id)

        # Build initial DataFrame from raw feature dict
        df = pd.DataFrame([features])

        # Align features to model (handles XGBoost and others)
        df_aligned, _ = align_features_to_model(model, df)
        df = df_aligned

        # =============================================
        # ALIGN FEATURES
        # =============================================

        if hasattr(model, "feature_names_in_"):

            for col in model.feature_names_in_:

                if col not in df.columns:
                    df[col] = 0

            df = df[
                list(model.feature_names_in_)
            ]

        # =============================================
        # NUMERIC CLEANUP
        # =============================================

        if not allow_strings:

            for col in df.columns:

                if df[col].dtype == object:

                    df[col] = pd.to_numeric(
                        df[col],
                        errors="coerce"
                    ).fillna(0)

        # =============================================
        # PREDICT
        # =============================================

        try:

            if (
                preprocessor is not None
                and hasattr(preprocessor, "transform")
            ):

                X = preprocessor.transform(df)

                prediction = model.predict(X)

            else:

                prediction = model.predict(df)

        except Exception as e:

            print(
                f"PREDICTION FAILURE: {e}"
            )

            traceback.print_exc()

            # fallback heuristic
            prediction = [0]

            try:

                numeric_sum = (
                    df.select_dtypes(
                        include=[np.number]
                    ).sum(axis=1).iloc[0]
                )

                prediction = [
                    1 if numeric_sum > 100 else 0
                ]

            except Exception:
                prediction = [0]

        # =============================================
        # NORMALIZE OUTPUT
        # =============================================

        if hasattr(prediction, "tolist"):
            prediction = prediction.tolist()

        result = (
            prediction[0]
            if isinstance(prediction, list)
            else prediction
        )

        # =============================================
        # HANDLE PROBABILITIES
        # =============================================

        try:

            if isinstance(result, float):

                return 1 if result >= 0.5 else 0

            if isinstance(result, str):

                result = result.strip().lower()

                return (
                    1
                    if result in {
                        "1",
                        "true",
                        "yes",
                        "approved",
                        "approve",
                        "pass",
                    }
                    else 0
                )

            return int(result)

        except Exception:
            return 0

    # =========================================================
    # COERCE FEATURES
    # =========================================================

    def _coerce_with_profile(
        self,
        features: Dict[str, Any],
        profile: ModelProfile,
        allow_strings: bool
    ) -> pd.DataFrame:

        row: Dict[str, Any] = {}

        active_specs: List[FeatureSpec] = []

        for spec in profile.features:

            if spec.id_column or not spec.use:
                continue

            active_specs.append(spec)

            raw = features.get(spec.name)

            if raw is None or raw == "":

                if spec.default is not None:
                    raw = spec.default
                else:
                    raw = 0

            val = raw

            try:

                if spec.dtype == "float":
                    val = float(val)

                elif spec.dtype == "int":
                    val = int(float(val))

                elif spec.dtype == "bool":

                    if isinstance(val, str):

                        val = (
                            val.strip().lower()
                            in {
                                "1",
                                "true",
                                "yes",
                            }
                        )

                    val = int(bool(val))

                elif spec.dtype == "category":

                    if spec.encoding:

                        key = str(val)

                        val = spec.encoding.get(
                            key,
                            0
                        )

                    else:

                        if allow_strings:
                            val = str(val)
                        else:
                            val = 0

                else:

                    val = (
                        str(val)
                        if allow_strings
                        else 0
                    )

            except Exception:

                val = 0

            row[spec.name] = val

        df = pd.DataFrame([row])

        cached_model = self._loaded_models.get(
            profile.model_id
        )

        if (
            cached_model is not None
            and hasattr(
                cached_model,
                "feature_names_in_"
            )
        ):

            for col in cached_model.feature_names_in_:

                if col not in df.columns:
                    df[col] = 0

        return df

    def run_statistical_governance(
        self,
        model_id: str,
        dataset_path: str,
        sensitive_feature: str,
        target_column: str,
        generate_synthetic: bool = False
    ) -> dict:
        """
        Runs statistical governance check on a model using mlmodel services.
        """
        try:
            import os
            from app.services.statistical.governance import run_governance, GovernanceRequest

            # Resolve model path
            model_path = os.path.join(self.model_dir, model_id)
            if not os.path.exists(model_path):
                fallbacks = [
                    os.path.join(self.project_dir, "uploads", "models", model_id),
                    os.path.join(self.project_dir, "uploads", model_id),
                    os.path.join(self.backend_dir, "uploaded_models", model_id),
                    os.path.join("uploaded_models", model_id),
                ]
                for fb in fallbacks:
                    if os.path.exists(fb):
                        model_path = fb
                        break

            # If the model_path is a directory, we need the 'extracted' subdirectory for statistical tools
            if os.path.isdir(model_path):
                extracted_path = os.path.join(model_path, "extracted")
                if os.path.exists(extracted_path):
                    model_path = extracted_path

            # If dataset path is provided as a filename, try to find it
            if dataset_path and not os.path.exists(dataset_path):
                dataset_fallbacks = [
                    os.path.join(self.project_dir, "uploads", "fairness_data", dataset_path),
                    os.path.join(self.project_dir, "uploads", dataset_path),
                    os.path.join("uploads", dataset_path),
                ]
                for dfb in dataset_fallbacks:
                    if os.path.exists(dfb):
                        dataset_path = dfb
                        break

            req = GovernanceRequest(
                model_path=model_path,
                dataset_path=dataset_path,
                target_column=target_column,
                sensitive_columns=[sensitive_feature],
                generate_synthetic=generate_synthetic
            )
            
            result = run_governance(req)
            return result
        except Exception as e:
            import traceback
            print(f"Error in run_statistical_governance: {e}")
            traceback.print_exc()
            return {
                "status": "failed",
                "error": str(e)
            }



model_service = ModelService()