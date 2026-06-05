from backend.schemas import (
    ActivityPlan,
    ItineraryItem,
    PlaceCandidate,
    PlanRequest,
    PlanResponse,
)


def build_mock_plan(request: PlanRequest) -> PlanResponse:
    """Stage 1 mock flow: prove that the API contract works end to end."""
    parsed_intent = {
        "raw_text": request.user_input,
        "start_location": request.start_location,
        "time_preference": "today afternoon",
        "group_type": "family_or_friends",
        "has_children": "孩子" in request.user_input or "小孩" in request.user_input,
        "budget": "medium",
        "distance_preference": "nearby",
        "dietary_preference": "healthy/light food",
        "activity_keywords": ["park", "mall", "photo spot"],
        "restaurant_keywords": ["light food", "healthy food", "family restaurant"],
    }

    activity_candidates = [
        PlaceCandidate(
            name="示例城市公园",
            category="户外活动",
            address="出发地附近 2 公里内",
            distance="约 2.0 km",
            reason="适合散步、聊天、拍照，活动强度不高。",
        ),
        PlaceCandidate(
            name="示例亲子活动中心",
            category="亲子娱乐",
            address="出发地附近 3 公里内",
            distance="约 3.0 km",
            reason="适合有儿童同行，室内环境更稳定。",
        ),
    ]

    restaurant_candidates = [
        PlaceCandidate(
            name="示例轻食餐厅",
            category="轻食/健康餐",
            address="活动地点附近",
            distance="约 600 m",
            reason="提供沙拉、低脂餐和儿童可接受的主食。",
        ),
        PlaceCandidate(
            name="示例家庭餐厅",
            category="普通餐厅",
            address="活动地点附近",
            distance="约 900 m",
            reason="座位宽松，适合多人聊天和短暂停留。",
        ),
    ]

    plan = ActivityPlan(
        title="轻松半日本地活动方案",
        summary="先到附近活动点散步或拍照，再去轻食餐厅吃饭，整体节奏轻松。",
        estimated_cost="人均约 50-120 元",
        estimated_duration="约 3-4 小时",
        activity_place=activity_candidates[0],
        restaurant=restaurant_candidates[0],
        itinerary=[
            ItineraryItem(
                time="14:00",
                title="从出发地前往活动地点",
                description="预计路程较短，适合作为下午半日行程起点。",
            ),
            ItineraryItem(
                time="14:30",
                title="活动地点游玩",
                description="散步、聊天、拍照，按同行人状态调整节奏。",
            ),
            ItineraryItem(
                time="16:30",
                title="前往附近餐厅",
                description="选择距离近、口味清淡的餐厅，减少等待和绕路。",
            ),
            ItineraryItem(
                time="17:00",
                title="用餐并结束行程",
                description="吃完后可直接返程，避免安排过满。",
            ),
        ],
        tips=[
            "当前是假数据，用于先测试前后端接口。",
            "下一阶段会接入 DeepSeek，把 parsed_intent 换成真实解析结果。",
            "请确认 .env 已加入 .gitignore，不要上传 API Key。",
        ],
    )

    return PlanResponse(
        status="success",
        message="Stage 1 mock plan generated successfully.",
        parsed_intent=parsed_intent,
        activity_candidates=activity_candidates,
        restaurant_candidates=restaurant_candidates,
        plans=[plan],
    )
