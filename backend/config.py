import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

load_dotenv(ENV_PATH)


AMAP_KEY = os.getenv("AMAP_KEY", "")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")


def check_required_keys() -> None:
    """Check API keys when real external APIs are used."""
    missing_keys = []

    if not AMAP_KEY:
        missing_keys.append("AMAP_KEY")
    if not DEEPSEEK_API_KEY:
        missing_keys.append("DEEPSEEK_API_KEY")

    if missing_keys:
        raise RuntimeError(
            "Missing required API keys in .env: " + ", ".join(missing_keys)
        )
