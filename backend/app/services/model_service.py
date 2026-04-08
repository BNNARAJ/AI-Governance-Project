import os
import pickle
import joblib
import pandas as pd
from typing import List, Dict, Optional, Any
import traceback

class ModelService:
    def __init__(self):
        # Look for model directories relative to the app root
        self.backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.project_dir = os.path.dirname(self.backend_dir)
        self.model_dir = os.path.join(self.project_dir, "uploads", "models")
        os.makedirs(self.model_dir, exist_ok=True)
        self._loaded_models: Dict[str, Any] = {}

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
        
        # Convert features to DataFrame
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

        # Final check: Ensure no strings are passed to the model (common crash)
        for col in df.columns:
            if df[col].dtype == object and isinstance(df[col].iloc[0], str):
                 # Try to convert to numeric, or fill with 0 if it fails
                 df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        prediction = model.predict(df)
        
        # Convert numpy types to native python
        if hasattr(prediction, "tolist"):
            prediction = prediction.tolist()
            
        return prediction[0] if isinstance(prediction, list) else prediction

model_service = ModelService()
