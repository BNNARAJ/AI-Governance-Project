import joblib
import pandas as pd
import os
import sys

model_path = r"c:\Users\bnnar\Desktop\AI Governance Project\uploads\models\model.pkl"

if not os.path.exists(model_path):
    print(f"Model not found at {model_path}")
    sys.exit(1)

try:
    model = joblib.load(model_path)
except Exception as e:
    import pickle
    with open(model_path, "rb") as f:
        model = pickle.load(f)

print(f"Model Type: {type(model)}")

if hasattr(model, "feature_names_in_"):
    print(f"Feature Names: {model.feature_names_in_.tolist()}")
    print(f"Number of Features: {len(model.feature_names_in_)}")
elif hasattr(model, "n_features_in_"):
    print(f"Number of Features: {model.n_features_in_}")

# Try a sample prediction if we can guess the shapes
if hasattr(model, "predict"):
    print("Model has predict method.")
    # Try with dummy data if we know the shape
    if hasattr(model, "n_features_in_"):
        import numpy as np
        X = np.zeros((1, model.n_features_in_))
        try:
            pred = model.predict(X)
            print(f"Sample Prediction (zeros): {pred}")
        except Exception as e:
            print(f"Prediction Error (zeros): {e}")

if hasattr(model, "steps"):
    print("Pipeline Steps:")
    for name, step in model.steps:
        print(f" - {name}: {type(step)}")
