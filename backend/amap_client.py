from typing import Any

import requests

from backend.config import AMAP_KEY


AMAP_V3_BASE_URL = "https://restapi.amap.com/v3"
AMAP_V5_BASE_URL = "https://restapi.amap.com/v5"


def geocode_address(address: str, city: str | None = None) -> dict[str, Any]:
    if not AMAP_KEY:
        raise RuntimeError("AMAP_KEY is missing in .env")

    params = {
        "key": AMAP_KEY,
        "address": address,
    }
    if city:
        params["city"] = city

    data = _get_json(f"{AMAP_V3_BASE_URL}/geocode/geo", params=params)
    geocodes = data.get("geocodes", [])
    if not geocodes:
        raise RuntimeError(f"AMap geocode returned no result for address: {address}")
    return geocodes[0]


def search_poi_around(
    location: str,
    keywords: str,
    types: str | None = None,
    radius: int = 5000,
    page_size: int = 10,
    page_num: int = 1,
) -> list[dict[str, Any]]:
    if not AMAP_KEY:
        raise RuntimeError("AMAP_KEY is missing in .env")

    params = {
        "key": AMAP_KEY,
        "location": location,
        "keywords": keywords,
        "radius": radius,
        "page_size": page_size,
        "page_num": page_num,
        "show_fields": "business,photos",
    }
    if types:
        params["types"] = types

    data = _get_json(f"{AMAP_V5_BASE_URL}/place/around", params=params)
    return data.get("pois", [])


def driving_route(origin: str, destination: str) -> dict[str, Any]:
    if not AMAP_KEY:
        raise RuntimeError("AMAP_KEY is missing in .env")

    params = {
        "key": AMAP_KEY,
        "origin": origin,
        "destination": destination,
        "strategy": 0,
    }

    return _get_json(f"{AMAP_V3_BASE_URL}/direction/driving", params=params)


def _get_json(url: str, params: dict[str, Any]) -> dict[str, Any]:
    response = requests.get(url, params=params, timeout=15)
    response.raise_for_status()
    data = response.json()

    if data.get("status") != "1":
        info = data.get("info") or "unknown error"
        infocode = data.get("infocode") or "unknown infocode"
        raise RuntimeError(f"AMap API failed: {info} ({infocode})")

    return data
