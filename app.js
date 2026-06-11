const storageKey = "wealth-dashboard-v1";
const cloudConfigKey = "wealth-dashboard-cloud-config-v1";
const cloudMetaKey = "wealth-dashboard-cloud-meta-v1";

const palette = ["#116a5b", "#d78b1f", "#2b67a0", "#7a4d98", "#b64434", "#58705f", "#384f78"];

const demoState = {
  riskProfile: "balanced",
  goal: {
    targetNetWorth: 3000000,
    monthlyContribution: 18000,
    expectedReturn: 6.5
  },
  assets: [
    {
      id: "a1",
      name: "招商银行活期与货币基金",
      type: "现金类",
      account: "日常资金池",
      current: 220000,
      cost: 220000,
      currency: "CNY",
      risk: "低",
      liquidity: "高",
      note: "覆盖 8-10 个月家庭支出"
    },
    {
      id: "a2",
      name: "沪深 300 ETF",
      type: "权益类",
      account: "证券账户",
      current: 360000,
      cost: 330000,
      currency: "CNY",
      risk: "中",
      liquidity: "高",
      note: "宽基指数长期仓位"
    },
    {
      id: "a3",
      name: "纳斯达克 100 ETF",
      type: "权益类",
      account: "海外基金账户",
      current: 280000,
      cost: 240000,
      currency: "CNY",
      risk: "高",
      liquidity: "高",
      note: "科技成长敞口"
    },
    {
      id: "a4",
      name: "中短债基金",
      type: "固收类",
      account: "基金账户",
      current: 310000,
      cost: 300000,
      currency: "CNY",
      risk: "低",
      liquidity: "中",
      note: "低波动防守资产"
    },
    {
      id: "a5",
      name: "深圳自住房净值",
      type: "房产",
      account: "家庭资产",
      current: 1450000,
      cost: 1380000,
      currency: "CNY",
      risk: "中",
      liquidity: "低",
      note: "已扣除剩余房贷后的估算市值"
    },
    {
      id: "a6",
      name: "黄金 ETF",
      type: "商品类",
      account: "证券账户",
      current: 120000,
      cost: 105000,
      currency: "CNY",
      risk: "中",
      liquidity: "高",
      note: "组合对冲资产"
    }
  ],
  liabilities: [
    {
      id: "l1",
      name: "住房按揭",
      type: "长期贷款",
      balance: 680000,
      rate: 3.45,
      monthlyPayment: 4200,
      dueDate: "2042-09-01"
    },
    {
      id: "l2",
      name: "信用卡未出账",
      type: "短期负债",
      balance: 18600,
      rate: 0,
      monthlyPayment: 18600,
      dueDate: "2026-07-05"
    }
  ]
};

let state = loadState();
let cloudConfig = loadCloudConfig();
let cloudMeta = loadCloudMeta();
let isSyncing = false;
let dialogMode = "asset";
let editingId = null;

const els = {
  totalAssets: document.querySelector("#totalAssets"),
  assetDelta: document.querySelector("#assetDelta"),
  totalLiabilities: document.querySelector("#totalLiabilities"),
  debtRatio: document.querySelector("#debtRatio"),
  netWorth: document.querySelector("#netWorth"),
  goalGap: document.querySelector("#goalGap"),
  monthlyContribution: document.querySelector("#monthlyContribution"),
  projectionText: document.querySelector("#projectionText"),
  allocationDonut: document.querySelector("#allocationDonut"),
  allocationLegend: document.querySelector("#allocationLegend"),
  liquidityText: document.querySelector("#liquidityText"),
  riskAlerts: document.querySelector("#riskAlerts"),
  riskScore: document.querySelector("#riskScore"),
  assetRows: document.querySelector("#assetRows"),
  liabilityRows: document.querySelector("#liabilityRows"),
  riskProfile: document.querySelector("#riskProfile"),
  riskProfileText: document.querySelector("#riskProfileText"),
  targetNetWorth: document.querySelector("#targetNetWorth"),
  goalMonthlyInput: document.querySelector("#goalMonthlyInput"),
  expectedReturn: document.querySelector("#expectedReturn"),
  progressLabel: document.querySelector("#progressLabel"),
  progressAmount: document.querySelector("#progressAmount"),
  goalProgress: document.querySelector("#goalProgress"),
  dialog: document.querySelector("#recordDialog"),
  recordForm: document.querySelector("#recordForm"),
  formFields: document.querySelector("#formFields"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogEyebrow: document.querySelector("#dialogEyebrow"),
  syncStatus: document.querySelector("#syncStatus"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseAnonKey: document.querySelector("#supabaseAnonKey"),
  syncSpaceId: document.querySelector("#syncSpaceId"),
  autoSyncEnabled: document.querySelector("#autoSyncEnabled"),
  localUpdatedAt: document.querySelector("#localUpdatedAt"),
  lastSyncAt: document.querySelector("#lastSyncAt"),
  cloudUpdatedAt: document.querySelector("#cloudUpdatedAt")
};

function loadState() {
  const stored = localStorage.getItem(storageKey);
  if (!stored) return structuredClone(demoState);
  try {
    return { ...structuredClone(demoState), ...JSON.parse(stored) };
  } catch {
    return structuredClone(demoState);
  }
}

function saveState({ markChange = true, sync = true } = {}) {
  localStorage.setItem(storageKey, JSON.stringify(state));
  if (markChange) {
    cloudMeta.lastLocalChangeAt = new Date().toISOString();
    saveCloudMeta();
  }
  if (sync && cloudConfig.autoSync && !isSyncing) {
    syncToCloud({ silent: true });
  }
}

function loadCloudConfig() {
  const stored = localStorage.getItem(cloudConfigKey);
  if (!stored) return { supabaseUrl: "", supabaseAnonKey: "", syncSpaceId: "", autoSync: false };
  try {
    return { supabaseUrl: "", supabaseAnonKey: "", syncSpaceId: "", autoSync: false, ...JSON.parse(stored) };
  } catch {
    return { supabaseUrl: "", supabaseAnonKey: "", syncSpaceId: "", autoSync: false };
  }
}

function saveCloudConfig() {
  cloudConfig = {
    supabaseUrl: els.supabaseUrl.value.trim().replace(/\/$/, ""),
    supabaseAnonKey: els.supabaseAnonKey.value.trim(),
    syncSpaceId: els.syncSpaceId.value.trim(),
    autoSync: els.autoSyncEnabled.checked
  };
  localStorage.setItem(cloudConfigKey, JSON.stringify(cloudConfig));
  renderCloudConfig();
  setSyncStatus(isCloudConfigured() ? "已保存配置" : "未配置");
}

function loadCloudMeta() {
  const fallback = {
    deviceId: crypto.randomUUID(),
    lastLocalChangeAt: null,
    lastSyncAt: null,
    lastCloudUpdatedAt: null
  };
  const stored = localStorage.getItem(cloudMetaKey);
  if (!stored) return fallback;
  try {
    return { ...fallback, ...JSON.parse(stored) };
  } catch {
    return fallback;
  }
}

function saveCloudMeta() {
  localStorage.setItem(cloudMetaKey, JSON.stringify(cloudMeta));
}

function isCloudConfigured() {
  return Boolean(cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey && cloudConfig.syncSpaceId);
}

function money(value) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function percent(value) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function sum(list, key) {
  return list.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function groupAssetsByType() {
  return state.assets.reduce((groups, asset) => {
    groups[asset.type] = (groups[asset.type] || 0) + Number(asset.current || 0);
    return groups;
  }, {});
}

function getTotals() {
  const assets = sum(state.assets, "current");
  const cost = sum(state.assets, "cost");
  const liabilities = sum(state.liabilities, "balance");
  return {
    assets,
    cost,
    liabilities,
    netWorth: assets - liabilities
  };
}

function render() {
  const totals = getTotals();
  const gain = totals.assets - totals.cost;
  const debtRatio = totals.assets > 0 ? (totals.liabilities / totals.assets) * 100 : 0;
  const goalGap = Math.max(state.goal.targetNetWorth - totals.netWorth, 0);

  els.totalAssets.textContent = money(totals.assets);
  els.assetDelta.textContent = `${gain >= 0 ? "较成本增长" : "较成本回撤"} ${money(Math.abs(gain))}`;
  els.totalLiabilities.textContent = money(totals.liabilities);
  els.debtRatio.textContent = `负债率 ${percent(debtRatio)}`;
  els.netWorth.textContent = money(totals.netWorth);
  els.goalGap.textContent = goalGap > 0 ? `距离目标 ${money(goalGap)}` : "已达到目标";
  els.monthlyContribution.textContent = money(state.goal.monthlyContribution);
  els.projectionText.textContent = projectionText(totals.netWorth);

  renderGoal(totals.netWorth);
  renderAllocation(totals.assets);
  renderRisk(totals, debtRatio);
  renderTables();
  renderRiskProfile();
  renderCloudConfig();
}

function projectionText(netWorth) {
  const gap = Math.max(state.goal.targetNetWorth - netWorth, 0);
  if (gap === 0) return "目标已达成";
  const monthlyReturn = Number(state.goal.expectedReturn || 0) / 100 / 12;
  const contribution = Number(state.goal.monthlyContribution || 0);
  if (contribution <= 0 && monthlyReturn <= 0) return "需要设置月投入或收益假设";

  let months = 0;
  let projected = netWorth;
  while (projected < state.goal.targetNetWorth && months < 600) {
    projected = projected * (1 + monthlyReturn) + contribution;
    months += 1;
  }
  if (months >= 600) return "按当前假设 50 年内难以达成";
  const years = Math.floor(months / 12);
  const leftMonths = months % 12;
  return `按当前假设约 ${years} 年 ${leftMonths} 个月达成`;
}

function renderGoal(netWorth) {
  els.targetNetWorth.value = state.goal.targetNetWorth;
  els.goalMonthlyInput.value = state.goal.monthlyContribution;
  els.expectedReturn.value = state.goal.expectedReturn;

  const ratio = state.goal.targetNetWorth > 0 ? Math.min((netWorth / state.goal.targetNetWorth) * 100, 100) : 0;
  els.progressLabel.textContent = `目标进度 ${percent(ratio)}`;
  els.progressAmount.textContent = `${money(netWorth)} / ${money(state.goal.targetNetWorth)}`;
  els.goalProgress.style.width = `${ratio}%`;
}

function renderAllocation(totalAssets) {
  const grouped = groupAssetsByType();
  const entries = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  let cursor = 0;
  const segments = entries.map(([type, value], index) => {
    const next = cursor + (value / totalAssets) * 100;
    const segment = `${palette[index % palette.length]} ${cursor}% ${next}%`;
    cursor = next;
    return segment;
  });

  els.allocationDonut.style.background = segments.length
    ? `conic-gradient(${segments.join(", ")})`
    : "conic-gradient(#dce4e1 0 100%)";

  els.allocationLegend.innerHTML = entries
    .map(([type, value], index) => {
      const ratio = totalAssets > 0 ? (value / totalAssets) * 100 : 0;
      return `
        <div class="legend-item">
          <span class="legend-swatch" style="background:${palette[index % palette.length]}"></span>
          <span>${type}</span>
          <strong>${percent(ratio)}</strong>
        </div>
      `;
    })
    .join("");

  const liquidAssets = state.assets
    .filter((asset) => asset.liquidity === "高")
    .reduce((total, asset) => total + Number(asset.current || 0), 0);
  const monthlyDebt = sum(state.liabilities, "monthlyPayment");
  const liquidityMonths = monthlyDebt > 0 ? liquidAssets / monthlyDebt : 24;
  els.liquidityText.textContent = liquidityMonths >= 12 ? "流动性充足" : "流动性偏紧";
}

function renderRisk(totals, debtRatio) {
  const highRiskValue = state.assets
    .filter((asset) => asset.risk === "高")
    .reduce((total, asset) => total + Number(asset.current || 0), 0);
  const lowLiquidityValue = state.assets
    .filter((asset) => asset.liquidity === "低")
    .reduce((total, asset) => total + Number(asset.current || 0), 0);
  const equityValue = state.assets
    .filter((asset) => asset.type === "权益类")
    .reduce((total, asset) => total + Number(asset.current || 0), 0);

  const highRiskRatio = totals.assets > 0 ? (highRiskValue / totals.assets) * 100 : 0;
  const lowLiquidityRatio = totals.assets > 0 ? (lowLiquidityValue / totals.assets) * 100 : 0;
  const equityRatio = totals.assets > 0 ? (equityValue / totals.assets) * 100 : 0;
  const score = Math.min(Math.round(highRiskRatio * 0.45 + debtRatio * 0.35 + lowLiquidityRatio * 0.2), 100);

  els.riskScore.textContent = `${score} 分`;

  const alerts = [];
  if (debtRatio > 35) {
    alerts.push(["负债率偏高", `当前负债率 ${percent(debtRatio)}，建议优先压降高息或短期负债。`]);
  } else {
    alerts.push(["负债压力可控", `当前负债率 ${percent(debtRatio)}，持续关注月供现金流覆盖。`]);
  }

  if (highRiskRatio > riskThreshold().highRisk) {
    alerts.push(["高风险资产占比偏高", `高风险资产占比 ${percent(highRiskRatio)}，超过当前风险偏好阈值。`]);
  } else {
    alerts.push(["高风险敞口可控", `高风险资产占比 ${percent(highRiskRatio)}，处于当前风险偏好范围。`]);
  }

  if (lowLiquidityRatio > 45) {
    alerts.push(["低流动性资产偏重", `房产等低流动性资产占比 ${percent(lowLiquidityRatio)}，应保留足够现金缓冲。`]);
  }

  if (equityRatio < 20 && state.riskProfile !== "conservative") {
    alerts.push(["增长资产不足", `权益类资产占比 ${percent(equityRatio)}，长期增长动力可能不足。`]);
  }

  els.riskAlerts.innerHTML = alerts
    .map(
      ([title, body]) => `
      <div class="alert-item">
        <strong>${title}</strong>
        <p>${body}</p>
      </div>
    `
    )
    .join("");
}

function riskThreshold() {
  return {
    conservative: { highRisk: 15 },
    balanced: { highRisk: 25 },
    growth: { highRisk: 40 }
  }[state.riskProfile];
}

function renderRiskProfile() {
  els.riskProfile.value = state.riskProfile;
  const copy = {
    conservative: "以现金流、防守资产和低波动增长为优先。",
    balanced: "在稳健现金流基础上保留适度权益资产。",
    growth: "接受更高波动，换取更高长期增长弹性。"
  };
  els.riskProfileText.textContent = copy[state.riskProfile];
}

function renderCloudConfig() {
  els.supabaseUrl.value = cloudConfig.supabaseUrl || "";
  els.supabaseAnonKey.value = cloudConfig.supabaseAnonKey || "";
  els.syncSpaceId.value = cloudConfig.syncSpaceId || "";
  els.autoSyncEnabled.checked = Boolean(cloudConfig.autoSync);
  els.localUpdatedAt.textContent = formatDateTime(cloudMeta.lastLocalChangeAt);
  els.lastSyncAt.textContent = formatDateTime(cloudMeta.lastSyncAt);
  els.cloudUpdatedAt.textContent = formatDateTime(cloudMeta.lastCloudUpdatedAt);
  if (!isCloudConfigured()) {
    setSyncStatus("未配置");
  }
}

function renderTables() {
  els.assetRows.innerHTML = state.assets
    .map((asset) => {
      const gain = Number(asset.current || 0) - Number(asset.cost || 0);
      const gainRate = asset.cost > 0 ? (gain / asset.cost) * 100 : 0;
      return `
        <tr>
          <td>${asset.name}</td>
          <td>${asset.type}</td>
          <td>${asset.account}</td>
          <td>${money(asset.current)}</td>
          <td>${money(asset.cost)}</td>
          <td class="${gain >= 0 ? "positive" : "negative"}">${gain >= 0 ? "+" : "-"}${money(Math.abs(gain))} / ${percent(gainRate)}</td>
          <td>${asset.risk}</td>
          <td>${asset.liquidity}</td>
          <td>
            <div class="row-actions">
              <button class="text-button" type="button" data-action="edit-asset" data-id="${asset.id}">编辑</button>
              <button class="text-button danger" type="button" data-action="delete-asset" data-id="${asset.id}">删除</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  els.liabilityRows.innerHTML = state.liabilities
    .map(
      (item) => `
        <tr>
          <td>${item.name}</td>
          <td>${item.type}</td>
          <td>${money(item.balance)}</td>
          <td>${percent(Number(item.rate || 0))}</td>
          <td>${money(item.monthlyPayment)}</td>
          <td>${item.dueDate || "待确认"}</td>
          <td>
            <div class="row-actions">
              <button class="text-button" type="button" data-action="edit-liability" data-id="${item.id}">编辑</button>
              <button class="text-button danger" type="button" data-action="delete-liability" data-id="${item.id}">删除</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");
}

function openAssetDialog(asset) {
  dialogMode = "asset";
  editingId = asset?.id || null;
  els.dialogTitle.textContent = asset ? "编辑资产" : "新增资产";
  els.dialogEyebrow.textContent = "Asset";
  els.formFields.innerHTML = `
    ${field("name", "名称", asset?.name || "", "text")}
    ${selectField("type", "类型", asset?.type || "现金类", ["现金类", "权益类", "固收类", "房产", "商品类", "其他"])}
    ${field("account", "账户", asset?.account || "", "text")}
    ${field("current", "当前金额", asset?.current || 0, "number")}
    ${field("cost", "成本", asset?.cost || 0, "number")}
    ${selectField("risk", "风险等级", asset?.risk || "中", ["低", "中", "高"])}
    ${selectField("liquidity", "流动性", asset?.liquidity || "高", ["高", "中", "低"])}
    ${field("note", "备注", asset?.note || "", "text", "1", false)}
  `;
  els.dialog.showModal();
}

function openLiabilityDialog(item) {
  dialogMode = "liability";
  editingId = item?.id || null;
  els.dialogTitle.textContent = item ? "编辑负债" : "新增负债";
  els.dialogEyebrow.textContent = "Liability";
  els.formFields.innerHTML = `
    ${field("name", "名称", item?.name || "", "text")}
    ${selectField("type", "类型", item?.type || "短期负债", ["短期负债", "长期贷款", "信用卡", "消费贷", "其他"])}
    ${field("balance", "余额", item?.balance || 0, "number")}
    ${field("rate", "年利率", item?.rate || 0, "number", "0.01")}
    ${field("monthlyPayment", "月供", item?.monthlyPayment || 0, "number")}
    ${field("dueDate", "到期日", item?.dueDate || "", "date", "1", false)}
  `;
  els.dialog.showModal();
}

function field(name, label, value, type, step = "1", required = true) {
  return `
    <label>
      ${label}
      <input name="${name}" type="${type}" value="${escapeHtml(value)}" ${type === "number" ? `step="${step}" min="0"` : ""} ${required ? "required" : ""} />
    </label>
  `;
}

function selectField(name, label, value, options) {
  return `
    <label>
      ${label}
      <select name="${name}">
        ${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}
      </select>
    </label>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function submitRecord(event) {
  event.preventDefault();
  const formData = new FormData(els.recordForm);
  if (dialogMode === "asset") {
    const asset = {
      id: editingId || crypto.randomUUID(),
      name: formData.get("name").trim(),
      type: formData.get("type"),
      account: formData.get("account").trim(),
      current: Number(formData.get("current")),
      cost: Number(formData.get("cost")),
      currency: "CNY",
      risk: formData.get("risk"),
      liquidity: formData.get("liquidity"),
      note: formData.get("note").trim()
    };
    upsert("assets", asset);
  } else {
    const liability = {
      id: editingId || crypto.randomUUID(),
      name: formData.get("name").trim(),
      type: formData.get("type"),
      balance: Number(formData.get("balance")),
      rate: Number(formData.get("rate")),
      monthlyPayment: Number(formData.get("monthlyPayment")),
      dueDate: formData.get("dueDate")
    };
    upsert("liabilities", liability);
  }
  saveState();
  render();
  els.dialog.close();
}

function upsert(collection, record) {
  const index = state[collection].findIndex((item) => item.id === record.id);
  if (index >= 0) {
    state[collection][index] = record;
  } else {
    state[collection].push(record);
  }
}

function deleteRecord(collection, id) {
  state[collection] = state[collection].filter((item) => item.id !== id);
  saveState();
  render();
}

function saveGoal() {
  state.goal.targetNetWorth = Number(els.targetNetWorth.value || 0);
  state.goal.monthlyContribution = Number(els.goalMonthlyInput.value || 0);
  state.goal.expectedReturn = Number(els.expectedReturn.value || 0);
  saveState();
  render();
}

function exportCsv() {
  const rows = [
    ["类别", "名称", "类型", "账户", "当前金额/余额", "成本/利率", "月供", "风险", "流动性", "到期日", "备注"],
    ...state.assets.map((asset) => [
      "资产",
      asset.name,
      asset.type,
      asset.account,
      asset.current,
      asset.cost,
      "",
      asset.risk,
      asset.liquidity,
      "",
      asset.note
    ]),
    ...state.liabilities.map((item) => [
      "负债",
      item.name,
      item.type,
      "",
      item.balance,
      item.rate,
      item.monthlyPayment,
      "",
      "",
      item.dueDate,
      ""
    ])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "wealth-dashboard.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function setSyncStatus(message) {
  els.syncStatus.textContent = message;
}

function formatDateTime(value) {
  if (!value) return "暂无";
  return new Date(value).toLocaleString("zh-CN");
}

function snapshotsEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isRemoteNewer(remote) {
  if (!remote?.updated_at) return false;
  if (!cloudMeta.lastCloudUpdatedAt) return !snapshotsEqual(remote.payload, state);
  return new Date(remote.updated_at).getTime() > new Date(cloudMeta.lastCloudUpdatedAt).getTime() + 1000;
}

async function supabaseRequest(path, options = {}) {
  if (!isCloudConfigured()) {
    throw new Error("请先填写并保存云同步配置。");
  }

  const response = await fetch(`${cloudConfig.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: cloudConfig.supabaseAnonKey,
      Authorization: `Bearer ${cloudConfig.supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `云端请求失败：${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function getCloudSnapshot() {
  return supabaseRequest("rpc/get_wealth_snapshot", {
    method: "POST",
    body: JSON.stringify({
      p_sync_space_id: cloudConfig.syncSpaceId
    })
  });
}

async function syncToCloud({ silent = false, force = false } = {}) {
  if (!isCloudConfigured()) return;

  try {
    isSyncing = true;
    if (!silent) setSyncStatus("上传中");

    if (!force) {
      const remoteRows = await getCloudSnapshot();
      const remote = remoteRows[0];
      if (remote && isRemoteNewer(remote)) {
        setSyncStatus("云端有新数据");
        if (silent) return;
        const shouldOverwrite = window.confirm("云端数据比本机记录更新。继续上传会覆盖云端版本，是否继续？");
        if (!shouldOverwrite) return;
      }
    }

    const rows = await supabaseRequest("rpc/upsert_wealth_snapshot", {
      method: "POST",
      body: JSON.stringify({
        p_sync_space_id: cloudConfig.syncSpaceId,
        p_payload: {
          ...state,
          cloud: {
            deviceId: cloudMeta.deviceId,
            savedAt: new Date().toISOString()
          }
        }
      })
    });
    cloudMeta.lastSyncAt = new Date().toISOString();
    cloudMeta.lastCloudUpdatedAt = rows[0]?.updated_at || cloudMeta.lastSyncAt;
    saveCloudMeta();
    renderCloudConfig();
    setSyncStatus("已同步");
  } catch (error) {
    setSyncStatus(silent ? "同步失败" : `同步失败`);
    if (!silent) alert(error.message);
  } finally {
    isSyncing = false;
  }
}

async function pullFromCloud() {
  try {
    isSyncing = true;
    setSyncStatus("拉取中");
    const rows = await getCloudSnapshot();
    if (!rows.length) {
      setSyncStatus("云端无数据");
      return;
    }
    if (cloudMeta.lastLocalChangeAt && cloudMeta.lastSyncAt) {
      const localChangedAfterSync = new Date(cloudMeta.lastLocalChangeAt) > new Date(cloudMeta.lastSyncAt);
      if (localChangedAfterSync && !snapshotsEqual(rows[0].payload, state)) {
        const shouldOverwrite = window.confirm("本机有尚未同步的修改。从云端拉取会覆盖本机数据，是否继续？");
        if (!shouldOverwrite) {
          setSyncStatus("已取消拉取");
          return;
        }
      }
    }
    state = { ...structuredClone(demoState), ...rows[0].payload };
    saveState({ markChange: false, sync: false });
    cloudMeta.lastSyncAt = new Date().toISOString();
    cloudMeta.lastCloudUpdatedAt = rows[0].updated_at;
    saveCloudMeta();
    render();
    setSyncStatus(`已拉取 ${new Date(rows[0].updated_at).toLocaleString("zh-CN")}`);
  } catch (error) {
    setSyncStatus("拉取失败");
    alert(error.message);
  } finally {
    isSyncing = false;
  }
}

async function testCloudConnection() {
  try {
    setSyncStatus("测试中");
    const rows = await getCloudSnapshot();
    if (rows.length) {
      cloudMeta.lastCloudUpdatedAt = rows[0].updated_at;
      saveCloudMeta();
      renderCloudConfig();
      setSyncStatus("连接正常");
    } else {
      setSyncStatus("连接正常，云端无数据");
    }
  } catch (error) {
    setSyncStatus("连接失败");
    alert(error.message);
  }
}

document.querySelector("#addAsset").addEventListener("click", () => openAssetDialog());
document.querySelector("#addLiability").addEventListener("click", () => openLiabilityDialog());
document.querySelector("#saveGoal").addEventListener("click", saveGoal);
document.querySelector("#exportCsv").addEventListener("click", exportCsv);
document.querySelector("#saveCloudConfig").addEventListener("click", saveCloudConfig);
document.querySelector("#generateSyncSpace").addEventListener("click", () => {
  els.syncSpaceId.value = crypto.randomUUID();
});
document.querySelector("#testCloud").addEventListener("click", testCloudConnection);
document.querySelector("#pullCloud").addEventListener("click", pullFromCloud);
document.querySelector("#pushCloud").addEventListener("click", () => syncToCloud({ silent: false }));
document.querySelector("#clearCloudConfig").addEventListener("click", () => {
  cloudConfig = { supabaseUrl: "", supabaseAnonKey: "", syncSpaceId: "", autoSync: false };
  localStorage.removeItem(cloudConfigKey);
  renderCloudConfig();
});
document.querySelector("#resetDemo").addEventListener("click", () => {
  state = structuredClone(demoState);
  saveState();
  render();
});

els.riskProfile.addEventListener("change", (event) => {
  state.riskProfile = event.target.value;
  saveState();
  render();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "edit-asset") openAssetDialog(state.assets.find((asset) => asset.id === id));
  if (action === "edit-liability") openLiabilityDialog(state.liabilities.find((item) => item.id === id));
  if (action === "delete-asset") deleteRecord("assets", id);
  if (action === "delete-liability") deleteRecord("liabilities", id);
});

els.recordForm.addEventListener("submit", submitRecord);
document.querySelector("#cancelDialog").addEventListener("click", () => els.dialog.close());
document.querySelector("#closeDialog").addEventListener("click", () => els.dialog.close());

render();
