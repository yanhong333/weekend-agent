from typing import Any

from backend.amap_client import geocode_address, search_poi_around
from backend.schemas import PlaceCandidate


DEFAULT_ACTIVITY_KEYWORDS = ["公园", "商场", "展览", "亲子乐园", "咖啡馆"]
DEFAULT_RESTAURANT_KEYWORDS = ["餐厅", "轻食", "健康餐", "简餐"]

KEYWORD_TRANSLATIONS = {
    "park": "公园",
    "children playground": "亲子乐园",
    "playground": "亲子乐园",
    "mall": "商场",
    "shopping mall": "商场",
    "exhibition": "展览",
    "museum": "博物馆",
    "scenic spot": "景点",
    "photo spot": "拍照打卡",
    "cafe": "咖啡馆",
    "coffee": "咖啡馆",
    "light food": "轻食",
    "healthy food": "健康餐",
    "healthy restaurant": "健康餐",
    "salad": "沙拉",
    "cheap eats": "小吃",
    "snack": "小吃",
    "casual dining": "餐厅",
    "family restaurant": "家庭餐厅",
}


def resolve_start_location(start_location: str) -> dict[str, Any]:
    geocode = geocode_address(start_location)
    return {
        "formatted_address": geocode.get("formatted_address") or start_location,
        "location": geocode.get("location"),
        "city": geocode.get("city"),
        "district": geocode.get("district"),
    }


def search_activity_places(
    start_location_point: str,
    parsed_intent: dict[str, Any],
    limit: int = 6,
) -> list[PlaceCandidate]:
    keywords = _normalize_keywords(
        parsed_intent.get("activity_keywords"),
        DEFAULT_ACTIVITY_KEYWORDS,
    )
    pois = _search_by_keywords(start_location_point, keywords, limit=limit)
    return [
        _poi_to_candidate(
            poi,
            default_category="活动地点",
            reason="匹配用户活动偏好，且在出发位置附近。",
        )
        for poi in pois
    ]


def search_restaurants(
    start_location_point: str,
    parsed_intent: dict[str, Any],
    limit: int = 6,
) -> list[PlaceCandidate]:
    keywords = _normalize_keywords(
        parsed_intent.get("restaurant_keywords"),
        DEFAULT_RESTAURANT_KEYWORDS,
    )
    pois = _search_by_keywords(
        start_location_point,
        keywords,
        limit=limit,
        poi_types="050000",
    )
    return [
        _poi_to_candidate(
            poi,
            default_category="餐厅",
            reason="匹配用户饮食、预算或同行人需求，且距离较近。",
        )
        for poi in pois
    ]


def _search_by_keywords(
    location: str,
    keywords: list[str],
    limit: int,
    poi_types: str | None = None,
) -> list[dict[str, Any]]:
    seen_ids = set()
    results = []

    for keyword in keywords:
        pois = search_poi_around(
            location=location,
            keywords=keyword,
            types=poi_types,
            radius=5000,
            page_size=min(limit, 10),
        )
        for poi in pois:
            poi_id = poi.get("id") or f"{poi.get('name')}:{poi.get('location')}"
            if poi_id in seen_ids:
                continue
            seen_ids.add(poi_id)
            results.append(poi)
            if len(results) >= limit:
                return results

    return results


def _poi_to_candidate(
    poi: dict[str, Any],
    default_category: str,
    reason: str,
) -> PlaceCandidate:
    business = poi.get("business") or {}
    rating = business.get("rating") or poi.get("biz_ext", {}).get("rating")

    return PlaceCandidate(
        name=str(poi.get("name") or "未知地点"),
        category=str(poi.get("type") or default_category),
        address=_stringify_address(poi.get("address")),
        distance=_format_distance(poi.get("distance")),
        reason=reason,
        location=poi.get("location"),
        rating=str(rating) if rating else None,
        source="amap",
    )


def _normalize_keywords(value: Any, fallback: list[str]) -> list[str]:
    if not value:
        return fallback
    if isinstance(value, str):
        return [_translate_keyword(value)]
    if isinstance(value, list):
        cleaned = [_translate_keyword(str(item)) for item in value if str(item).strip()]
        return cleaned or fallback
    return fallback


def _translate_keyword(keyword: str) -> str:
    normalized = keyword.strip()
    return KEYWORD_TRANSLATIONS.get(normalized.lower(), normalized)


def _stringify_address(address: Any) -> str:
    if isinstance(address, list):
        return " ".join(str(item) for item in address if item)
    if address:
        return str(address)
    return "地址待确认"


def _format_distance(distance: Any) -> str:
    if distance in (None, ""):
        return "距离待确认"

    try:
        meters = float(distance)
    except (TypeError, ValueError):
        return str(distance)

    if meters >= 1000:
        return f"约 {meters / 1000:.1f} km"
    return f"约 {int(meters)} m"
