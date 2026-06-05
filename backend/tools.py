from amap_client import search_poi_around, driving_route


def search_family_places(user_location):
    return search_poi_around(
        location=user_location,
        keywords="亲子乐园|儿童乐园|公园",
        radius=5000,
        page_size=10
    )


def search_healthy_restaurants(user_location):
    return search_poi_around(
        location=user_location,
        keywords="轻食|沙拉|健康餐",
        radius=5000,
        page_size=10
    )