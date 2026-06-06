from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.agent import build_plan
from backend.amap_client import convert_gps_to_amap, get_weather, reverse_geocode
from backend.config import AMAP_JS_KEY, AMAP_SECURITY_JS_CODE
from backend.schemas import (
    AmapJsConfigResponse,
    LocationResolveRequest,
    LocationResolveResponse,
    PlanRequest,
    PlanResponse,
)


app = FastAPI(
    title="WeekendPilot API",
    description="Local activity planning agent backend.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root() -> dict[str, str]:
    return {
        "name": "WeekendPilot",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/plan", response_model=PlanResponse)
def create_plan(request: PlanRequest) -> PlanResponse:
    return build_plan(request)


@app.get("/api/amap/js-config", response_model=AmapJsConfigResponse)
def get_amap_js_config() -> AmapJsConfigResponse:
    return AmapJsConfigResponse(
        enabled=bool(AMAP_JS_KEY),
        js_api_key=AMAP_JS_KEY,
        security_js_code=AMAP_SECURITY_JS_CODE,
    )


@app.post("/api/location/resolve", response_model=LocationResolveResponse)
def resolve_location(request: LocationResolveRequest) -> LocationResolveResponse:
    try:
        amap_location = convert_gps_to_amap(request.longitude, request.latitude)
        regeocode = reverse_geocode(amap_location)
        component = regeocode.get("addressComponent", {})
        city_value = component.get("city")
        city = city_value if isinstance(city_value, str) and city_value else component.get("province", "")
        district = component.get("district") or None
        adcode = component.get("adcode") or None
        weather = get_weather(adcode or city) if (adcode or city) else {}

        return LocationResolveResponse(
            status="success",
            city=city or district or "当前位置",
            district=district,
            adcode=adcode,
            formatted_address=regeocode.get("formatted_address") or None,
            location=amap_location,
            weather=weather,
        )
    except Exception as exc:
        return LocationResolveResponse(
            status="error",
            city="定位城市",
            location=f"{request.longitude},{request.latitude}",
            message=str(exc),
        )
