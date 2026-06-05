const API_URL = "http://127.0.0.1:8848/api/plan";

const form = document.querySelector("#planForm");
const demoBtn = document.querySelector("#demoBtn");
const submitBtn = document.querySelector("#submitBtn");
const userInput = document.querySelector("#userInput");
const startLocation = document.querySelector("#startLocation");
const chatStream = document.querySelector("#chatStream");
const intentResult = document.querySelector("#intentResult");
const bestPlanResult = document.querySelector("#bestPlanResult");
const alternativePlans = document.querySelector("#alternativePlans");
const scoreCompare = document.querySelector("#scoreCompare");
const parseSource = document.querySelector("#parseSource");
const mapSource = document.querySelector("#mapSource");
const planCount = document.querySelector("#planCount");
const apiStatus = document.querySelector("#apiStatus");
const agentNote = document.querySelector("#agentNote");
const routeTitle = document.querySelector("#routeTitle");
const routeStats = document.querySelector("#routeStats");

demoBtn.addEventListener("click", () => {
  userInput.value = "今天下午想带老婆和5岁孩子出去玩，别太远，老婆最近在减肥";
  startLocation.value = "上海市徐汇区";
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    user_input: userInput.value.trim(),
    start_location: startLocation.value.trim(),
  };

  if (!payload.user_input || !payload.start_location) {
    pushMessage("ai", "请先填写你的需求和出发位置。");
    return;
  }

  setLoading(true);
  resetPanels();
  pushMessage("user", payload.user_input);
  pushMessage("ai", "收到。我正在解析需求、搜索附近地点，并计算最合适的半日行程。");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`后端请求失败：${response.status}`);
    }

    const data = await response.json();
    renderAll(data);
    apiStatus.textContent = "请求成功";
  } catch (error) {
    apiStatus.textContent = "请求失败";
    pushMessage("ai", `${error.message}。请确认后端服务正在 8848 端口运行。`);
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  demoBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "规划中" : "发送";
}

function resetPanels() {
  parseSource.textContent = "解析中";
  mapSource.textContent = "搜索中";
  planCount.textContent = "0 个方案";
  apiStatus.textContent = "处理中";
  intentResult.className = "analysis-list empty";
  intentResult.textContent = "正在解析结构化需求...";
  bestPlanResult.className = "empty";
  bestPlanResult.textContent = "正在生成最佳方案...";
  alternativePlans.className = "alt-grid empty";
  alternativePlans.textContent = "正在整理备选方案...";
  scoreCompare.className = "score-compare empty";
  scoreCompare.textContent = "正在计算评分...";
  agentNote.textContent = "AI 正在根据人群、距离、预算和饮食约束生成建议。";
}

function renderAll(data) {
  const intent = data.parsed_intent || {};
  const plans = data.plans || [];
  const bestPlan = plans[0];

  parseSource.textContent = sourceText(intent.parse_source);
  mapSource.textContent = sourceText(intent.map_source);
  planCount.textContent = `${plans.length} 个方案`;

  renderIntent(intent);
  renderChatInsight(intent, bestPlan);
  renderBestPlan(bestPlan);
  renderAlternatives(plans.slice(1));
  renderScores(plans);
  renderRoute(bestPlan);
}

function renderIntent(intent) {
  const items = [
    ["时间", timeText(intent.time_preference)],
    ["出行人群", `${formatPeople(intent.people_count)} · ${companionsText(intent.companions)}`],
    ["儿童年龄", formatValue(intent.children_ages)],
    ["预算", budgetText(intent.budget)],
    ["距离偏好", distanceText(intent.distance_preference)],
    ["饮食限制", keywordText(intent.dietary_restrictions)],
    ["活动偏好", keywordText(intent.activity_preferences)],
    ["餐厅关键词", keywordText(intent.restaurant_keywords)],
  ];

  intentResult.className = "analysis-list";
  intentResult.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="analysis-item">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(formatValue(value))}</strong>
        </div>
      `
    )
    .join("");

  agentNote.textContent = buildAgentNote(intent);
}

function renderChatInsight(intent, bestPlan) {
  if (!bestPlan) {
    return;
  }

  const lines = [
    `时间：${timeText(intent.time_preference)}`,
    `人群：${formatPeople(intent.people_count)}，${companionsText(intent.companions)}`,
    `距离：${distanceText(intent.distance_preference)}`,
    `推荐：${bestPlan.activity_place?.name || "活动地点"} + ${bestPlan.restaurant?.name || "餐厅"}`,
  ];

  pushMessage(
    "ai",
    `<div class="extract-box"><strong>已提取关键信息</strong><ul>${lines
      .map((line) => `<li>${escapeHtml(line)}</li>`)
      .join("")}</ul></div>`
  );
}

function renderBestPlan(plan) {
  if (!plan) {
    bestPlanResult.className = "empty";
    bestPlanResult.textContent = "暂无推荐方案";
    return;
  }

  bestPlanResult.className = "timeline";
  bestPlanResult.innerHTML = (plan.itinerary || [])
    .map((item, index) => {
      const placeName = index === 1 ? plan.activity_place?.name : index === 2 ? plan.restaurant?.name : "";
      return `
        <div class="timeline-item">
          <div class="time">${escapeHtml(item.time)}</div>
          <div class="dot">${index + 1}</div>
          <div class="timeline-title">
            <strong>${escapeHtml(item.title)}</strong>
            <span>${escapeHtml(placeName || item.description)}</span>
          </div>
          <div class="duration">${escapeHtml(index === 0 || index === 3 ? "35分钟" : index === 1 ? "90分钟" : "60分钟")}</div>
        </div>
      `;
    })
    .join("");
}

function renderAlternatives(plans) {
  if (!plans.length) {
    alternativePlans.className = "alt-grid empty";
    alternativePlans.textContent = "暂无备选方案";
    return;
  }

  alternativePlans.className = "alt-grid";
  alternativePlans.innerHTML = plans
    .map(
      (plan, index) => `
        <article class="alt-card">
          <span class="score-pill">${formatScore(plan.score)}</span>
          <strong>方案${index + 2} · ${escapeHtml(shortTitle(plan.title))}</strong>
          <p>${escapeHtml(plan.activity_place?.name || "活动地点")} → ${escapeHtml(plan.restaurant?.name || "餐厅")} → 返程</p>
        </article>
      `
    )
    .join("");
}

function renderScores(plans) {
  if (!plans.length) {
    scoreCompare.className = "score-compare empty";
    scoreCompare.textContent = "暂无评分";
    return;
  }

  const best = plans[0];
  const rows = [
    ["距离匹配", best.activity_place?.score || best.score || 0],
    ["预算匹配", best.restaurant?.score || best.score || 0],
    ["场景适配", best.score || 0],
  ];

  scoreCompare.className = "score-compare";
  scoreCompare.innerHTML = rows
    .map(
      ([label, score]) => `
        <div class="score-row">
          <span>${escapeHtml(label)}</span>
          <div class="bar"><i style="width: ${Math.min(Number(score), 100)}%"></i></div>
          <strong>${formatScore(score)}</strong>
        </div>
      `
    )
    .join("");
}

function renderRoute(plan) {
  if (!plan) {
    routeTitle.textContent = "等待生成路线";
    routeStats.innerHTML = "<span>总里程 --</span><span>预计时长 --</span><span>节点 --</span>";
    return;
  }

  routeTitle.textContent = shortTitle(plan.title);
  routeStats.innerHTML = `
    <span>总里程 约 ${estimateDistance(plan)}</span>
    <span>预计时长 ${escapeHtml(plan.estimated_duration || "约 3-4 小时")}</span>
    <span>节点 ${(plan.itinerary || []).length} 个</span>
  `;
}

function pushMessage(type, html) {
  const node = document.createElement("div");
  node.className = `message ${type}`;
  node.innerHTML = `<p>${type === "user" ? escapeHtml(html) : html}</p>`;
  chatStream.appendChild(node);
  chatStream.scrollTop = chatStream.scrollHeight;
}

function buildAgentNote(intent) {
  const budget = budgetText(intent.budget);
  const distance = distanceText(intent.distance_preference);
  const food = keywordText(intent.restaurant_keywords);
  return `为你优先选择“${distance} + ${budget} + ${food}”组合，兼顾体验感和可执行性。`;
}

function estimateDistance(plan) {
  const texts = [plan.activity_place?.distance, plan.restaurant?.distance].filter(Boolean);
  if (!texts.length) {
    return "10-20 公里";
  }
  return texts.join(" + ");
}

function shortTitle(title = "") {
  return title.replace(/^推荐方案：|^备选方案：|^轻量方案：/, "");
}

function formatPeople(value) {
  return value ? `${value}人` : "人数未识别";
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "未识别";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join("、") : "未识别";
  }
  return String(value);
}

function formatScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "暂无";
  }
  return Number(score).toFixed(1);
}

function timeText(value) {
  const map = {
    "today morning": "今天上午",
    "today afternoon": "今天下午",
    "today evening": "今天晚上",
    "tomorrow morning": "明天上午",
    "tomorrow afternoon": "明天下午",
    "tomorrow evening": "明天晚上",
    weekend: "周末",
    unknown: "未识别",
  };
  return map[value] || value || "未识别";
}

function companionsText(value) {
  const map = {
    spouse: "配偶",
    wife: "妻子",
    husband: "丈夫",
    child: "孩子",
    children: "孩子",
    friend: "朋友",
    friends: "朋友",
    family: "家人",
  };
  return normalizeArray(value)
    .map((item) => map[String(item).toLowerCase()] || item)
    .join("、") || "未识别";
}

function keywordText(value) {
  const map = {
    park: "公园",
    "children playground": "亲子乐园",
    playground: "亲子乐园",
    mall: "商场",
    "scenic spot": "景点",
    "photo spot": "拍照打卡",
    cafe: "咖啡馆",
    "light food": "轻食",
    "healthy food": "健康餐",
    salad: "沙拉",
    "cheap eats": "平价小吃",
    snack: "小吃",
    "casual dining": "简餐",
    eating: "有吃的",
    relaxed: "轻松休闲",
    photo: "拍照",
    chat: "聊天",
    weight_loss: "减脂",
  };
  return normalizeArray(value)
    .map((item) => map[String(item).toLowerCase()] || item)
    .join("、") || "未识别";
}

function budgetText(value) {
  const map = {
    low: "低预算",
    medium: "中等预算",
    high: "高预算",
    unknown: "未识别",
  };
  return map[value] || value || "未识别";
}

function distanceText(value) {
  const map = {
    very_near: "非常近",
    nearby: "别太远",
    normal: "距离适中",
    far_ok: "可接受较远",
    unknown: "未识别",
  };
  return map[value] || value || "未识别";
}

function sourceText(value) {
  const map = {
    deepseek: "DeepSeek",
    amap: "高德地图",
    fallback: "兜底数据",
    mock: "模拟数据",
  };
  return map[value] || value || "未知";
}

function normalizeArray(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
