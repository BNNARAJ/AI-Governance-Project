from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


FeatureDType = Literal["float", "int", "bool", "category", "string"]


class FeatureSpec(BaseModel):
    name: str
    use: bool = True
    id_column: bool = False
    dtype: FeatureDType = "float"
    required: bool = False
    default: Optional[Any] = None

    # For categorical values, you can either specify allowed_values (kept as-is)
    # or an explicit encoding mapping for coercion to numeric.
    allowed_values: Optional[List[Any]] = None
    encoding: Optional[Dict[str, Any]] = None

    min: Optional[float] = None
    max: Optional[float] = None


class ModelProfile(BaseModel):
    version: int = 1
    model_id: str
    features: List[FeatureSpec] = Field(default_factory=list)

