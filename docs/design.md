# WeekendPilot 设计文档

## 1. 项目定位

WeekendPilot 是一个本地活动规划 Agent。它面向“周末或半日出行不知道怎么安排”的常见生活场景，让用户通过一句自然语言表达需求，系统自动理解约束、搜索附近地点、生成路线顺序，并输出一个可执行的本地活动方案。

一句话介绍：

> 用户只需要输入一句自然语言需求，WeekendPilot 自动理解时间、人群、偏好、预算、距离和饮食限制，并调用真实地图 API 生成半日活动安排。

核心示例：

```text
今天下午想带老婆和5岁孩子出去玩，别太远，老婆最近在减肥
```

系统需要理解：

- 时间：今天下午
- 人群：夫妻 + 5 岁孩子
- 距离：别太远
- 饮食：减脂、清淡、低卡
- 活动：适合亲子、轻松、不远
- 输出：活动地点 + 餐厅 + 时间安排 + 评分理由

## 2. 目标用户与场景

目标用户：

- 周末想短时间出门放松的家庭
- 想临时约朋友聚会的年轻人
- 想安排情侣约会的人
- 对预算、距离、天气、饮食有约束的本地生活用户

典型场景：

- 亲子半日游：考虑儿童年龄、体力、活动安全和餐饮健康。
- 朋友聚会：考虑聊天、拍照、吃饭、预算。
- 情侣约会：考虑氛围、拍照、咖啡、晚餐。
- 雨天室内：考虑天气和室内活动。
- 预算友好：考虑低价、交通方便、活动成本。

## 3. 总体架构

项目采用前后端分离架构：

```text
用户
  ↓
前端 HTML / CSS / JavaScript
  ↓ POST /api/plan
FastAPI 后端
  ↓
Agent 主流程
  ├── DeepSeek API：自然语言理解
  ├── 高德地图 API：地理编码、POI 搜索、天气
  └── Planner：多约束打分与行程生成
  ↓
JSON 响应
  ↓
前端卡片化展示
```

系统拆分原则：

- 前端负责展示和交互，不保存 API Key。
- 后端负责调用外部 API、处理业务逻辑和兜底。
- DeepSeek 负责“理解需求”。
- 高德地图负责“找到真实地点”。
- Planner 负责“选择和排序”。

## 4. 后端模块设计

### 4.1 `backend/main.py`

FastAPI 后端入口。

主要接口：

- `GET /`：后端状态说明
- `GET /api/health`：健康检查
- `POST /api/plan`：生成活动规划
- `POST /api/location/resolve`：根据 GPS 解析城市和天气
- `GET /api/amap/js-config`：给前端预留高德 JS API 配置

### 4.2 `backend/agent.py`

Agent 主流程调度模块。

流程：

1. 接收 `PlanRequest`
2. 调用 DeepSeek 解析用户需求
3. 调用高德工具搜索活动地点和餐厅
4. 调用 Planner 生成推荐方案
5. 返回 `PlanResponse`

设计重点：

- DeepSeek 失败时使用本地规则兜底解析。
- 高德搜索失败时使用 mock 候选地点兜底。
- 保证比赛 Demo 时页面不因为外部服务波动而中断。

### 4.3 `backend/deepseek_client.py`

负责调用 DeepSeek API，将自然语言转成结构化 JSON。

目标结构示例：

```json
{
  "time_preference": "today afternoon",
  "people_count": 3,
  "companions": ["spouse", "child"],
  "has_children": true,
  "children_ages": [5],
  "budget": "medium",
  "distance_preference": "nearby",
  "dietary_restrictions": ["weight_loss", "light_food"],
  "activity_preferences": ["parent_child", "relaxed"],
  "activity_keywords": ["亲子乐园", "公园"],
  "restaurant_keywords": ["轻食", "健康餐", "沙拉"]
}
```

### 4.4 `backend/amap_client.py`

负责高德地图 Web 服务 API 的底层调用。

已支持能力：

- 地址转经纬度：`geocode_address`
- 周边 POI 搜索：`search_poi_around`
- 驾车路线查询：`driving_route`
- 浏览器 GPS 转高德坐标：`convert_gps_to_amap`
- 逆地理编码：`reverse_geocode`
- 天气查询：`get_weather`

### 4.5 `backend/tools.py`

对高德底层能力进行业务封装，让 Agent 能用更自然的工具函数。

包括：

- `resolve_start_location`
- `search_activity_places`
- `search_restaurants`

它还负责把 DeepSeek 返回的英文或抽象关键词转换成中文 POI 搜索关键词，例如：

- `park` → `公园`
- `children playground` → `亲子乐园`
- `light food` → `轻食`
- `healthy food` → `健康餐`

### 4.6 `backend/planner.py`

负责候选地点打分、排序和行程生成。

当前评分维度：

- 距离匹配：距离越符合“附近”“别太远”等约束，分数越高。
- 评分匹配：高德评分越高，分数越高。
- 关键词匹配：地点名称、类型、理由中命中偏好关键词越多，分数越高。
- 人群适配：亲子、朋友、拍照、聊天等场景是否匹配。
- 预算适配：低预算场景优先公园、小吃、简餐等。

当前权重：

```text
总分 = 距离 35% + 评分 25% + 关键词 20% + 人群 10% + 预算 10%
```

## 5. 前端设计

前端采用原生 HTML / CSS / JavaScript，不使用 React / Vue 和构建工具，方便比赛现场运行。

页面风格：

- 白色 / 浅灰背景
- 青绿色为主色
- 紫色作为 AI 和推荐指数点缀
- 玻璃拟态轻卡片
- 三栏式 AI Agent 工作台

页面结构：

```text
顶部导航栏
  ├── Logo / 项目名 / BETA
  └── 当前城市 / 天气 / 用户身份

主体三栏
  ├── 左侧：AI 聊天与需求识别
  ├── 中间：结构化需求分析
  └── 右侧：最佳推荐行程时间轴 + 备选方案

底部
  ├── 静态路线概览
  └── 智能评分对比
```

核心交互：

- 示例需求按钮：快速填入亲子、朋友、情侣、雨天、预算场景。
- Loading 阶段：展示“理解需求、提取约束、搜索地点、生成方案”的过程感。
- 结果动画：卡片和时间轴逐步出现。
- 备选方案点击：可切换右侧推荐时间轴和路线摘要。
- 错误提示：后端未启动或请求失败时在页面内提示，不使用 `alert`。
- GPS 定位：请求浏览器定位权限，展示真实城市和天气。

## 6. 数据流程

### 6.1 规划流程

```text
用户输入需求和出发地
  ↓
前端 POST /api/plan
  ↓
Agent 调 DeepSeek 解析需求
  ↓
Agent 用高德地理编码解析出发地
  ↓
根据关键词搜索活动地点和餐厅
  ↓
Planner 对候选 POI 打分排序
  ↓
生成 1-3 个活动方案
  ↓
前端渲染结构化分析、时间轴、备选方案和评分
```

### 6.2 定位与天气流程

```text
前端请求浏览器 GPS 权限
  ↓
拿到 WGS84 经纬度
  ↓
POST /api/location/resolve
  ↓
后端调用高德坐标转换
  ↓
后端调用高德逆地理编码获取城市/区县
  ↓
后端调用高德天气接口
  ↓
前端更新右上角城市与天气
```

## 7. 接口设计

### 7.1 POST `/api/plan`

请求：

```json
{
  "user_input": "今天下午想带老婆和5岁孩子出去玩，别太远，老婆最近在减肥",
  "start_location": "北京市海淀区中关村"
}
```

响应核心字段：

```json
{
  "status": "success",
  "message": "Plan generated with DeepSeek, AMap, and Planner scoring.",
  "parsed_intent": {},
  "activity_candidates": [],
  "restaurant_candidates": [],
  "plans": []
}
```

### 7.2 POST `/api/location/resolve`

请求：

```json
{
  "latitude": 31.2304,
  "longitude": 121.4737
}
```

响应：

```json
{
  "status": "success",
  "city": "上海市",
  "district": "黄浦区",
  "adcode": "310101",
  "formatted_address": "上海市黄浦区...",
  "location": "121.478222,31.228457",
  "weather": {
    "weather": "小雨",
    "temperature": "26"
  }
}
```

### 7.3 GET `/api/amap/js-config`

响应：

```json
{
  "enabled": false,
  "js_api_key": "",
  "security_js_code": ""
}
```

说明：当前接口用于给前端预留高德 JS API 接入能力。未配置 Key 时，前端使用静态地图。

## 8. 兜底与稳定性设计

比赛 Demo 场景对稳定性要求很高，因此系统做了多层兜底：

- DeepSeek 失败：使用本地关键词规则解析。
- 高德 POI 搜索失败：使用 mock 活动和餐厅候选。
- 后端未启动：前端显示错误提示条，保留用户输入。
- plans 字段缺失：前端生成默认方案，保证页面不空白。
- schedule 字段缺失：前端生成默认时间轴。
- 高德 JS API 未配置：继续显示静态地图。
- GPS 权限被拒绝：右上角显示默认城市占位，不影响主流程。

## 9. Demo 展示脚本

建议演示步骤：

1. 打开前端页面，介绍 WeekendPilot 是本地活动规划 Agent。
2. 浏览器请求定位权限，说明系统可以根据当前位置展示城市和天气。
3. 点击“亲子半日游”示例。
4. 点击“开始规划”。
5. 指出左侧 AI 分析状态：系统正在理解自然语言。
6. 指出中间结构化需求：时间、人群、儿童年龄、预算、距离、饮食、活动偏好。
7. 指出右侧最佳行程：系统把地点和餐厅组织成可执行时间轴。
8. 指出底部路线概览和评分对比：展示规划结果不只是文字，而是可比较、可解释。
9. 点击备选方案，展示方案可切换。
10. 总结：WeekendPilot 把“模糊想法”转成“可执行本地生活方案”。

## 10. 创新点

- 自然语言到本地活动方案的完整闭环，不停留在普通聊天。
- 结合 DeepSeek 语义理解和高德真实 POI 数据，结果更贴近现实。
- Planner 有可解释打分逻辑，能说明为什么推荐这个方案。
- 前端不是表单页，而是 AI Agent 工作台，能展示系统推理过程。
- 针对比赛 Demo 做了稳定性兜底，外部 API 波动时仍能展示完整流程。

## 11. 商业价值

WeekendPilot 可以扩展成本地生活服务入口：

- 与餐厅、亲子乐园、展览、商场、景点等本地商户连接。
- 根据用户画像和历史偏好做个性化推荐。
- 与团购券、预约、导航、支付形成闭环。
- 给平台带来更高转化率：用户不是搜索单个地点，而是获得完整方案。
- 对家庭、朋友聚会、情侣约会等高频场景有直接应用价值。

## 12. 后续优化方向

- 接入真实路线规划，将步行、公交、驾车时间纳入打分。
- 使用高德 JS API 在前端绘制真实路线。
- 引入天气对活动类型的影响，例如雨天优先室内。
- 增加用户偏好记忆，例如常去区域、饮食忌口、预算习惯。
- 增加多轮对话，让用户能继续提出“更便宜一点”“换成室内”等要求。
- 接入商户优惠券、预约和订单能力，形成商业闭环。
