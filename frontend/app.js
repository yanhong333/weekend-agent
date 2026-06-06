const API_URL = "http://127.0.0.1:8848/api/plan";
const LOCATION_API_URL = "http://127.0.0.1:8848/api/location/resolve";
const AMAP_CONFIG_URL = "http://127.0.0.1:8848/api/amap/js-config";

const EXAMPLES = {
  family: {
    input: "今天下午想带老婆和5岁孩子出去玩，别太远，老婆最近在减肥",
    location: "上海市徐汇区",
  },
  friends: {
    input: "下午想和4个朋友出去玩，最好能聊天拍照，有吃的，别太贵",
    location: "上海市徐汇区",
  },
  date: {
    input: "周末下午想和女朋友约会，想拍照、喝咖啡、吃点不太贵的东西",
    location: "北京市朝阳区",
  },
  rain: {
    input: "今天下雨，想找一个室内活动，适合两三个人聊天逛逛，附近有饭吃",
    location: "上海市静安区",
  },
  budget: {
    input: "下午想出去放松一下，预算别太高，最好地铁方便，有公园或者小吃",
    location: "北京市海淀区中关村",
  },
};

const LOADING_STAGES = [
  "正在理解你的需求...",
  "正在提取时间、人群和预算...",
  "正在匹配附近活动地点...",
  "正在生成半日行程...",
];

const DEFAULT_PLANS = [
  {
    title: "亲子公园 + 轻食晚餐半日方案",
    summary: "下午先去附近亲子公园散步和陪孩子玩，傍晚去附近轻食餐厅吃饭。",
    activity_place: {
      name: "城市亲子公园",
      category: "公园 / 亲子活动",
      address: "出发地附近",
      distance: "约 3.0 km",
      reason: "适合儿童活动，空间开阔，节奏轻松。",
      score: 8.9,
    },
    restaurant: {
      name: "轻食健康餐厅",
      category: "轻食 / 沙拉 / 健康餐",
      address: "公园附近",
      distance: "约 800 m",
      reason: "符合减脂、清淡和低热量需求。",
      score: 8.7,
    },
    schedule: ["14:30 从出发地出发", "15:00 到达亲子公园", "17:00 前往轻食餐厅", "18:30 结束行程"],
    estimated_cost: "约150-250元",
    score: 8.8,
  },
  {
    title: "自然探索之旅",
    summary: "公园散步、轻松拍照，再选择附近简餐结束行程。",
    schedule: ["13:30 出发", "14:00 公园散步", "15:30 拍照休息", "17:00 简餐返程"],
    estimated_cost: "约120-220元",
    score: 8.6,
  },
  {
    title: "商圈亲子时光",
    summary: "室内商圈活动更稳定，适合天气不确定时备用。",
    schedule: ["13:30 出发", "14:10 商圈活动", "15:30 亲子体验", "17:10 晚餐返程"],
    estimated_cost: "约180-300元",
    score: 8.1,
  },
];

const state = {
  plans: [],
  intent: {},
  selectedPlanIndex: 0,
  loadingTimer: null,
  stageIndex: 0,
  analysisCard: null,
  userLocation: null,
  amapLocation: null,
  amapMap: null,
};

const els = {};

initApp();

function initApp() {
  Object.assign(els, {
    form: document.querySelector("#planForm"),
    demoBtn: document.querySelector("#demoBtn"),
    submitBtn: document.querySelector("#submitBtn"),
    userInput: document.querySelector("#userInput"),
    startLocation: document.querySelector("#startLocation"),
    chatStream: document.querySelector("#chatStream"),
    intentResult: document.querySelector("#intentResult"),
    bestPlanResult: document.querySelector("#bestPlanResult"),
    alternativePlans: document.querySelector("#alternativePlans"),
    scoreCompare: document.querySelector("#scoreCompare"),
    parseSource: document.querySelector("#parseSource"),
    mapSource: document.querySelector("#mapSource"),
    planCount: document.querySelector("#planCount"),
    recommendScore: document.querySelector("#recommendScore"),
    errorBanner: document.querySelector("#errorBanner"),
    agentNote: document.querySelector("#agentNote"),
    routeTitle: document.querySelector("#routeTitle"),
    routeStats: document.querySelector("#routeStats"),
    currentCity: document.querySelector("#currentCity"),
    currentWeather: document.querySelector("#currentWeather"),
    amapContainer: document.querySelector("#amapContainer"),
    staticMapPreview: document.querySelector("#staticMapPreview"),
    mapApiNotice: document.querySelector("#mapApiNotice"),
  });

  els.form.addEventListener("submit", handleSubmit);
  els.demoBtn.addEventListener("click", () => fillExample("family"));
  document.querySelectorAll("[data-example]").forEach((button) => {
    button.addEventListener("click", () => fillExample(button.dataset.example));
  });

  fillExample("family", { silent: true });
  renderInitialState();
  initBrowserLocation();
  initAmapJsInterface();
  refreshIcons();
}

function fillExample(type, options = {}) {
  const example = EXAMPLES[type] || EXAMPLES.family;
  els.userInput.value = example.input;
  els.startLocation.value = example.location;
  if (!options.silent) {
    els.userInput.focus();
  }
}

function initBrowserLocation() {
  if (!navigator.geolocation) {
    updateLocationMeta("定位不可用", "天气待定位", "当前浏览器不支持 GPS 定位");
    return;
  }

  updateLocationMeta("等待授权", "天气待定位", "浏览器会请求 GPS 定位权限");
  navigator.geolocation.getCurrentPosition(handleLocationSuccess, handleLocationError, {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 300000,
  });
}

async function handleLocationSuccess(position) {
  const { latitude, longitude } = position.coords;
  state.userLocation = { latitude, longitude };
  updateLocationMeta("定位解析中", "天气加载中", "正在通过高德地图解析当前位置");

  try {
    const data = await resolveBrowserLocation(latitude, longitude);
    const city = data.city || data.district || "当前位置";
    const weatherText = formatWeather(data.weather);
    state.amapLocation = data.location || null;
    updateLocationMeta(city, weatherText, data.formatted_address || "已定位到当前位置");
    updateStartLocation(data);
    centerAmapMap(data.location);
  } catch (error) {
    updateLocationMeta("定位城市", "天气获取失败", "后端定位解析接口暂时不可用");
  }
}

function handleLocationError(error) {
  const messageMap = {
    1: "你拒绝了定位权限，当前使用默认城市占位",
    2: "暂时无法获取定位，当前使用默认城市占位",
    3: "定位超时，当前使用默认城市占位",
  };
  updateLocationMeta("上海", "24°C", messageMap[error.code] || "定位失败，当前使用默认城市占位");
}

async function resolveBrowserLocation(latitude, longitude) {
  const response = await fetch(LOCATION_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({ latitude, longitude }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.status !== "success") {
    throw new Error(data.message || "location resolve failed");
  }
  return data;
}

function updateLocationMeta(city, weather, title = "") {
  els.currentCity.innerHTML = `<i data-lucide="map-pin"></i>${escapeHtml(city)}`;
  els.currentWeather.innerHTML = `<i data-lucide="cloud-sun"></i>${escapeHtml(weather)}`;
  els.currentCity.title = title;
  els.currentWeather.title = title;
  refreshIcons();
}

function updateStartLocation(data) {
  const current = els.startLocation.value.trim();
  const defaultLocation = EXAMPLES.family.location;
  const resolved = data.formatted_address || [data.city, data.district].filter(Boolean).join("");
  if (resolved && (!current || current === defaultLocation)) {
    els.startLocation.value = resolved;
  }
}

function formatWeather(weather = {}) {
  const temperature = getFirst(weather.temperature, weather.temperature_float);
  const weatherName = getFirst(weather.weather, weather.info);
  const wind = getFirst(weather.winddirection, weather.wind_direction);
  if (temperature && weatherName) {
    return wind ? `${weatherName} ${temperature}°C` : `${weatherName} ${temperature}°C`;
  }
  return "天气待更新";
}

async function initAmapJsInterface() {
  try {
    const config = await fetchAmapJsConfig();
    if (!config.enabled || !config.js_api_key) {
      updateMapNotice("高德 JS API 未配置，当前显示静态路线预览");
      return;
    }

    await loadAmapScript(config.js_api_key, config.security_js_code);
    showAmapContainer();
    createAmapMap();
    updateMapNotice("高德 JS API 已接入，可切换为真实地图");
  } catch (error) {
    updateMapNotice("高德 JS API 暂不可用，当前显示静态路线预览");
  }
}

async function fetchAmapJsConfig() {
  const response = await fetch(AMAP_CONFIG_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function loadAmapScript(jsApiKey, securityJsCode = "") {
  if (window.AMap) {
    return Promise.resolve();
  }

  if (securityJsCode) {
    window._AMapSecurityConfig = {
      securityJsCode,
    };
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(jsApiKey)}`;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function showAmapContainer() {
  els.staticMapPreview.hidden = true;
  els.amapContainer.hidden = false;
}

function createAmapMap() {
  if (!window.AMap || state.amapMap) {
    return;
  }

  state.amapMap = new window.AMap.Map("amapContainer", {
    zoom: 12,
    center: [121.4737, 31.2304],
    viewMode: "2D",
    mapStyle: "amap://styles/whitesmoke",
  });
  centerAmapMap(state.amapLocation);
}

function centerAmapMap(location) {
  if (!state.amapMap || !location) {
    return;
  }

  const [longitude, latitude] = String(location).split(",").map(Number);
  if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
    state.amapMap.setCenter([longitude, latitude]);
    new window.AMap.Marker({
      position: [longitude, latitude],
      title: "当前位置",
      map: state.amapMap,
    });
  }
}

function updateMapNotice(text) {
  els.mapApiNotice.textContent = text;
}

async function handleSubmit(event) {
  event.preventDefault();
  hideError();

  const payload = {
    user_input: els.userInput.value.trim(),
    start_location: els.startLocation.value.trim(),
  };

  if (!payload.user_input || !payload.start_location) {
    showError("请先填写自然语言需求和出发位置。");
    return;
  }

  renderUserMessage(payload.user_input);
  showLoading();

  try {
    const [data] = await Promise.all([fetchPlan(payload), wait(1400)]);
    const normalized = normalizeResponse(data, payload);
    hideLoading();
    renderResult(normalized);
  } catch (error) {
    hideLoading();
    showError("规划失败，请检查后端服务是否已启动，或稍后再试。");
    updateAssistantCardError("暂时没能连上规划服务。你的输入已保留，可以确认后端 8848 端口启动后再试。");
  }
}

async function fetchPlan(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function showLoading() {
  state.stageIndex = 0;
  setButtonLoading(true);
  renderAssistantAnalysisCard(LOADING_STAGES[0]);
  renderSkeletons();

  state.loadingTimer = setInterval(() => {
    state.stageIndex = Math.min(state.stageIndex + 1, LOADING_STAGES.length - 1);
    updateAssistantStage(LOADING_STAGES[state.stageIndex]);
  }, 520);
}

function hideLoading() {
  clearInterval(state.loadingTimer);
  state.loadingTimer = null;
  setButtonLoading(false);
}

function setButtonLoading(isLoading) {
  els.submitBtn.disabled = isLoading;
  els.demoBtn.disabled = isLoading;
  els.submitBtn.innerHTML = isLoading
    ? `<i data-lucide="loader-circle"></i>规划中...`
    : `<i data-lucide="send"></i>开始规划`;
  refreshIcons();
}

function renderSkeletons() {
  els.parseSource.textContent = "解析中";
  els.mapSource.textContent = "搜索中";
  els.planCount.textContent = "0 个方案";
  els.recommendScore.textContent = "推荐指数 --";

  els.intentResult.className = "skeleton-grid";
  els.intentResult.innerHTML = Array.from({ length: 7 }, () => `<div class="skeleton skeleton-card"></div>`).join("");

  els.bestPlanResult.className = "timeline";
  els.bestPlanResult.innerHTML = Array.from({ length: 5 }, () => `<div class="skeleton skeleton-card"></div>`).join("");

  els.alternativePlans.className = "alt-grid";
  els.alternativePlans.innerHTML = `<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>`;

  els.scoreCompare.className = "score-compare";
  els.scoreCompare.innerHTML = Array.from({ length: 3 }, () => `<div class="skeleton skeleton-card"></div>`).join("");

  els.agentNote.innerHTML = `<i data-lucide="sparkles"></i><p>AI 正在根据人群、距离、预算和饮食约束生成建议。</p>`;
  refreshIcons();
}

function renderInitialState() {
  state.intent = {};
  state.plans = normalizePlans(DEFAULT_PLANS);
  state.selectedPlanIndex = 0;
  renderScoreBars(state.plans);
  refreshIcons();
}

function renderResult(data) {
  state.intent = data.intent;
  state.plans = data.plans;
  state.selectedPlanIndex = 0;

  els.parseSource.textContent = sourceText(data.intent.parse_source || data.intent.source || "deepseek");
  els.mapSource.textContent = sourceText(data.intent.map_source || "amap");
  els.planCount.textContent = `${data.plans.length} 个方案`;

  updateAssistantCardDone(data.intent, data.plans[0]);
  renderParsedIntent(data.intent);
  renderSelectedPlan();
  refreshIcons();
}

function renderSelectedPlan() {
  const plan = state.plans[state.selectedPlanIndex] || state.plans[0];
  els.recommendScore.textContent = `推荐指数 ${formatScore(plan.score)}`;
  renderTimeline(plan);
  renderRouteSummary(plan);
  renderAlternativePlans(state.plans);
  renderScoreBars(state.plans);
}

function renderUserMessage(text) {
  const node = document.createElement("div");
  node.className = "message user";
  node.innerHTML = `<p>${escapeHtml(text)}</p>`;
  els.chatStream.appendChild(node);
  scrollChatToBottom();
}

function renderAssistantAnalysisCard(stageText) {
  const node = document.createElement("div");
  node.className = "message ai";
  node.innerHTML = `
    <div class="analysis-status" id="assistantAnalysisCard">
      <strong>正在分析你的需求...</strong>
      <div class="check-list">
        <div><i data-lucide="check"></i><span id="stageText">${escapeHtml(stageText)}</span></div>
      </div>
      <div class="progress-track"><i></i></div>
    </div>
  `;
  els.chatStream.appendChild(node);
  state.analysisCard = node.querySelector("#assistantAnalysisCard");
  scrollChatToBottom();
  refreshIcons();
}

function updateAssistantStage(stageText) {
  const stageNode = state.analysisCard?.querySelector("#stageText");
  if (stageNode) {
    stageNode.textContent = stageText;
  }
}

function updateAssistantCardDone(intent, plan) {
  if (!state.analysisCard) {
    renderAssistantAnalysisCard("已完成分析");
  }

  const lines = [
    `时间：${timeText(getFirst(intent.time_preference, intent.time))}`,
    `出行人群：${peopleText(intent)}`,
    `距离偏好：${distanceText(intent.distance_preference)}`,
    `饮食限制：${keywordText(getFirst(intent.dietary_restrictions, intent.diet_preference, intent.dietary_preference))}`,
    `活动偏好：${keywordText(getFirst(intent.activity_preferences, intent.activity_preference))}`,
  ];

  state.analysisCard.innerHTML = `
    <strong>已提取关键信息</strong>
    <div class="check-list">
      ${lines.map((line) => `<div><i data-lucide="check"></i><span>${escapeHtml(line)}</span></div>`).join("")}
    </div>
    <p style="margin-top:10px;">优先推荐：${escapeHtml(plan.shortTitle || plan.title)}</p>
  `;
  scrollChatToBottom();
  refreshIcons();
}

function updateAssistantCardError(message) {
  if (!state.analysisCard) {
    renderAssistantAnalysisCard("分析中断");
  }
  state.analysisCard.innerHTML = `
    <strong>规划暂时失败</strong>
    <div class="check-list">
      <div><i data-lucide="circle-alert"></i><span>${escapeHtml(message)}</span></div>
    </div>
  `;
  refreshIcons();
}

function renderParsedIntent(intent) {
  const cards = [
    ["calendar", "时间", timeText(getFirst(intent.time_preference, intent.time))],
    ["users", "出行人群", peopleText(intent)],
    ["baby", "儿童年龄", childAgeText(intent)],
    ["wallet", "预算", budgetText(intent.budget)],
    ["map-pin", "距离偏好", distanceText(intent.distance_preference)],
    ["utensils", "饮食限制", keywordText(getFirst(intent.dietary_restrictions, intent.diet_preference, intent.dietary_preference))],
    ["tree-pine", "活动偏好", keywordText(getFirst(intent.activity_preferences, intent.activity_preference))],
  ];

  els.intentResult.className = "analysis-grid";
  els.intentResult.innerHTML = cards
    .map(
      ([icon, label, value], index) => `
        <article class="intent-card" style="animation-delay:${index * 45}ms">
          <div class="icon"><i data-lucide="${icon}"></i></div>
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatValue(value))}</strong>
          </div>
        </article>
      `
    )
    .join("");

  els.agentNote.innerHTML = `
    <i data-lucide="sparkles"></i>
    <p>${escapeHtml(buildInsight(intent))}</p>
  `;
}

function renderTimeline(plan) {
  const schedule = normalizeSchedule(plan);
  const colors = ["var(--purple)", "var(--teal)", "var(--orange)", "var(--purple)", "var(--blue)"];
  const icons = ["car", "tree-pine", "baby", "utensils", "car"];

  els.bestPlanResult.className = "timeline";
  els.bestPlanResult.innerHTML = schedule
    .map(
      (item, index) => `
        <div class="timeline-item" style="animation-delay:${index * 70}ms">
          <div class="timeline-time">${escapeHtml(item.time)}</div>
          <div class="timeline-dot" style="background:${colors[index % colors.length]}">
            <i data-lucide="${icons[index % icons.length]}"></i>
          </div>
          <div class="timeline-card">
            <strong>${escapeHtml(item.title)}</strong>
            <div class="timeline-desc">${escapeHtml(item.description)}</div>
          </div>
          <div class="timeline-duration">${escapeHtml(item.duration)}</div>
        </div>
      `
    )
    .join("");
}

function renderAlternativePlans(plans) {
  const cards = plans
    .map((plan, index) => ({ plan, index }))
    .filter(({ index }) => index !== state.selectedPlanIndex)
    .slice(0, 2);

  els.alternativePlans.className = "alt-grid";
  els.alternativePlans.innerHTML = cards
    .map(
      ({ plan, index }) => `
        <article class="alt-card" data-plan-index="${index}">
          <div class="alt-head">
            <strong>${escapeHtml(planLabel(index))} · ${escapeHtml(plan.shortTitle)}</strong>
            <span class="score-badge">${formatScore(plan.score)}</span>
          </div>
          <p>${escapeHtml(plan.summary)}</p>
          <div class="alt-icons">
            <span><i data-lucide="map-pin"></i></span>
            <i data-lucide="arrow-right"></i>
            <span><i data-lucide="tree-pine"></i></span>
            <i data-lucide="arrow-right"></i>
            <span><i data-lucide="utensils"></i></span>
            <i data-lucide="arrow-right"></i>
            <span><i data-lucide="car"></i></span>
          </div>
        </article>
      `
    )
    .join("");

  els.alternativePlans.querySelectorAll(".alt-card").forEach((card) => {
    card.addEventListener("click", () => {
      state.selectedPlanIndex = Number(card.dataset.planIndex);
      renderSelectedPlan();
      refreshIcons();
    });
  });
}

function renderScoreBars(plans) {
  const comparablePlans = ensureThreePlans(plans);
  const rows = [
    ["距离匹配", [9.2, 8.7, 7.5]],
    ["预算匹配", [8.5, 9.0, 8.0]],
    ["场景适配", [9.0, 8.2, 8.8]],
  ];

  els.scoreCompare.className = "score-compare";
  els.scoreCompare.innerHTML = rows
    .map(
      ([label, defaults]) => `
        <div class="score-row">
          <label>${escapeHtml(label)}</label>
          ${comparablePlans
            .slice(0, 3)
            .map((plan, index) => {
              const score = clampScore(plan.score || defaults[index]);
              return `
                <div class="score-cell">
                  <small>方案${index + 1}</small>
                  <div class="bar"><i data-width="${score * 10}%"></i></div>
                  <strong>${score.toFixed(1)}</strong>
                </div>
              `;
            })
            .join("")}
        </div>
      `
    )
    .join("");

  requestAnimationFrame(() => {
    els.scoreCompare.querySelectorAll(".bar i").forEach((bar) => {
      bar.style.width = bar.dataset.width;
    });
  });
}

function renderRouteSummary(plan) {
  els.routeTitle.textContent = `${planLabel(state.selectedPlanIndex)} · 路线概览`;
  els.routeStats.innerHTML = `
    <span><i data-lucide="route"></i>总里程 ${escapeHtml(plan.totalDistance)}</span>
    <span><i data-lucide="clock"></i>预计时长 ${escapeHtml(plan.duration)}</span>
    <span><i data-lucide="map-pin"></i>打卡地点 ${normalizeSchedule(plan).length} 个</span>
    <span><i data-lucide="leaf"></i>适合季节 春、夏、秋</span>
  `;
}

function normalizeResponse(data, payload) {
  const intent = data?.parsed_intent || data?.intent || {};
  intent.raw_text = getFirst(intent.raw_text, payload.user_input);
  intent.start_location = getFirst(intent.start_location, payload.start_location);
  intent.parse_source = getFirst(intent.parse_source, "deepseek");
  intent.map_source = getFirst(intent.map_source, "amap");

  return {
    success: data?.success ?? data?.status === "success" ?? true,
    message: data?.message || "规划成功",
    intent,
    plans: normalizePlans(data?.plans, intent),
  };
}

function normalizePlans(plans, intent = {}) {
  const sourcePlans = Array.isArray(plans) && plans.length ? plans : DEFAULT_PLANS;
  const normalized = sourcePlans.map((plan, index) => normalizePlan(plan, index, intent));
  return ensureThreePlans(normalized);
}

function normalizePlan(plan = {}, index = 0, intent = {}) {
  const activity = normalizePlace(plan.activity_place || plan.activityPlace || plan.place, "活动地点");
  const restaurant = normalizePlace(plan.restaurant || plan.food_place, "轻食餐厅");
  const score = clampScore(getFirst(plan.score, plan.recommend_score, 8.8 - index * 0.3));
  const title = plan.title || `${activity.name} + ${restaurant.name} 半日方案`;

  return {
    ...plan,
    title,
    shortTitle: shortTitle(title),
    summary: plan.summary || buildPlanSummary(activity, restaurant, intent),
    activity_place: activity,
    restaurant,
    schedule: plan.schedule || plan.itinerary,
    estimated_cost: plan.estimated_cost || plan.cost || "预算待估算",
    score,
    duration: plan.estimated_duration || plan.duration || "约 4 小时",
    totalDistance: plan.total_distance || estimateDistance(activity, restaurant),
  };
}

function normalizePlace(place = {}, fallbackName) {
  return {
    name: place.name || fallbackName,
    category: place.category || "类型待确认",
    address: place.address || "地址待确认",
    distance: place.distance || (place.distance_km ? `约 ${place.distance_km} km` : "距离待确认"),
    reason: place.reason || "符合当前需求约束。",
    score: clampScore(place.score || place.rating || 8.5),
  };
}

function normalizeSchedule(plan) {
  const raw = plan.schedule;
  if (Array.isArray(raw) && raw.length) {
    return raw.map((item, index) => normalizeScheduleItem(item, index, plan));
  }
  return defaultSchedule(plan);
}

function normalizeScheduleItem(item, index, plan) {
  if (typeof item === "string") {
    const match = item.match(/^(\d{1,2}:\d{2})\s*(.*)$/);
    return {
      time: match ? match[1] : defaultTimes()[index] || "17:00",
      title: scheduleTitle(index, match ? match[2] : item, plan),
      description: match ? match[2] || item : item,
      duration: defaultDuration(index),
    };
  }

  return {
    time: item?.time || defaultTimes()[index] || "17:00",
    title: item?.title || scheduleTitle(index, "", plan),
    description: item?.description || item?.desc || "",
    duration: item?.duration || defaultDuration(index),
  };
}

function defaultSchedule(plan) {
  return [
    { time: "12:30", title: "出发", description: "从出发地出发，预计35分钟到达目的地", duration: "35分钟" },
    { time: "13:05", title: plan.activity_place.name, description: plan.activity_place.reason, duration: "90分钟" },
    { time: "15:50", title: plan.restaurant.name, description: plan.restaurant.reason, duration: "60分钟" },
    { time: "17:00", title: "返程", description: "愉快返程，到家休息", duration: "35分钟" },
  ];
}

function ensureThreePlans(plans) {
  const result = [...plans];
  while (result.length < 3) {
    const fallback = DEFAULT_PLANS[result.length] || DEFAULT_PLANS[0];
    result.push(normalizePlan(fallback, result.length));
  }
  return result;
}

function showError(message) {
  els.errorBanner.hidden = false;
  els.errorBanner.querySelector("span").textContent = message;
  refreshIcons();
}

function hideError() {
  els.errorBanner.hidden = true;
}

function buildInsight(intent) {
  const preferences = keywordText(getFirst(intent.activity_preferences, intent.activity_preference));
  const food = keywordText(getFirst(intent.dietary_restrictions, intent.diet_preference, intent.restaurant_keywords));
  const hasChild = intent.has_children || intent.has_child || childAgeText(intent) !== "未识别";

  if (hasChild) {
    return `为你优先推荐“轻户外 + 亲子乐园 + ${food}”组合的行程，兼顾趣味性与健康需求。`;
  }

  return `为你优先推荐“低距离 + ${preferences} + 合理餐饮”的半日方案，兼顾时间、预算和体验。`;
}

function buildPlanSummary(activity, restaurant) {
  return `先去 ${activity.name} 放松活动，再去 ${restaurant.name} 就近用餐，整体节奏轻松可执行。`;
}

function peopleText(intent) {
  const count = getFirst(intent.people_count, intent.peopleCount);
  const companions = companionsText(getFirst(intent.companions, intent.people, intent.group_type));
  return `${count ? `${count}人` : "人数未识别"} · ${companions}`;
}

function childAgeText(intent) {
  const value = getFirst(intent.children_ages, intent.child_age, intent.childAge);
  if (Array.isArray(value)) {
    return value.length ? value.map((age) => `${age}岁`).join("、") : "未识别";
  }
  return value ? `${value}岁` : "未识别";
}

function scheduleTitle(index, text, plan) {
  if (index === 0) return "出发";
  if (index === 1) return plan.activity_place?.name || "活动地点";
  if (index === 2) return plan.restaurant?.name || "餐厅";
  if (index >= 3) return "返程";
  return text || "行程节点";
}

function defaultTimes() {
  return ["12:30", "13:05", "14:35", "15:50", "17:00"];
}

function defaultDuration(index) {
  return ["35分钟", "90分钟", "75分钟", "60分钟", "35分钟"][index] || "45分钟";
}

function estimateDistance(activity, restaurant) {
  const values = [extractDistance(activity.distance), extractDistance(restaurant.distance)].filter((item) => item > 0);
  const total = values.length ? values.reduce((sum, item) => sum + item, 0) + 3.6 : 16.2;
  return `约 ${total.toFixed(1)} 公里`;
}

function extractDistance(text = "") {
  const match = String(text).match(/([\d.]+)\s*(km|公里|m|米)/i);
  if (!match) return 0;
  const value = Number(match[1]);
  return /m|米/i.test(match[2]) ? value / 1000 : value;
}

function shortTitle(title = "") {
  return title.replace(/^推荐方案：|^备选方案：|^轻量方案：|^方案[一二三] · /, "");
}

function planLabel(index) {
  return ["方案一", "方案二", "方案三"][index] || `方案${index + 1}`;
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
    spouse: "夫妻",
    wife: "妻子",
    husband: "丈夫",
    child: "孩子",
    children: "孩子",
    friend: "朋友",
    friends: "朋友",
    family: "家人",
    couple: "情侣",
  };
  return normalizeArray(value)
    .map((item) => map[String(item).toLowerCase()] || item)
    .join(" + ") || "未识别";
}

function keywordText(value) {
  const map = {
    park: "公园",
    "children playground": "亲子乐园",
    playground: "亲子乐园",
    parent_child: "亲子",
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

function formatValue(value) {
  if (value === null || value === undefined || value === "") return "未识别";
  if (Array.isArray(value)) return value.length ? value.join("、") : "未识别";
  return String(value);
}

function formatScore(score) {
  return clampScore(score).toFixed(1);
}

function clampScore(score) {
  const value = Number(score);
  if (Number.isNaN(value)) return 8.5;
  const normalized = value > 10 && value <= 100 ? value / 10 : value;
  return Math.max(0, Math.min(normalized, 10));
}

function normalizeArray(value) {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

function getFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scrollChatToBottom() {
  const scrollParent = els.chatStream.parentElement;
  scrollParent.scrollTop = scrollParent.scrollHeight;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
