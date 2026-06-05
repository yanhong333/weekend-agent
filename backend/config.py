import os
from dotenv import load_dotenv

load_dotenv()

AMAP_KEY = os.getenv("AMAP_KEY")

if not AMAP_KEY:
    raise ValueError("缺少 AMAP_KEY，请在 .env 文件中配置高德地图 Web服务 Key")