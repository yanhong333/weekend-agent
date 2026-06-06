# WeekendPilot 本地活动规划 Agent

WeekendPilot 是一个面向本地生活场景的 AI 活动规划 Agent。用户只需要输入一句自然语言需求和出发位置，系统会自动理解时间、人群、预算、距离、饮食限制和活动偏好，并结合高德地图搜索附近活动地点与餐厅，生成可执行的半日活动方案。

示例输入：

```json
{
  "user_input": "今天下午想带老婆和5岁孩子出去玩，别太远，老婆最近在减肥",
  "start_location": "北京市海淀区中关村"
}
```

## 核心能力

- 自然语言理解：调用 DeepSeek API，把模糊需求解析成结构化 JSON。
- 本地地点搜索：调用高德地图 Web 服务 API，搜索附近活动地点和餐厅。
- 距离与路线判断：基于高德返回的 POI 距离、评分和位置信息做筛选。
- 多约束打分：综合距离、评分、关键词匹配、人群适配、预算适配生成推荐分。
- 前后端分离：后端使用 FastAPI，前端使用原生 HTML / CSS / JavaScript。
- Demo 兜底：DeepSeek 或高德接口暂时不可用时，会使用本地 fallback，保证演示不崩溃。
- 定位与天气：前端请求浏览器 GPS 权限，后端通过高德逆地理编码和天气接口展示真实城市与天气。
- 高德 JS API 预留：已提供 `/api/amap/js-config` 接口，未配置 JS Key 时默认显示静态地图。

## 项目结构

```text
weekend-agent/
├── backend/
│   ├── main.py              # FastAPI 入口，提供 API 接口
│   ├── agent.py             # Agent 主流程调度
│   ├── deepseek_client.py   # DeepSeek API 调用与 JSON 解析
│   ├── amap_client.py       # 高德地图 API 底层封装
│   ├── tools.py             # Agent 可调用的地图工具函数
│   ├── planner.py           # 多约束打分与行程生成
│   ├── config.py            # 环境变量读取
│   └── schemas.py           # 请求与响应数据结构
├── frontend/
│   ├── index.html           # 页面结构
│   ├── style.css            # 页面样式
│   ├── app.js               # 前端交互、接口调用、渲染逻辑
│   └── assets/
│       └── static-map-teal.svg
├── docs/
│   └── design.md            # 架构与设计文档
├── mock_data/
├── .env                     # API Key，本地保存，不上传
├── .gitignore
├── requirements.txt
└── README.md
```

## 环境变量

在项目根目录创建 `.env`：

```env
AMAP_KEY=你的高德地图Web服务Key
DEEPSEEK_API_KEY=你的DeepSeek API Key

# 可选：如果后续要启用高德 JS 地图
AMAP_JS_KEY=你的高德JS API Key
AMAP_SECURITY_JS_CODE=你的高德安全密钥
```

注意：`.env` 里包含密钥，必须保留在本地，不要上传 GitHub。

## 安装依赖

在项目根目录运行：

```powershell
cd e:\clone\meituan\weekend-agent
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

如果还没有虚拟环境，可以先创建：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## 启动后端

在项目根目录运行：

```powershell
cd e:\clone\meituan\weekend-agent
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --port 8848
```

启动后可以访问：

- 后端首页：http://127.0.0.1:8848/
- API 文档：http://127.0.0.1:8848/docs
- 健康检查：http://127.0.0.1:8848/api/health

## 打开前端

建议用本地 HTTP 服务打开，浏览器定位权限更稳定。

在 `frontend` 目录运行：

```powershell
cd e:\clone\meituan\weekend-agent\frontend
python -m http.server 5500
```

然后在浏览器打开：

```text
http://127.0.0.1:5500
```

## 主要接口

### POST `/api/plan`

生成本地活动规划方案。

请求体：

```json
{
  "user_input": "今天下午想带老婆和5岁孩子出去玩，别太远，老婆最近在减肥",
  "start_location": "北京市海淀区中关村"
}
```

返回内容包括：

- `parsed_intent`：DeepSeek 解析出的结构化需求
- `activity_candidates`：高德搜索到的活动地点候选
- `restaurant_candidates`：高德搜索到的餐厅候选
- `plans`：Planner 生成的推荐方案

### POST `/api/location/resolve`

根据浏览器 GPS 经纬度解析真实城市和天气。

请求体：

```json
{
  "latitude": 31.2304,
  "longitude": 121.4737
}
```

### GET `/api/amap/js-config`

给前端预留高德 JS API 配置接口。未配置 `AMAP_JS_KEY` 时，前端继续显示静态地图。

## 完整测试流程

1. 启动后端 `8848` 端口。
2. 启动前端静态服务 `5500` 端口。
3. 浏览器打开 `http://127.0.0.1:5500`。
4. 允许浏览器定位权限，右上角会尝试展示真实城市和天气。
5. 点击示例需求，或输入自己的自然语言需求。
6. 点击“开始规划”。
7. 页面展示 AI 分析状态、结构化需求、推荐时间轴、备选方案、路线概览和评分对比。

如果后端没有启动，前端不会弹窗崩溃，而是在页面中显示错误提示，并保留用户输入。

## Demo 演示话术

1. “WeekendPilot 面向本地生活半日活动规划，解决用户不知道去哪玩、怎么吃、怎么安排顺序的问题。”
2. “用户只输入一句话，系统先用 DeepSeek 抽取时间、人群、预算、距离、饮食限制等结构化信息。”
3. “然后系统调用高德地图搜索附近活动地点和餐厅，并结合距离、评分、人群适配、预算适配做打分。”
4. “最后前端以 AI Agent 工作台形式展示：左侧是需求识别，中间是结构化分析，右侧是最佳时间轴，底部是路线和评分。”
5. “为了保证比赛现场稳定，我们做了 fallback：外部 API 异常时仍然能生成可展示方案。”

## 项目亮点

- 从一句自然语言需求到可执行行程，覆盖理解、搜索、排序、规划、展示完整闭环。
- 不只是聊天回复，而是把模糊需求转成结构化约束，再驱动真实地图 API。
- 结合家庭、朋友、情侣、雨天、预算友好等本地生活场景，贴近真实用户需求。
- 前端采用 AI Agent 工作台布局，适合比赛现场展示系统思考过程。
- 具备扩展空间：可继续接入真实路线规划、地图路线绘制、团购券、用户画像和历史偏好。
