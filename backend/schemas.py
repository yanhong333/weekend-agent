from typing import Any

from pydantic import BaseModel, Field


class PlanRequest(BaseModel):
    user_input: str = Field(..., min_length=1, description="User's natural language need")
    start_location: str = Field(..., min_length=1, description="Departure location")


class PlaceCandidate(BaseModel):
    name: str
    category: str
    address: str
    distance: str
    reason: str
    location: str | None = None
    rating: str | None = None
    source: str | None = None
    score: float | None = None


class ItineraryItem(BaseModel):
    time: str
    title: str
    description: str


class ActivityPlan(BaseModel):
    title: str
    summary: str
    estimated_cost: str
    estimated_duration: str
    activity_place: PlaceCandidate
    restaurant: PlaceCandidate
    itinerary: list[ItineraryItem]
    tips: list[str]
    score: float | None = None


class PlanResponse(BaseModel):
    status: str
    message: str
    parsed_intent: dict[str, Any]
    activity_candidates: list[PlaceCandidate]
    restaurant_candidates: list[PlaceCandidate]
    plans: list[ActivityPlan]


class LocationResolveRequest(BaseModel):
    latitude: float = Field(..., description="Browser GPS latitude")
    longitude: float = Field(..., description="Browser GPS longitude")


class LocationResolveResponse(BaseModel):
    status: str
    city: str
    district: str | None = None
    adcode: str | None = None
    formatted_address: str | None = None
    location: str | None = None
    weather: dict[str, Any] = Field(default_factory=dict)
    message: str | None = None


class AmapJsConfigResponse(BaseModel):
    enabled: bool
    js_api_key: str = ""
    security_js_code: str = ""
