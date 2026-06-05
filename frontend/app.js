const API_URL = "http://127.0.0.1:8848/api/plan";

const form = document.querySelector("#planForm");
const demoBtn = document.querySelector("#demoBtn");
const submitBtn = document.querySelector("#submitBtn");
const userInput = document.querySelector("#userInput");
const startLocation = document.querySelector("#startLocation");

const apiStatus = document.querySelector("#apiStatus");
const parseSource = document.querySelector("#parseSource");
const mapSource = document.querySelector("#mapSource");
const planCount = document.querySelector("#planCount");
const intentResult = document.querySelector("#intentResult");
const activityList = document.querySelector("#activityList");
const restaurantList = document.querySelector("#restaurantList");
const plansResult = document.querySelector("#plansResult");
const flowResult = document.querySelector("#flowResult");

demoBtn.addEventListener("click", () => {
  userInput.value = "今天下午想带老婆和5岁孩子出去玩，别太远，老婆最近在减肥";
  startLocation.value = "上海市徐汇区";
  userInput.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    user_input: userInput.value.trim(),
    start_location: startLocation.value.trim(),
  };

  if (!payload.user_input || !payload.start_location) {
    showError("请先填写需求和出发位置。");
    return;
  }

  setLoading(true);
  resetResults();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`后端请求失败：${response.status} ${errorText}`);
    }

    const data = await response.json();
    renderResult(data);
    setApiStatus("请求成功", "ok");
  } catch (error) {
    showError(error.message || "请求失败，请确认后端服务已在 8848 端口运行。");
    setApiStatus("请求失败", "error");
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  demoBtn.disabled = isLoading;
  submitBtn.textContent = isLoading ? "生成中..." : "生成方案";
  if (isLoading) {
    setApiStatus("处理中", "");
  }
}

function setApiStatus(text, state) {
  apiStatus.textContent = text;
  apiStatus.parentElement.className = `service-status ${state}`.trim();
}

function resetResults() {
  parseSource.textContent = "解析中";
  mapSource.textContent = "搜索中";
  planCount.textContent = "0 个方案";

  intentResult.className = "empty-state";
  intentResult.textContent = "正在调用 DeepSeek 解析用户需求...";

  activityList.className = "list empty-state";
  activityList.textContent = "正在搜索活动地点...";

  restaurantList.className = "list empty-state";
  restaurantList.textContent = "正在搜索餐厅...";

  plansResult.className = "plans empty-state";
  plansResult.textContent = "正在根据距离、评分和偏好生成方案...";

  renderFlow([
    ["理解需求", "正在调用 DeepSeek 解析自然语言", "warn"],
    ["搜索地点", "等待解析结果后调用高德地图", "pending"],
    ["规划排序", "等待候选地点后进行打分", "pending"],
  ]);
}

function renderResult(data) {
  const intent = data.parsed_intent || {};
  const plans = data.plans || [];

  parseSource.textContent = sourceText(intent.parse_source);
  mapSource.textContent = sourceText(intent.map_source);
  planCount.textContent = `${plans.length} 个方案`;

  renderIntent(intent);
  renderCandidates(activityList, data.activity_candidates || []);
  renderCandidates(restaurantList, data.restaurant_candidates || []);
  renderPlans(plans);
  renderFlowFromResult(intent, plans);
}

function renderIntent(intent) {
  const items = [
    ["原始需求", intent.raw_text],
    ["出发位置", intent.start_location],
    ["解析位置", intent.resolved_start_location?.formatted_address],
    ["时间偏好", timeText(intent.time_preference)],
    ["人数", intent.people_count],
    ["同行人", companionsText(intent.companions)],
    ["儿童", intent.has_children ? "有儿童同行" : "无儿童或未提及"],
    ["儿童年龄", formatValue(intent.children_ages)],
    ["预算", budgetText(intent.budget)],
    ["距离偏好", distanceText(intent.distance_preference)],
    ["活动关键词", keywordText(intent.activity_keywords)],
    ["餐厅关键词", keywordText(intent.restaurant_keywords)],
  ];

  intentResult.className = "info-grid";
  intentResult.innerHTML = items
    .map(
      ([label, value]) => `
        <div class="info-item">
          <div class="info-label">${escapeHtml(label)}</div>
          <div class="info-value">${escapeHtml(formatValue(value))}</div>
        </div>
      `
    )
    .join("");
}

function renderCandidates(container, candidates) {
  if (!candidates.length) {
    container.className = "list empty-state";
    container.textContent = "没有找到候选结果。";
    return;
  }

  container.className = "list";
  container.innerHTML = candidates.map(renderPlaceCard).join("");
}

function renderPlaceCard(place) {
  return `
    <article class="card">
      <div class="card-title">
        <strong>${escapeHtml(place.name)}</strong>
        <span class="score">${formatScore(place.score)}</span>
      </div>
      <div class="place-meta">
        <span class="badge">${escapeHtml(place.distance || "距离待确认")}</span>
        <span class="badge">评分 ${escapeHtml(place.rating || "暂无")}</span>
        <span class="badge">${escapeHtml(sourceText(place.source))}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(place.category || "类型待确认")}</span>
        <span>${escapeHtml(place.address || "地址待确认")}</span>
      </div>
      <div class="reason">${escapeHtml(place.reason || "")}</div>
    </article>
  `;
}

function renderPlans(plans) {
  if (!plans.length) {
    plansResult.className = "plans empty-state";
    plansResult.textContent = "没有生成方案。";
    return;
  }

  plansResult.className = "plans";
  plansResult.innerHTML = plans.map(renderPlanCard).join("");
}

function renderPlanCard(plan) {
  return `
    <article class="card plan-card">
      <div class="card-title">
        <strong>${escapeHtml(plan.title)}</strong>
        <span class="score">${formatScore(plan.score)}</span>
      </div>
      <div class="meta">
        <span>${escapeHtml(plan.summary)}</span>
        <span>${escapeHtml(plan.estimated_duration)} · ${escapeHtml(plan.estimated_cost)}</span>
      </div>

      <div class="plan-main">
        ${renderMiniPlace("活动地点", plan.activity_place)}
        ${renderMiniPlace("餐厅", plan.restaurant)}
      </div>

      <div class="itinerary">
        ${(plan.itinerary || []).map(renderItineraryItem).join("")}
      </div>

      <ul class="tips">
        ${(plan.tips || []).map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
      </ul>
    </article>
  `;
}

function renderMiniPlace(label, place = {}) {
  return `
    <div class="mini-place">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(place.name || "待确认")}</strong>
      <div class="meta">
        <small>${escapeHtml(place.distance || "距离待确认")} · 评分 ${escapeHtml(place.rating || "暂无")}</small>
      </div>
    </div>
  `;
}

function renderItineraryItem(item) {
  return `
    <div class="itinerary-item">
      <div class="time">${escapeHtml(item.time)}</div>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <div class="meta">${escapeHtml(item.description)}</div>
      </div>
    </div>
  `;
}

function showError(message) {
  parseSource.textContent = "失败";
  mapSource.textContent = "失败";
  planCount.textContent = "0 个方案";

  intentResult.className = "empty-state error-box";
  intentResult.textContent = message;

  activityList.className = "list empty-state";
  restaurantList.className = "list empty-state";
  plansResult.className = "plans empty-state";

  activityList.textContent = "暂无数据";
  restaurantList.textContent = "暂无数据";
  plansResult.textContent = "暂无方案";

  renderFlow([
    ["理解需求", "流程失败，请检查后端服务或 API Key", "warn"],
    ["搜索地点", "未执行", "pending"],
    ["规划排序", "未执行", "pending"],
  ]);
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return "未识别";
  }
  if (Array.isArray(value)) {
    return value.length ? value.join("、") : "未识别";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function formatScore(score) {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "暂无分";
  }
  return `${Number(score).toFixed(1)} 分`;
}

function budgetText(value) {
  const map = {
    low: "低预算",
    medium: "中等预算",
    high: "高预算",
    unknown: "未识别",
  };
  return map[value] || value;
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
  return map[value] || value;
}

function companionsText(value) {
  const companions = normalizeArray(value);
  if (!companions.length) {
    return "未识别";
  }

  const map = {
    spouse: "配偶",
    wife: "妻子",
    husband: "丈夫",
    child: "孩子",
    children: "孩子",
    friend: "朋友",
    friends: "朋友",
    parent: "父母",
    parents: "父母",
    colleague: "同事",
    colleagues: "同事",
    couple: "情侣",
    family: "家人",
  };

  return companions.map((item) => map[String(item).toLowerCase()] || item).join("、");
}

function keywordText(value) {
  const keywords = normalizeArray(value);
  if (!keywords.length) {
    return "未识别";
  }

  const map = {
    park: "公园",
    "children playground": "亲子乐园",
    playground: "亲子乐园",
    mall: "商场",
    "shopping mall": "商场",
    exhibition: "展览",
    museum: "博物馆",
    "scenic spot": "景点",
    "photo spot": "拍照打卡",
    cafe: "咖啡馆",
    coffee: "咖啡馆",
    "light food": "轻食",
    "healthy food": "健康餐",
    "healthy restaurant": "健康餐",
    salad: "沙拉",
    "cheap eats": "平价小吃",
    snack: "小吃",
    "casual dining": "简餐",
    "family restaurant": "家庭餐厅",
    restaurant: "餐厅",
  };

  return keywords
    .map((item) => map[String(item).toLowerCase()] || item)
    .join("、");
}

function distanceText(value) {
  const map = {
    very_near: "非常近",
    nearby: "附近",
    normal: "距离适中",
    far_ok: "可接受较远",
    unknown: "未识别",
  };
  return map[value] || value;
}

function normalizeArray(value) {
  if (value === null || value === undefined || value === "") {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function sourceText(value) {
  const map = {
    deepseek: "DeepSeek",
    amap: "高德地图",
    fallback: "兜底数据",
    mock: "模拟数据",
    unknown: "未知",
  };
  return map[value] || value || "未知";
}

function renderFlowFromResult(intent, plans) {
  const parseState = intent.parse_source === "deepseek" ? "done" : "warn";
  const mapState = intent.map_source === "amap" ? "done" : "warn";
  const planState = plans.length > 0 ? "done" : "warn";

  renderFlow([
    [
      "理解需求",
      intent.parse_source === "deepseek"
        ? "DeepSeek 已完成结构化意图解析"
        : "使用本地兜底规则完成解析",
      parseState,
    ],
    [
      "搜索地点",
      intent.map_source === "amap"
        ? "高德地图已返回活动地点和餐厅候选"
        : "使用模拟地点兜底生成候选",
      mapState,
    ],
    [
      "规划排序",
      plans.length > 0
        ? `Planner 已生成 ${plans.length} 个打分方案`
        : "Planner 没有生成可用方案",
      planState,
    ],
  ]);
}

function renderFlow(steps) {
  flowResult.innerHTML = steps
    .map(
      ([title, description, state], index) => `
        <div class="flow-step ${escapeHtml(state)}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(title)}</strong>
          <p>${escapeHtml(description)}</p>
        </div>
      `
    )
    .join("");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
