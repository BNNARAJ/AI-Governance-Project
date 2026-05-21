# app/governance.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import os
import pandas as pd
import numpy as np

from .inspector import (
    find_model_files,
    parse_mlmodel,
    inspect_model,
    find_reference_dataset
)

from .utils import (
    load_model,
    sanitize_for_json,
    validate_sensitive_features,
    align_features_to_model
)

from .synthetic_data import (
    generate_synthetic_dataset,
    generate_synthetic_dataset_from_reference,
    generate_synthetic_target,
    save_synthetic_dataset
)

from .metrics import (
    run_all_metrics,
    generate_predictions
)

from .fairness import (
    run_multi_fairness_analysis
)

from .dataset_utils import (
    resolve_model_feature_names,
    infer_target_column,
    resolve_sensitive_column,
    ensure_sensitive_column,
    prepare_uploaded_dataset,
    build_audit_dataset_preview,
)

from .synthetic_data import ensure_binary_labels

from .reports import (
    generate_governance_summary
)

# ---------------------------------------------------
# ROUTER
# ---------------------------------------------------

router = APIRouter()

# ---------------------------------------------------
# REQUEST SCHEMA
# ---------------------------------------------------

class GovernanceRequest(BaseModel):

    # Extracted uploaded model path
    model_path: str

    # Optional dataset path
    dataset_path: str | None = None

    # Target column
    target_column: str

    # Sensitive columns
    sensitive_columns: list[str]

    # Generate synthetic dataset
    generate_synthetic: bool = False

    # Synthetic rows
    synthetic_rows: int = 1000


# ---------------------------------------------------
# RUN GOVERNANCE
# ---------------------------------------------------

@router.post("/run-governance")
def run_governance(
    request: GovernanceRequest
):

    try:

        # ---------------------------------------------------
        # FIND MODEL ARTIFACTS
        # ---------------------------------------------------

        artifacts = find_model_files(
            request.model_path
        )

        # ---------------------------------------------------
        # PARSE MLMODEL
        # ---------------------------------------------------

        metadata = parse_mlmodel(
            artifacts["mlmodel"]
        )

        # ---------------------------------------------------
        # LOAD MODEL
        # ---------------------------------------------------

        loaded = load_model(
            artifacts
        )

        model = loaded["model"]

        # ---------------------------------------------------
        # INSPECT MODEL
        # ---------------------------------------------------

        inspection = inspect_model(
            model,
            metadata,
            model_path=request.model_path,
        )

        model_task_type = inspection.get(
            "model_type",
            "unknown"
        )

        feature_names = resolve_model_feature_names(
            model=model,
            metadata=metadata,
            model_path=request.model_path,
            inspection=inspection,
        )
        inspection["feature_names"] = feature_names
        inspection["total_features"] = len(feature_names)

        resolved_target_column = request.target_column
        resolved_sensitive_columns = list(request.sensitive_columns)

        # ---------------------------------------------------
        # DATASET HANDLING
        # ---------------------------------------------------

        if request.generate_synthetic:

            if len(feature_names) == 0:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Feature names could not "
                        "be extracted from model. "
                        "Add schema.json or sample_input.csv "
                        "to the MLflow bundle."
                    )
                )

            # ---------------------------------------------
            # TRY FINDING REFERENCE DATASET
            # ---------------------------------------------

            reference_dataset_path = (
                find_reference_dataset(
                    artifacts
                )
            )

            # ---------------------------------------------
            # GENERATE FROM REFERENCE
            # ---------------------------------------------

            if reference_dataset_path:

                reference_df = pd.read_csv(
                    reference_dataset_path
                )

                df = (
                    generate_synthetic_dataset_from_reference(

                        reference_df=
                            reference_df,

                        feature_names=
                            feature_names,

                        rows=
                            request.synthetic_rows
                    )
                )

            # ---------------------------------------------
            # GENERATE BASIC SYNTHETIC
            # ---------------------------------------------

            else:

                df = generate_synthetic_dataset(

                    feature_names=
                        feature_names,

                    target_column=
                        request.target_column,

                    rows=
                        request.synthetic_rows
                )

            # ---------------------------------------------
            # ENSURE SENSITIVE FEATURES EXIST
            # ---------------------------------------------

            try:
                sensitive_col = resolve_sensitive_column(
                    df,
                    hints=request.sensitive_columns,
                    inspection_candidates=inspection.get(
                        "sensitive_feature_candidates",
                        [],
                    ),
                )
            except ValueError:
                sensitive_col = request.sensitive_columns[0] if request.sensitive_columns else "sensitive_group"

            df, sensitive_col = ensure_sensitive_column(
                df,
                sensitive_col,
                hints=request.sensitive_columns,
                model_features=feature_names,
            )
            resolved_sensitive_columns = [sensitive_col]

            # ---------------------------------------------
            # ALIGN FEATURES + SYNTHETIC TARGET
            # ---------------------------------------------

            aligned_df, _ = align_features_to_model(
                model,
                df,
            )

            resolved_target_column = request.target_column or "approved"

            synthetic_target = generate_synthetic_target(
                model=model,
                X=aligned_df,
                task_type=model_task_type,
            )

            df = aligned_df.copy()
            df[resolved_target_column] = synthetic_target.values

            if sensitive_col not in df.columns and sensitive_col in aligned_df.columns:
                pass
            elif sensitive_col not in df.columns:
                df, sensitive_col = ensure_sensitive_column(
                    df,
                    sensitive_col,
                    hints=request.sensitive_columns,
                )
                resolved_sensitive_columns = [sensitive_col]
            # ---------------------------------------------
            # SAVE GENERATED DATASET
            # ---------------------------------------------

            synthetic_dataset_path = (
                f"generated_{resolved_target_column}.csv"
            )

            save_synthetic_dataset(
                df,
                synthetic_dataset_path
            )

        # ---------------------------------------------------
        # USE UPLOADED DATASET
        # ---------------------------------------------------

        else:

            if not request.dataset_path:

                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Dataset path required "
                        "when synthetic generation "
                        "is disabled"
                    )
                )

            if not os.path.exists(
                request.dataset_path
            ):

                raise HTTPException(
                    status_code=404,
                    detail="Dataset not found"
                )

            raw_df = pd.read_csv(
                request.dataset_path
            )

            try:
                df, resolved_target_column, sensitive_col = prepare_uploaded_dataset(
                    raw_df,
                    target_column=request.target_column,
                    sensitive_column=(
                        request.sensitive_columns[0]
                        if request.sensitive_columns
                        else "gender"
                    ),
                    hints=request.sensitive_columns,
                )
                resolved_sensitive_columns = [sensitive_col]
            except ValueError as dataset_error:
                raise HTTPException(
                    status_code=400,
                    detail=str(dataset_error),
                )

        # ---------------------------------------------------
        # VALIDATE TARGET
        # ---------------------------------------------------

        if resolved_target_column not in df.columns:

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Target column "
                    f"'{resolved_target_column}' "
                    f"not found"
                )
            )

        # ---------------------------------------------------
        # VALIDATE SENSITIVE FEATURES
        # ---------------------------------------------------

        validate_sensitive_features(
            df,
            resolved_sensitive_columns
        )

        # ---------------------------------------------------
        # DETERMINE METRICS
        # ---------------------------------------------------

        deterministic_metrics = (
            run_all_metrics(

                model=model,

                df=df,

                target_column=
                    resolved_target_column
            )
        )

        # ---------------------------------------------------
        # GENERATE PREDICTIONS
        # ---------------------------------------------------

        prediction_results = (
            generate_predictions(

                model=model,

                df=df,

                target_column=
                    resolved_target_column
            )
        )

        y_true = prediction_results[
            "y_true"
        ]

        y_pred = prediction_results[
            "y_pred"
        ]

        task_type = prediction_results[
            "task_type"
        ]

        if task_type in (
            "binary_classification",
            "multiclass_classification",
            "classification",
        ):
            y_true = ensure_binary_labels(y_true)
            y_pred = ensure_binary_labels(y_pred)

        audit_preview = build_audit_dataset_preview(
            df=df,
            y_true=y_true,
            y_pred=y_pred,
            sensitive_column=resolved_sensitive_columns[0],
            limit=10,
        )

        # ---------------------------------------------------
        # FAIRNESS ANALYSIS
        # ---------------------------------------------------

        fairness_metrics = (
            run_multi_fairness_analysis(

                df=df,

                y_true=y_true,

                y_pred=y_pred,

                sensitive_columns=
                    resolved_sensitive_columns
            )
        )

        # ---------------------------------------------------
        # GOVERNANCE SUMMARY
        # ---------------------------------------------------

        governance_summary = (
            generate_governance_summary(

                deterministic_metrics,

                fairness_metrics
            )
        )

        # ---------------------------------------------------
        # EXTRA INSPECTION INFO
        # ---------------------------------------------------

        inspection[
            "loaded_model_format"
        ] = loaded[
            "model_format"
        ]

        inspection[
            "loaded_model_path"
        ] = loaded[
            "model_path"
        ]

        inspection[
            "evaluated_task_type"
        ] = task_type

        # ---------------------------------------------------
        # RESPONSE
        # ---------------------------------------------------

        response_payload = {

            "status":
                "success",

            "dataset_type":

                "synthetic"

                if request.generate_synthetic

                else "uploaded",

            "synthetic_rows":

                request.synthetic_rows

                if request.generate_synthetic

                else None,

            "evaluated_rows": len(df),

            "preview_row_limit": 10,

            "preview_row_count": len(audit_preview),

            "model_metadata":
                metadata,

            "model_inspection":
                inspection,

            "target_column":
                resolved_target_column,

            "sensitive_columns":
                resolved_sensitive_columns,

            "deterministic_metrics":
                deterministic_metrics,

            "fairness_metrics":
                fairness_metrics,

            "dataset_preview":
                audit_preview,

            "raw_dataset_preview":
                df.head(10).to_dict(
                    orient="records"
                ),

            "governance_summary":
                governance_summary
        }

        return sanitize_for_json(
            response_payload
        )

    # ---------------------------------------------------
    # HTTP ERRORS
    # ---------------------------------------------------

    except HTTPException as http_error:

        raise http_error

    # ---------------------------------------------------
    # GENERAL ERRORS
    # ---------------------------------------------------

    except Exception as error:

        raise HTTPException(

            status_code=500,

            detail=str(error)
        )