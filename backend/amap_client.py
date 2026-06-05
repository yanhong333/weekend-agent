import requests
from backend.config import AMAP_KEY


AMAP_BASE_URL = "https://restapi.amap.com/v5"


def search_poi_around(location, keywords, radius=5000, page_size=10):
    """
    调用高德周边搜索 POI。

    参数：
    location: 中心点经纬度，格式为 "经度,纬度"，例如 "116.397428,39.90923"
    keywords: 搜索关键词，例如 "亲子乐园"、"轻食"、"公园"
    radius: 搜索半径，单位米
    page_size: 返回结果数量

    返回：
    POI 列表
    """
    url = f"{AMAP_BASE_URL}/place/around"

    params = {
        "key": AMAP_KEY,
        "location": location,
        "keywords": keywords,
        "radius": radius,
        "page_size": page_size,
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()

    if data.get("status") != "1":
        raise RuntimeError(f"高德 POI 搜索失败：{data}")

    return data.get("pois", [])


def driving_route(origin, destination):
    """
    调用高德驾车路线规划。

    参数：
    origin: 起点经纬度，格式为 "经度,纬度"
    destination: 终点经纬度，格式为 "经度,纬度"

    返回：
    路线规划结果
    """
    url = f"{AMAP_BASE_URL}/direction/driving"

    params = {
        "key": AMAP_KEY,
        "origin": origin,
        "destination": destination,
    }

    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()

    data = response.json()

    if data.get("status") != "1":
        raise RuntimeError(f"高德路线规划失败：{data}")

    return data


if __name__ == "__main__":
    test_location = "116.397428,39.90923"

    pois = search_poi_around(
        location=test_location,
        keywords="轻食",
        radius=5000,
        page_size=5
    )

    print("搜索结果：")
    for poi in pois:
        print(poi.get("name"), poi.get("address"), poi.get("location"))

if __name__ == "__main__":
    test_location = "116.397428,39.90923"  # 北京天安门附近，经度,纬度

    pois = search_poi_around(
        location=test_location,
        keywords="轻食",
        radius=5000,
        page_size=5
    )

    print("搜索结果数量：", len(pois))

    for poi in pois:
        print("名称：", poi.get("name"))
        print("地址：", poi.get("address"))
        print("坐标：", poi.get("location"))
        print("-" * 30)