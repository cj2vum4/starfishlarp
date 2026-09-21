"use strict";

function defaultApiBaseUrl() {
  const isLocal = ["127.0.0.1", "localhost"].includes(location.hostname);
  return isLocal ? "http://localhost:3000" : "https://fengtuz-server.onrender.com";
}

const API_BASE_URL = defaultApiBaseUrl();

const FENGTUZ_CONFIG = Object.freeze({
  script: "fengtuz",
  sessionPrefix: "RT-",
  apiBaseUrl: API_BASE_URL,
  wsBaseUrl: API_BASE_URL.replace(/^http/, "ws"),
  cardsPageSize: 500,
  roles: [
    { id: "xia-tong", name: "夏瞳" },
    { id: "jian-feifei", name: "簡菲菲" },
    { id: "jiang-qin", name: "姜沁" },
    { id: "jian-ci", name: "簡辭" },
    { id: "lin-yunshu", name: "林雲書" },
    { id: "wang-zhiyu", name: "王之喻" }
  ],
  phases: [
    "開場與分角",
    "故事背景與規則",
    "卡牌線索搜證",
    "搜證卡環節",
    "觸發線索",
    "第四幕雙搜",
    "飛升儀式與結局"
  ]
});

function createTraditionalConverter() {
  if (window.OpenCC && typeof window.OpenCC.Converter === "function") {
    return window.OpenCC.Converter({ from: "cn", to: "tw" });
  }

  console.warn("OpenCC 未載入；暫時保留資料庫原文，頁面其他功能仍可使用。");
  return function safeIdentityConverter(value) {
    return String(value ?? "");
  };
}

function normalizeSessionCode(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-");
}

function isRabbitSessionCode(value) {
  return /^RT-[A-Z0-9]{4,10}$/.test(value);
}

function generateRabbitSessionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return FENGTUZ_CONFIG.sessionPrefix + suffix;
}

function normalizeGameState(rawState) {
  const raw = rawState && typeof rawState === "object" ? rawState : {};
  const releasedClues =
    raw.releasedClues && typeof raw.releasedClues === "object"
      ? raw.releasedClues
      : {};

  return {
    script: raw.script || "",
    version: Number(raw.version) || 1,
    revision: Number(raw.revision) || 0,
    status: raw.status === "ended" ? "ended" : "active",
    currentPhase: Math.min(
      Math.max(Number(raw.currentPhase) || 0, 0),
      FENGTUZ_CONFIG.phases.length - 1
    ),
    releasedClues,
    broadcasts: Array.isArray(raw.broadcasts) ? raw.broadcasts : [],
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString()
  };
}

function validateRabbitState(rawState) {
  const state = normalizeGameState(rawState);
  if (state.script !== FENGTUZ_CONFIG.script) {
    throw new Error("此場次不是《瘋兔子》，請向主持人確認場次程式碼。");
  }
  return state;
}

function displayCardRecord(record, converter) {
  return {
    id: Number(record.id),
    filename: converter(String(record.filename ?? "")),
    folder: converter(String(record.folder ?? "")),
    pageNum: Number(record.pageNum) || 0,
    text: converter(String(record.text ?? ""))
  };
}

async function apiRequest(method, path, body) {
  const response = await fetch(FENGTUZ_CONFIG.apiBaseUrl + path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    const error = new Error(payload?.error || "連線失敗，請稍後再試。");
    error.status = response.status;
    error.code = payload?.code;
    throw error;
  }

  return payload;
}

async function createSessionApi(code) {
  const payload = await apiRequest("POST", "/api/sessions", { code });
  return payload.session;
}

async function fetchSessionApi(sessionCode) {
  try {
    const payload = await apiRequest(
      "GET",
      `/api/sessions/${encodeURIComponent(sessionCode)}`
    );
    return payload.session;
  } catch (error) {
    if (error.code === "NOT_FOUND") {
      return null;
    }
    throw error;
  }
}

async function endSessionApi(sessionCode) {
  const payload = await apiRequest(
    "POST",
    `/api/sessions/${encodeURIComponent(sessionCode)}/end`
  );
  return payload.session;
}

async function setPhaseApi(sessionCode, phase) {
  const payload = await apiRequest(
    "POST",
    `/api/sessions/${encodeURIComponent(sessionCode)}/phase`,
    { phase }
  );
  return payload.session;
}

async function releaseClueApi(sessionCode, cardId, recipient) {
  const payload = await apiRequest(
    "POST",
    `/api/sessions/${encodeURIComponent(sessionCode)}/clues/${encodeURIComponent(cardId)}/release`,
    { recipient }
  );
  return payload.session;
}

async function revokeClueApi(sessionCode, cardId) {
  const payload = await apiRequest(
    "POST",
    `/api/sessions/${encodeURIComponent(sessionCode)}/clues/${encodeURIComponent(cardId)}/revoke`
  );
  return payload.session;
}

async function sendBroadcastApi(sessionCode, message) {
  const payload = await apiRequest(
    "POST",
    `/api/sessions/${encodeURIComponent(sessionCode)}/broadcasts`,
    { message }
  );
  return payload.session;
}

async function fetchPlayersApi(sessionCode) {
  const payload = await apiRequest(
    "GET",
    `/api/sessions/${encodeURIComponent(sessionCode)}/players`
  );
  return payload.players;
}

async function joinPlayerApi(sessionCode, roleId, nickname) {
  const payload = await apiRequest(
    "POST",
    `/api/sessions/${encodeURIComponent(sessionCode)}/players`,
    { roleId, nickname }
  );
  return payload.player;
}

async function leavePlayerApi(sessionCode, roleId) {
  await apiRequest(
    "DELETE",
    `/api/sessions/${encodeURIComponent(sessionCode)}/players/${encodeURIComponent(roleId)}`
  );
}

async function fetchCardsPage(offset, limit) {
  return apiRequest(
    "GET",
    `/api/cards?script=${encodeURIComponent(FENGTUZ_CONFIG.script)}&offset=${offset}&limit=${limit}`
  );
}

async function fetchAllRabbitCards(converter, onProgress) {
  const allRecords = [];
  let from = 0;

  while (true) {
    const page = await fetchCardsPage(from, FENGTUZ_CONFIG.cardsPageSize);
    const records = page.cards || [];
    allRecords.push(...records.map((record) => displayCardRecord(record, converter)));

    if (typeof onProgress === "function") {
      onProgress(allRecords.length);
    }
    if (records.length < FENGTUZ_CONFIG.cardsPageSize) {
      break;
    }
    from += records.length;
  }

  return allRecords;
}

// 主持端／玩家端共用的 WebSocket 包裝：處理連線、依訊息型別分派、並在斷線時自動重連
// （含 visibilitychange，涵蓋手機鎖屏再打開的情境）。伺服器的訊息不帶 payload，
// 只是「請重新拉取」的信號，所以每次連線成功都直接整包重新同步一次。
function connectSessionSocket(sessionCode, handlers = {}) {
  const { onState, onPlayers } = handlers;
  let socket = null;
  let closedByCaller = false;
  let reconnectDelay = 1000;
  let reconnectTimer = null;
  const MAX_RECONNECT_DELAY = 15000;

  function resyncAll() {
    if (typeof onState === "function") {
      onState();
    }
    if (typeof onPlayers === "function") {
      onPlayers();
    }
  }

  function dispatch(type) {
    if (type === "state" && typeof onState === "function") {
      onState();
    } else if (type === "players" && typeof onPlayers === "function") {
      onPlayers();
    }
  }

  function connect() {
    if (closedByCaller) {
      return;
    }
    socket = new WebSocket(
      `${FENGTUZ_CONFIG.wsBaseUrl}/ws?session=${encodeURIComponent(sessionCode)}`
    );

    socket.addEventListener("open", () => {
      reconnectDelay = 1000;
      resyncAll();
    });
    socket.addEventListener("message", (event) => {
      try {
        dispatch(JSON.parse(event.data).type);
      } catch {
        return;
      }
    });
    socket.addEventListener("close", () => {
      if (closedByCaller) {
        return;
      }
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    });
    socket.addEventListener("error", () => {
      socket.close();
    });
  }

  function handleVisibilityChange() {
    if (document.visibilityState !== "visible" || closedByCaller) {
      return;
    }
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      clearTimeout(reconnectTimer);
      reconnectDelay = 1000;
      connect();
    }
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  connect();

  return {
    close() {
      closedByCaller = true;
      clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (socket) {
        socket.close();
      }
    }
  };
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(date);
}

function roleName(roleId) {
  return FENGTUZ_CONFIG.roles.find((role) => role.id === roleId)?.name || roleId;
}

function releasedRecipients(entry) {
  return Array.isArray(entry?.recipients) ? entry.recipients : [];
}

function isClueVisibleToRole(entry, roleId) {
  const recipients = releasedRecipients(entry);
  return recipients.includes("all") || recipients.includes(roleId);
}

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) {
    element.className = options.className;
  }
  if (options.text !== undefined) {
    element.textContent = String(options.text);
  }
  if (options.type) {
    element.type = options.type;
  }
  return element;
}

function setNotice(element, message, kind = "") {
  element.textContent = message;
  element.className = "notice" + (kind ? " " + kind : "");
  element.classList.toggle("hidden", !message);
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) {
    return;
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

async function withBusy(button, task) {
  if (button?.disabled) {
    return;
  }
  if (button) {
    button.disabled = true;
  }
  try {
    await task();
  } catch (error) {
    console.error(error);
    showToast(error?.message || "操作失敗，請稍後再試。");
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

async function copyText(value, successMessage = "已複製") {
  await navigator.clipboard.writeText(String(value));
  showToast(successMessage);
}

window.FengTuz = Object.freeze({
  config: FENGTUZ_CONFIG,
  copyText,
  createElement,
  createTraditionalConverter,
  displayCardRecord,
  fetchAllRabbitCards,
  formatTime,
  generateRabbitSessionCode,
  isClueVisibleToRole,
  isRabbitSessionCode,
  normalizeGameState,
  normalizeSessionCode,
  releasedRecipients,
  roleName,
  setNotice,
  showToast,
  validateRabbitState,
  withBusy,
  connectSessionSocket,
  createSessionApi,
  fetchSessionApi,
  endSessionApi,
  setPhaseApi,
  releaseClueApi,
  revokeClueApi,
  sendBroadcastApi,
  fetchPlayersApi,
  joinPlayerApi,
  leavePlayerApi,
  fetchCardsPage
});
