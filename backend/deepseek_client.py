import json
import re
from typing import Any

import requests

from backend.config import DEEPSEEK_API_KEY


DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-chat"


INTENT_SCHEMA_EXAMPLE = {
    "time_preference": "today afternoon",
    "people_count": 3,
    "companions": ["spouse", "child"],
    "has_children": True,
    "children_ages": [5],
    "budget": "medium",
    "distance_preference": "nearby",
    "dietary_restrictions": ["weight_loss", "light_food"],
    "activity_preferences": ["parent_child", "relaxed", "photo"],
    "activity_keywords": ["park", "children playground", "mall"],
    "restaurant_keywords": ["light food", "healthy food", "salad"],
    "notes": "User wants a relaxed half-day local plan.",
}


def parse_user_intent(user_input: str, start_location: str) -> dict[str, Any]:
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY is missing in .env")

    messages = [
        {
            "role": "system",
            "content": (
                "You are the intent parser for a local activity planning agent. "
                "Extract user needs into strict JSON. Return JSON only, no markdown."
            ),
        },
        {
            "role": "user",
            "content": _build_prompt(user_input, start_location),
        },
    ]

    response = requests.post(
        DEEPSEEK_API_URL,
        headers={
            "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": 0.2,
            "max_tokens": 900,
        },
        timeout=30,
    )
    response.raise_for_status()

    data = response.json()
    content = data["choices"][0]["message"]["content"]
    parsed = _extract_json(content)

    parsed["raw_text"] = user_input
    parsed["start_location"] = start_location
    parsed["parse_source"] = "deepseek"
    return parsed


def _build_prompt(user_input: str, start_location: str) -> str:
    return f"""
User request:
{user_input}

Start location:
{start_location}

Please extract the request into this JSON structure:
{json.dumps(INTENT_SCHEMA_EXAMPLE, ensure_ascii=False, indent=2)}

Rules:
1. Keep all keys from the example.
2. Use null when information is unknown.
3. people_count should include the user if it can be inferred.
4. budget should be one of: low, medium, high, unknown.
5. distance_preference should be one of: very_near, nearby, normal, far_ok, unknown.
6. activity_keywords and restaurant_keywords should be short search keywords suitable for AMap POI search.
7. Return JSON only.
""".strip()


def _extract_json(content: str) -> dict[str, Any]:
    cleaned = content.strip()

    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = re.sub(r"```$", "", cleaned).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
        if not match:
            raise ValueError("DeepSeek response does not contain valid JSON")
        return json.loads(match.group(0))
