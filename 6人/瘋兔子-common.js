"use strict";

const FENGTUZ_CONFIG = Object.freeze({
  script: "fengtuz",
  sessionPrefix: "RT-",
  supabaseUrl: "https://mcphigetltedeadvuvqf.supabase.co",
  supabaseKey: "sb_publishable_Qdg36jjN7W1DUkBGtrzTtQ_bphP6Zg2",
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

function createSupabaseClient() {
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    throw new Error("Supabase 程式庫載入失敗，請檢查網路後重新整理。");
  }

  return window.supabase.createClient(
    FENGTUZ_CONFIG.supabaseUrl,
    FENGTUZ_CONFIG.supabaseKey
  );
}

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
    pageNum: Number(record.page_num) || 0,
    text: converter(String(record.text ?? ""))
  };
}

async function fetchAllRabbitCards(client, converter, onProgress) {
  const allRecords = [];
  let from = 0;

  while (true) {
    const to = from + FENGTUZ_CONFIG.cardsPageSize - 1;
    const response = await client
      .from("cards")
      .select("id,filename,folder,page_num,text")
      .eq("script", FENGTUZ_CONFIG.script)
      .order("folder", { ascending: true })
      .order("filename", { ascending: true })
      .order("page_num", { ascending: true })
      .range(from, to);

    if (response.error) {
      throw new Error("線索載入失敗：" + response.error.message);
    }

    const page = response.data || [];
    allRecords.push(...page.map((record) => displayCardRecord(record, converter)));

    if (typeof onProgress === "function") {
      onProgress(allRecords.length);
    }
    if (page.length < FENGTUZ_CONFIG.cardsPageSize) {
      break;
    }
    from += page.length;
  }

  return allRecords;
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
  createSupabaseClient,
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
  withBusy
});
