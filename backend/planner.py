import re
from typing import Any

from backend.schemas import ActivityPlan, ItineraryItem, PlaceCandidate


def generate_plans(
    activity_candidates: list[PlaceCandidate],
    restaurant_candidates: list[PlaceCandidate],
    parsed_intent: dict[str, Any],
    max_plans: int = 3,
) -> tuple[list[PlaceCandidate], list[PlaceCandidate], list[ActivityPlan]]:
    ranked_activities = rank_candidates(
        activity_candidates,
        parsed_intent,
        keyword_field="activity_keywords",
    )
    ranked_restaurants = rank_candidates(
        restaurant_candidates,
        parsed_intent,
        keyword_field="restaurant_keywords",
    )

    plans = []
    for index, activity in enumerate(ranked_activities[:max_plans]):
        restaurant = ranked_restaurants[index % len(ranked_restaurants)]
        plan_score = round(((activity.score or 0) + (restaurant.score or 0)) / 2, 2)
        plans.append(_build_plan(activity, restaurant, parsed_intent, index, plan_score))

    return ranked_activities, ranked_restaurants, plans


def rank_candidates(
    candidates: list[PlaceCandidate],
    parsed_intent: dict[str, Any],
    keyword_field: str,
) -> list[PlaceCandidate]:
    scored = [
        candidate.model_copy(
            update={
                "score": score_candidate(candidate, parsed_intent, keyword_field),
                "reason": _append_score_reason(candidate.reason),
            }
        )
        for candidate in candidates
    ]
    return sorted(scored, key=lambda item: item.score or 0, reverse=True)


def score_candidate(
    candidate: PlaceCandidate,
    parsed_intent: dict[str, Any],
    keyword_field: str,
) -> float:
    distance_score = _score_distance(candidate.distance, parsed_intent)
    rating_score = _score_rating(candidate.rating)
    keyword_score = _score_keyword_match(candidate, parsed_intent.get(keyword_field))
    crowd_score = _score_crowd_fit(candidate, parsed_intent)
    budget_score = _score_budget_fit(candidate, parsed_intent)

    total = (
        distance_score * 0.35
        + rating_score * 0.25
        + keyword_score * 0.20
        + crowd_score * 0.10
        + budget_score * 0.10
    )
    return round(total, 2)


def _build_plan(
    activity: PlaceCandidate,
    restaurant: PlaceCandidate,
    parsed_intent: dict[str, Any],
    index: int,
    score: float,
) -> ActivityPlan:
    title_prefixes = ["推荐方案", "备选方案", "轻量方案"]
    title = f"{title_prefixes[index] if index < len(title_prefixes) else '方案'}：{activity.name} + {restaurant.name}"

    return ActivityPlan(
        title=title,
        summary=_build_summary(activity, restaurant, parsed_intent),
        estimated_cost=_estimate_cost(parsed_intent),
        estimated_duration="约 3-4 小时",
        activity_place=activity,
        restaurant=restaurant,
        itinerary=[
            ItineraryItem(
                time="14:00",
                title="从出发地前往活动地点",
                description=f"前往 {activity.name}，距离参考：{activity.distance}，评分：{activity.rating or '暂无'}。",
            ),
            ItineraryItem(
                time="14:30",
                title="活动地点游玩",
                description=_activity_description(parsed_intent),
            ),
            ItineraryItem(
                time="16:30",
                title="前往附近餐厅",
                description=f"前往 {restaurant.name}，距离参考：{restaurant.distance}，评分：{restaurant.rating or '暂无'}。",
            ),
            ItineraryItem(
                time="17:30",
                title="结束并返程",
                description="保留机动时间，现场排队或同行人疲劳时可以提前结束。",
            ),
        ],
        tips=[
            f"方案综合分：{score}",
            f"活动地点分：{activity.score or 0}",
            f"餐厅分：{restaurant.score or 0}",
            "分数由距离、评分、关键词匹配、人群适配和预算适配综合计算。",
        ],
        score=score,
    )


def _score_distance(distance: str, parsed_intent: dict[str, Any]) -> float:
    meters = _parse_distance_to_meters(distance)
    if meters is None:
        return 50

    preference = parsed_intent.get("distance_preference")
    if preference in ["very_near", "nearby"]:
        if meters <= 800:
            return 100
        if meters <= 1500:
            return 85
        if meters <= 3000:
            return 65
        return 35

    if meters <= 1500:
        return 95
    if meters <= 3000:
        return 80
    if meters <= 5000:
        return 60
    return 40


def _score_rating(rating: str | None) -> float:
    if not rating:
        return 60
    try:
        value = float(rating)
    except ValueError:
        return 60
    return max(0, min(value / 5 * 100, 100))


def _score_keyword_match(
    candidate: PlaceCandidate,
    keywords: Any,
) -> float:
    if not keywords:
        return 60
    if isinstance(keywords, str):
        keywords = [keywords]

    text = f"{candidate.name} {candidate.category} {candidate.reason}".lower()
    hits = 0
    for keyword in keywords:
        keyword_text = str(keyword).lower()
        if keyword_text and keyword_text in text:
            hits += 1

    if hits == 0:
        return 55
    return min(100, 70 + hits * 15)


def _score_crowd_fit(candidate: PlaceCandidate, parsed_intent: dict[str, Any]) -> float:
    text = f"{candidate.name} {candidate.category}".lower()
    has_children = parsed_intent.get("has_children") is True
    preferences = parsed_intent.get("activity_preferences") or []

    score = 60
    if has_children and any(word in text for word in ["亲子", "儿童", "乐园", "公园"]):
        score += 25
    if "photo" in preferences and any(word in text for word in ["景点", "公园", "展览", "咖啡"]):
        score += 15
    if "chat" in preferences and any(word in text for word in ["咖啡", "餐厅", "商场", "公园"]):
        score += 15
    return min(score, 100)


def _score_budget_fit(candidate: PlaceCandidate, parsed_intent: dict[str, Any]) -> float:
    budget = parsed_intent.get("budget")
    text = f"{candidate.name} {candidate.category}".lower()

    if budget == "low":
        if any(word in text for word in ["小吃", "简餐", "面", "公园"]):
            return 95
        if any(word in text for word in ["高端", "精品", "西餐"]):
            return 45
        return 70

    if budget == "high":
        return 80

    return 75


def _parse_distance_to_meters(distance: str) -> float | None:
    if not distance:
        return None

    text = distance.replace(" ", "")
    km_match = re.search(r"([\d.]+)km", text, flags=re.IGNORECASE)
    if km_match:
        return float(km_match.group(1)) * 1000

    meter_match = re.search(r"([\d.]+)m", text, flags=re.IGNORECASE)
    if meter_match:
        return float(meter_match.group(1))

    return None


def _append_score_reason(reason: str) -> str:
    if "已按距离" in reason:
        return reason
    return f"{reason} 已按距离、评分和偏好打分排序。"


def _build_summary(
    activity: PlaceCandidate,
    restaurant: PlaceCandidate,
    parsed_intent: dict[str, Any],
) -> str:
    people_count = parsed_intent.get("people_count")
    people_text = f"{people_count}人" if people_count else "同行人"
    return (
        f"适合{people_text}的半日安排：先去 {activity.name} 放松活动，"
        f"再去 {restaurant.name} 就近用餐。"
    )


def _estimate_cost(parsed_intent: dict[str, Any]) -> str:
    budget = parsed_intent.get("budget")
    if budget == "low":
        return "人均约 30-80 元"
    if budget == "high":
        return "人均约 120-300 元"
    return "人均约 50-120 元"


def _activity_description(parsed_intent: dict[str, Any]) -> str:
    preferences = parsed_intent.get("activity_preferences") or []
    parts = []
    if parsed_intent.get("has_children"):
        parts.append("照顾儿童体力，避免强度太高")
    if "photo" in preferences:
        parts.append("预留拍照时间")
    if "chat" in preferences:
        parts.append("选择方便聊天的节奏")
    if not parts:
        parts.append("保持轻松节奏")
    return "，".join(parts) + "。"
