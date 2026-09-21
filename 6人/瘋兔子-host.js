"use strict";

const RabbitHost = {
  converter: null,
  sessionId: "",
  gameState: null,
  cards: [],
  playerRows: [],
  socketHandle: null,

  elements: {},

  async init() {
    this.collectElements();
    this.bindEvents();
    this.converter = FengTuz.createTraditionalConverter();

    this.renderPhases();
    this.renderPlayers();
    this.renderSession();
    this.loadCards();

    const savedSession = FengTuz.normalizeSessionCode(
      localStorage.getItem("fengtuz_host_session")
    );
    if (savedSession) {
      this.elements.sessionInput.value = savedSession;
      await this.joinSession(savedSession, { silent: true });
    }
  },

  collectElements() {
    const ids = [
      "globalNotice",
      "sessionInput",
      "sessionStatus",
      "sessionCode",
      "sessionControls",
      "createSessionButton",
      "joinSessionButton",
      "copySessionButton",
      "endSessionButton",
      "playerLink",
      "copyPlayerLinkButton",
      "phaseList",
      "playerGrid",
      "playerCount",
      "clueStatus",
      "clueSearch",
      "folderFilter",
      "clueList",
      "broadcastInput",
      "broadcastButton",
      "broadcastTemplates",
      "broadcastHistory"
    ];
    ids.forEach((id) => {
      this.elements[id] = document.getElementById(id);
    });
  },

  bindEvents() {
    this.elements.createSessionButton.addEventListener("click", (event) => {
      FengTuz.withBusy(event.currentTarget, () => this.createSession());
    });
    this.elements.joinSessionButton.addEventListener("click", (event) => {
      FengTuz.withBusy(event.currentTarget, () => this.joinSession());
    });
    this.elements.copySessionButton.addEventListener("click", () => {
      FengTuz.copyText(this.sessionId, "場次程式碼已複製");
    });
    this.elements.copyPlayerLinkButton.addEventListener("click", () => {
      FengTuz.copyText(this.elements.playerLink.href, "玩家端連結已複製");
    });
    this.elements.endSessionButton.addEventListener("click", (event) => {
      FengTuz.withBusy(event.currentTarget, () => this.endSession());
    });
    this.elements.clueSearch.addEventListener("input", () => this.renderClues());
    this.elements.folderFilter.addEventListener("change", () => this.renderClues());
    this.elements.broadcastButton.addEventListener("click", (event) => {
      FengTuz.withBusy(event.currentTarget, () => this.sendBroadcast());
    });
    this.elements.broadcastTemplates.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-message]");
      if (button) {
        this.elements.broadcastInput.value = button.dataset.message;
        this.elements.broadcastInput.focus();
      }
    });
    window.addEventListener("pagehide", () => this.cleanupSocket());
  },

  async createSession() {
    const proposed =
      FengTuz.normalizeSessionCode(this.elements.sessionInput.value) ||
      FengTuz.generateRabbitSessionCode();

    if (!FengTuz.isRabbitSessionCode(proposed)) {
      FengTuz.setNotice(
        this.elements.globalNotice,
        "場次程式碼須使用 RT- 前綴，後接 4 至 10 個英文字母或數字。",
        "error"
      );
      return;
    }

    let session;
    try {
      session = await FengTuz.createSessionApi(proposed);
    } catch (error) {
      if (error.code === "SESSION_EXISTS") {
        FengTuz.setNotice(this.elements.globalNotice, error.message, "error");
        return;
      }
      throw error;
    }

    await this.activateSession(proposed, session);
    FengTuz.setNotice(
      this.elements.globalNotice,
      "場次已建立。請把程式碼或玩家端連結提供給玩家。",
      "success"
    );
  },

  async joinSession(code = null, options = {}) {
    const proposed = FengTuz.normalizeSessionCode(
      code || this.elements.sessionInput.value
    );
    if (!FengTuz.isRabbitSessionCode(proposed)) {
      if (!options.silent) {
        FengTuz.setNotice(
          this.elements.globalNotice,
          "請輸入有效的 RT- 場次程式碼。",
          "error"
        );
      }
      return;
    }

    const session = await FengTuz.fetchSessionApi(proposed);
    if (!session) {
      if (!options.silent) {
        FengTuz.setNotice(
          this.elements.globalNotice,
          "找不到此場次，請確認程式碼或重新建立。",
          "error"
        );
      }
      return;
    }
    if (session.status === "ended") {
      FengTuz.setNotice(
        this.elements.globalNotice,
        "此場次已由主持人結束，請建立新場次。",
        "error"
      );
      return;
    }

    await this.activateSession(proposed, session);
    if (!options.silent) {
      FengTuz.setNotice(this.elements.globalNotice, "已加入主持場次。", "success");
    }
  },

  async activateSession(sessionId, state) {
    this.cleanupSocket();
    this.sessionId = sessionId;
    this.gameState = FengTuz.validateRabbitState(state);
    localStorage.setItem("fengtuz_host_session", sessionId);
    this.elements.sessionInput.value = sessionId;
    this.renderAll();
    await this.loadPlayers();
    this.subscribeToSession();
  },

  renderAll() {
    this.renderSession();
    this.renderPhases();
    this.renderPlayers();
    this.renderClues();
    this.renderBroadcastHistory();
  },

  renderSession() {
    const active = Boolean(this.sessionId && this.gameState);
    this.elements.sessionControls.classList.toggle("hidden", !active);
    this.elements.sessionCode.textContent = active ? this.sessionId : "尚未建立";
    this.elements.sessionStatus.textContent = active
      ? "連線中 · 《瘋兔子》"
      : "建立或加入場次後即可開始控場";

    if (active) {
      const url = new URL("瘋兔子-player.html", window.location.href);
      url.searchParams.set("session", this.sessionId);
      this.elements.playerLink.href = url.toString();
      this.elements.playerLink.textContent = url.toString();
    } else {
      this.elements.playerLink.removeAttribute("href");
      this.elements.playerLink.textContent = "尚未建立玩家端連結";
    }
  },

  async endSession() {
    if (!this.sessionId || !this.gameState) {
      return;
    }
    if (!window.confirm("確定要結束這個場次嗎？玩家端會立即顯示場次已結束。")) {
      return;
    }

    await FengTuz.endSessionApi(this.sessionId);
    this.cleanupSocket();
    localStorage.removeItem("fengtuz_host_session");
    this.sessionId = "";
    this.gameState = null;
    this.playerRows = [];
    this.renderAll();
    FengTuz.setNotice(this.elements.globalNotice, "場次已結束。", "success");
  },

  cleanupSocket() {
    if (this.socketHandle) {
      this.socketHandle.close();
      this.socketHandle = null;
    }
  },

  subscribeToSession() {
    if (!this.sessionId || this.socketHandle) {
      return;
    }
    this.socketHandle = FengTuz.connectSessionSocket(this.sessionId, {
      onState: () => this.refreshGameState(),
      onPlayers: () => this.loadPlayers()
    });
  },

  async refreshGameState() {
    try {
      const session = await FengTuz.fetchSessionApi(this.sessionId);
      if (!session) {
        return;
      }
      this.gameState = FengTuz.validateRabbitState(session);
      this.renderAll();
    } catch (error) {
      FengTuz.setNotice(this.elements.globalNotice, error.message, "error");
    }
  },

  async loadPlayers() {
    if (!this.sessionId) {
      return;
    }
    try {
      this.playerRows = await FengTuz.fetchPlayersApi(this.sessionId);
      this.renderPlayers();
    } catch (error) {
      FengTuz.setNotice(
        this.elements.globalNotice,
        "玩家狀態讀取失敗：" + error.message,
        "error"
      );
    }
  },

  renderPlayers() {
    this.elements.playerGrid.replaceChildren();
    const onlineThreshold = Date.now() - 100000;
    let onlineCount = 0;

    FengTuz.config.roles.forEach((role) => {
      const row = this.playerRows.find((player) => player.roleId === role.id);
      const updatedAt = row ? new Date(row.updatedAt).getTime() : 0;
      const online = Boolean(row?.nickname && updatedAt >= onlineThreshold);
      onlineCount += online ? 1 : 0;

      const card = FengTuz.createElement("article", {
        className: "role-card" + (online ? " online" : "")
      });
      const status = FengTuz.createElement("div");
      const dot = FengTuz.createElement("span", {
        className: "status-dot" + (online ? " online" : "")
      });
      status.append(
        dot,
        document.createTextNode(online ? "已連線" : row ? "暫時離線" : "等待加入")
      );
      status.className = "role-player";
      card.append(
        FengTuz.createElement("div", { className: "role-name", text: role.name }),
        status,
        FengTuz.createElement("div", {
          className: "role-player",
          text: row?.nickname || "尚無玩家"
        })
      );
      this.elements.playerGrid.appendChild(card);
    });
    this.elements.playerCount.textContent = `${onlineCount} / 6 名玩家在線`;
  },

  renderPhases() {
    this.elements.phaseList.replaceChildren();
    FengTuz.config.phases.forEach((phase, index) => {
      const button = FengTuz.createElement("button", {
        className:
          "phase-button" +
          (this.gameState?.currentPhase === index ? " active" : ""),
        type: "button"
      });
      button.disabled = !this.sessionId;
      button.append(
        FengTuz.createElement("div", {
          className: "phase-number",
          text: `第 ${index + 1} 階段`
        }),
        FengTuz.createElement("div", { className: "phase-name", text: phase })
      );
      button.addEventListener("click", () => {
        FengTuz.withBusy(button, async () => {
          const session = await FengTuz.setPhaseApi(this.sessionId, index);
          this.gameState = FengTuz.validateRabbitState(session);
          this.renderAll();
          FengTuz.showToast("遊戲階段已更新");
        });
      });
      this.elements.phaseList.appendChild(button);
    });
  },

  async loadCards() {
    this.elements.clueStatus.textContent = "正在分頁載入線索…";
    try {
      this.cards = await FengTuz.fetchAllRabbitCards(
        this.converter,
        (count) => {
          this.elements.clueStatus.textContent = `已載入 ${count} 筆線索…`;
        }
      );
      this.buildFolderFilter();
      this.renderClues();
    } catch (error) {
      this.elements.clueStatus.textContent = error.message;
      this.elements.clueStatus.classList.add("notice", "error");
    }
  },

  buildFolderFilter() {
    const previous = this.elements.folderFilter.value;
    this.elements.folderFilter.replaceChildren(
      new Option("所有線索類別", "")
    );
    const folders = [...new Set(this.cards.map((card) => card.folder).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, "zh-TW"));
    folders.forEach((folder) => {
      this.elements.folderFilter.appendChild(new Option(folder, folder));
    });
    this.elements.folderFilter.value = previous;
  },

  filteredCards() {
    const query = this.elements.clueSearch.value.trim().toLocaleLowerCase("zh-TW");
    const folder = this.elements.folderFilter.value;
    return this.cards.filter((card) => {
      if (folder && card.folder !== folder) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        card.filename.toLocaleLowerCase("zh-TW").includes(query) ||
        card.text.toLocaleLowerCase("zh-TW").includes(query)
      );
    });
  },

  renderClues() {
    this.elements.clueList.replaceChildren();
    const filtered = this.filteredCards();
    this.elements.clueStatus.textContent = this.cards.length
      ? `顯示 ${filtered.length} / ${this.cards.length} 筆線索`
      : "尚未載入線索";
    this.elements.clueStatus.className = "muted";

    if (!filtered.length) {
      this.elements.clueList.appendChild(
        FengTuz.createElement("div", {
          className: "empty-state",
          text: "沒有符合條件的線索。"
        })
      );
      return;
    }

    filtered.forEach((card) => {
      this.elements.clueList.appendChild(this.createClueCard(card));
    });
  },

  createClueCard(card) {
    const article = FengTuz.createElement("article", { className: "clue-card" });
    const header = FengTuz.createElement("div", { className: "clue-header" });
    const titleWrap = document.createElement("div");
    titleWrap.append(
      FengTuz.createElement("h3", { className: "clue-title", text: card.filename }),
      FengTuz.createElement("div", {
        className: "muted",
        text: `#${card.id}${card.pageNum ? ` · 第 ${card.pageNum} 頁` : ""}`
      })
    );
    header.append(
      titleWrap,
      FengTuz.createElement("span", {
        className: "badge",
        text: card.folder || "未分類"
      })
    );

    const text = FengTuz.createElement("pre", {
      className: "clue-text",
      text: card.text || "（此筆線索沒有 OCR 文字）"
    });
    const actions = FengTuz.createElement("div", { className: "clue-actions" });
    const allButton = FengTuz.createElement("button", {
      className: "button small primary",
      text: "發給所有玩家",
      type: "button"
    });
    const roleSelect = FengTuz.createElement("select", { className: "select" });
    FengTuz.config.roles.forEach((role) => {
      roleSelect.appendChild(new Option(role.name, role.id));
    });
    const roleButton = FengTuz.createElement("button", {
      className: "button small",
      text: "發給指定角色",
      type: "button"
    });
    allButton.disabled = !this.sessionId;
    roleButton.disabled = !this.sessionId;
    allButton.addEventListener("click", () => {
      FengTuz.withBusy(allButton, () => this.releaseClue(card.id, "all"));
    });
    roleButton.addEventListener("click", () => {
      FengTuz.withBusy(roleButton, () => this.releaseClue(card.id, roleSelect.value));
    });
    actions.append(allButton, roleSelect, roleButton);

    const releaseSummary = FengTuz.createElement("div", {
      className: "release-summary",
      text: this.releaseSummary(card.id)
    });
    const entry = this.gameState?.releasedClues?.[String(card.id)];
    if (entry) {
      const revokeButton = FengTuz.createElement("button", {
        className: "button small danger",
        text: "收回線索",
        type: "button"
      });
      revokeButton.addEventListener("click", () => {
        FengTuz.withBusy(revokeButton, () => this.revokeClue(card.id));
      });
      actions.appendChild(revokeButton);
    }

    article.append(header, text, actions, releaseSummary);
    return article;
  },

  releaseSummary(cardId) {
    const entry = this.gameState?.releasedClues?.[String(cardId)];
    const recipients = FengTuz.releasedRecipients(entry);
    if (!recipients.length) {
      return "尚未發放";
    }
    if (recipients.includes("all")) {
      return "已發給所有玩家";
    }
    return "已發給：" + recipients.map(FengTuz.roleName).join("、");
  },

  async releaseClue(cardId, recipient) {
    const session = await FengTuz.releaseClueApi(this.sessionId, cardId, recipient);
    this.gameState = FengTuz.validateRabbitState(session);
    this.renderAll();
    FengTuz.showToast("線索已發放");
  },

  async revokeClue(cardId) {
    const session = await FengTuz.revokeClueApi(this.sessionId, cardId);
    this.gameState = FengTuz.validateRabbitState(session);
    this.renderAll();
    FengTuz.showToast("線索已收回");
  },

  async sendBroadcast() {
    const message = this.elements.broadcastInput.value.trim();
    if (!message) {
      FengTuz.showToast("請先輸入廣播內容");
      return;
    }
    if (!this.sessionId) {
      FengTuz.showToast("請先建立或加入場次");
      return;
    }

    const session = await FengTuz.sendBroadcastApi(this.sessionId, message);
    this.gameState = FengTuz.validateRabbitState(session);
    this.renderAll();
    this.elements.broadcastInput.value = "";
    FengTuz.showToast("廣播已送出");
  },

  renderBroadcastHistory() {
    this.elements.broadcastHistory.replaceChildren();
    const broadcasts = this.gameState?.broadcasts || [];
    if (!broadcasts.length) {
      this.elements.broadcastHistory.appendChild(
        FengTuz.createElement("div", {
          className: "empty-state",
          text: "尚無廣播紀錄。"
        })
      );
      return;
    }
    broadcasts.forEach((broadcast) => {
      const item = FengTuz.createElement("article", { className: "history-item" });
      item.append(
        FengTuz.createElement("time", {
          text: FengTuz.formatTime(broadcast.createdAt)
        }),
        FengTuz.createElement("p", { text: broadcast.message })
      );
      this.elements.broadcastHistory.appendChild(item);
    });
  }
};

window.addEventListener("DOMContentLoaded", () => RabbitHost.init());
