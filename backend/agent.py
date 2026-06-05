from typing import Any

from backend.deepseek_client import parse_user_intent
from backend.schemas import (
    ActivityPlan,
    ItineraryItem,
    PlaceCandidate,
    PlanRequest,
    PlanResponse,
)
from backend.tools import (
    resolve_start_location,
    search_activity_places,
    search_restaurants,
)


def build_plan(request: PlanRequest) -> PlanResponse:
    parsed_intent = _parse_intent_with_fallback(request)
    activity_candidates, restaurant_candidates = _search_places_with_fallback(
        request,
        parsed_intent,
    )
    plans = _build_simple_plans(activity_candidates, restaurant_candidates, parsed_intent)

    return PlanResponse(
        status="success",
        message="Plan generated with DeepSeek intent parsing and AMap place search.",
        parsed_intent=parsed_intent,
        activity_candidates=activity_candidates,
        restaurant_candidates=restaurant_candidates,
        plans=plans,
    )


def build_mock_plan(request: PlanRequest) -> PlanResponse:
    return build_plan(request)


def _parse_intent_with_fallback(request: PlanRequest) -> dict[str, Any]:
    try:
        return parse_user_intent(request.user_input, request.start_location)
    except Exception as exc:
        fallback = _fallback_parse_intent(request.user_input, request.start_location)
        fallback["parse_source"] = "fallback"
        fallback["parse_error"] = str(exc)
        return fallback


def _search_places_with_fallback(
    request: PlanRequest,
    parsed_intent: dict[str, Any],
) -> tuple[list[PlaceCandidate], list[PlaceCandidate]]:
    try:
        start = resolve_start_location(request.start_location)
        parsed_intent["resolved_start_location"] = start

        start_point = start.get("location")
        if not start_point:
            raise RuntimeError("AMap geocode result has no location")

        activity_candidates = search_activity_places(start_point, parsed_intent)
        restaurant_candidates = search_restaurants(start_point, parsed_intent)

        if not activity_candidates:
            activity_candidates = _mock_activity_candidates(parsed_intent)
        if not restaurant_candidates:
            restaurant_candidates = _mock_restaurant_candidates(parsed_intent)

        parsed_intent["map_source"] = "amap"
        return activity_candidates, restaurant_candidates

    except Exception as exc:
        parsed_intent["map_source"] = "fallback"
        parsed_intent["map_error"] = str(exc)
        return _mock_activity_candidates(parsed_intent), _mock_restaurant_candidates(
            parsed_intent
        )


def _fallback_parse_intent(user_input: str, start_location: str) -> dict[str, Any]:
    has_children = any(word in user_input for word in ["孩子", "小孩", "儿童", "亲子"])
    wants_photo = any(word in user_input for word in ["拍照", "出片", "照片"])
    wants_chat = any(word in user_input for word in ["聊天", "坐坐", "朋友"])
    wants_healthy = any(word in user_input for word in ["减肥", "健康", "轻食", "低脂"])
    low_budget = any(word in user_input for word in ["别太贵", "便宜", "预算低", "省钱"])

    activity_keywords = ["公园", "商场"]
    if has_children:
        activity_keywords.insert(0, "亲子乐园")
    if wants_photo:
        activity_keywords.insert(0, "拍照打卡")
    if wants_chat:
        activity_keywords.append("咖啡馆")

    restaurant_keywords = ["餐厅"]
    if wants_healthy:
        restaurant_keywords = ["轻食", "健康餐", "沙拉"]
    elif low_budget:
        restaurant_keywords = ["小吃", "简餐"]

    return {
        "raw_text": user_input,
        "start_location": start_location,
        "time_preference": "today afternoon" if "下午" in user_input else "unknown",
        "people_count": _guess_people_count(user_input),
        "companions": _guess_companions(user_input),
        "has_children": has_children,
        "children_ages": _guess_children_ages(user_input),
        "budget": "low" if low_budget else "medium",
        "distance_preference": "nearby"
        if any(word in user_input for word in ["别太远", "附近", "近一点"])
        else "unknown",
        "dietary_restrictions": ["weight_loss", "light_food"] if wants_healthy else [],
        "activity_preferences": _guess_activity_preferences(
            has_children=has_children,
            wants_photo=wants_photo,
            wants_chat=wants_chat,
        ),
        "activity_keywords": activity_keywords,
        "restaurant_keywords": restaurant_keywords,
        "notes": "Local fallback parser result.",
    }


def _guess_people_count(user_input: str) -> int | None:
    if "老婆" in user_input and ("孩子" in user_input or "小孩" in user_input):
        return 3
    if "4 个朋友" in user_input or "4个朋友" in user_input or "四个朋友" in user_input:
        return 5
    if "朋友" in user_input:
        return 2
    return None


def _guess_companions(user_input: str) -> list[str]:
    companions = []
    if "老婆" in user_input or "妻子" in user_input:
        companions.append("spouse")
    if "朋友" in user_input:
        companions.append("friends")
    if "孩子" in user_input or "小孩" in user_input:
        companions.append("child")
    return companions


def _guess_children_ages(user_input: str) -> list[int]:
    if "5 岁" in user_input or "5岁" in user_input or "五岁" in user_input:
        return [5]
    return []


def _guess_activity_preferences(
    has_children: bool,
    wants_photo: bool,
    wants_chat: bool,
) -> list[str]:
    preferences = ["relaxed"]
    if has_children:
        preferences.append("parent_child")
    if wants_photo:
        preferences.append("photo")
    if wants_chat:
        preferences.append("chat")
    return preferences


def _mock_activity_candidates(parsed_intent: dict[str, Any]) -> list[PlaceCandidate]:
    keywords = parsed_intent.get("activity_keywords") or ["公园", "商场"]
    first_keyword = str(keywords[0]) if keywords else "公园"

    return [
        PlaceCandidate(
            name=f"示例{first_keyword}活动点",
            category="活动地点",
            address="出发地附近 2 公里内",
            distance="约 2.0 km",
            reason="高德搜索不可用时的兜底活动候选。",
            source="mock",
        ),
        PlaceCandidate(
            name="示例城市公园",
            category="户外休闲",
            address="出发地附近 3 公里内",
            distance="约 3.0 km",
            reason="适合半日下午放松、散步、聊天和拍照。",
            source="mock",
        ),
    ]


def _mock_restaurant_candidates(parsed_intent: dict[str, Any]) -> list[PlaceCandidate]:
    keywords = parsed_intent.get("restaurant_keywords") or ["餐厅"]
    first_keyword = str(keywords[0]) if keywords else "餐厅"

    return [
        PlaceCandidate(
            name=f"示例{first_keyword}餐厅",
            category="餐饮",
            address="活动地点附近",
            distance="约 600 m",
            reason="高德搜索不可用时的兜底餐厅候选。",
            source="mock",
        ),
        PlaceCandidate(
            name="示例家庭简餐",
            category="简餐",
            address="活动地点附近",
            distance="约 900 m",
            reason="适合多人或家庭用餐，价格和时间都比较可控。",
            source="mock",
        ),
    ]


def _build_simple_plans(
    activity_candidates: list[PlaceCandidate],
    restaurant_candidates: list[PlaceCandidate],
    parsed_intent: dict[str, Any],
) -> list[ActivityPlan]:
    activity = activity_candidates[0]
    restaurant = restaurant_candidates[0]
    parse_source = parsed_intent.get("parse_source", "unknown")
    map_source = parsed_intent.get("map_source", "unknown")

    return [
        ActivityPlan(
            title="半日本地活动方案",
            summary="先安排轻松活动，再就近用餐，保证路线短、节奏稳。",
            estimated_cost="人均约 50-120 元",
            estimated_duration="约 3-4 小时",
            activity_place=activity,
            restaurant=restaurant,
            itinerary=[
                ItineraryItem(
                    time="14:00",
                    title="从出发地前往活动地点",
                    description=f"前往 {activity.name}，距离参考：{activity.distance}。",
                ),
                ItineraryItem(
                    time="14:30",
                    title="活动地点游玩",
                    description="根据同行人和偏好控制节奏，优先选择轻松、可聊天、可拍照的活动。",
                ),
                ItineraryItem(
                    time="16:30",
                    title="前往附近餐厅",
                    description=f"前往 {restaurant.name}，距离参考：{restaurant.distance}。",
                ),
                ItineraryItem(
                    time="17:30",
                    title="结束并返程",
                    description="半日行程不要排太满，方便根据现场情况调整。",
                ),
            ],
            tips=[
                f"意图解析来源：{parse_source}",
                f"地点搜索来源：{map_source}",
                "下一阶段会加入 Planner 打分排序和更完整的路线判断。",
            ],
        )
    ]
