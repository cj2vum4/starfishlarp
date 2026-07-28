"use strict";

const RabbitPlayer = {
  client: null,
  converter: null,
  sessionId: "",
  roleId: "",
  nickname: "",
  gameState: null,
  cards: [],
  gameChannel: null,
  heartbeatTimer: null,
  seenClueIds: new Set(),
  activeTab: "clues",

  elements: {},

  async init() {
    this.collectElements();
    this.bindEvents();
    this.converter = FengTuz.createTraditionalConverter();

    try {
      this.client = FengTuz.createSupabaseClient();
    } catch (error) {
      FengTuz.setNotice(this.elements.joinNotice, error.message, "error");
      this.elements.validateButton.disabled = true;
      return;
    }

    this.renderRoleChoices();
    this.renderPlayerView();

    const urlSession = new URLSearchParams(location.search).get("session");
    const saved = this.loadSavedLogin();
    this.elements.sessionCodeInput.value = FengTuz.normalizeSessionCode(
      urlSession || saved?.sessionId || ""
    );
    if (saved?.nickname) {
      this.elements.nicknameInput.value = saved.nickname;
    }

    if (saved?.sessionId && saved?.roleId && !urlSession) {
      await this.restoreLogin(saved);
    }
  },

  collectElements() {
    [
      "joinScreen",
      "playerScreen",
      "joinNotice",
      "playerNotice",
      "sessionCodeInput",
      "validateButton",
      "identityForm",
      "nicknameInput",
      "roleGrid",
      "joinButton",
      "currentSession",
      "currentIdentity",
      "currentPhase",
      "leaveButton",
      "cluesTabButton",
      "broadcastTabButton",
      "cluesPanel",
      "broadcastPanel",
      "playerClueList",
      "playerBroadcastHistory"
    ].forEach((id) => {
      this.elements[id] = document.getElementById(id);
    });
  },

  bindEvents() {
    this.elements.validateButton.addEventListener("click", (event) => {
      FengTuz.withBusy(event.currentTarget, () => this.validateSession());
    });
    this.elements.joinButton.addEventListener("click", (event) => {
      FengTuz.withBusy(event.currentTarget, () => this.joinAsPlayer());
    });
    this.elements.leaveButton.addEventListener("click", (event) => {
      FengTuz.withBusy(event.currentTarget, () => this.leaveSession());
    });
    this.elements.cluesTabButton.addEventListener("click", () => this.switchTab("clues"));
    this.elements.broadcastTabButton.addEventListener("click", () => {
      this.switchTab("broadcast");
    });
    window.addEventListener("pagehide", () => this.cleanupRealtime());
  },

  loadSavedLogin() {
    try {
      return JSON.parse(localStorage.getItem("fengtuz_player_login") || "null");
    } catch {
      return null;
    }
  },

  saveLogin() {
    localStorage.setItem(
      "fengtuz_player_login",
      JSON.stringify({
        sessionId: this.sessionId,
        roleId: this.roleId,
        nickname: this.nickname
      })
    );
  },

  async fetchGameState(sessionId) {
    const response = await this.client
      .from("game_state")
      .select("state")
      .eq("id", sessionId)
      .maybeSingle();
    if (response.error) {
      throw new Error("場次驗證失敗：" + response.error.message);
    }
    if (!response.data?.state) {
      throw new Error("找不到此場次，請向主持人確認程式碼。");
    }
    const state = FengTuz.validateRabbitState(response.data.state);
    if (state.status === "ended") {
      throw new Error("此場次已結束，請向主持人索取新的程式碼。");
    }
    return state;
  },

  async validateSession() {
    const proposed = FengTuz.normalizeSessionCode(
      this.elements.sessionCodeInput.value
    );
    if (!FengTuz.isRabbitSessionCode(proposed)) {
      FengTuz.setNotice(
        this.elements.joinNotice,
        "請輸入主持人提供的 RT- 場次程式碼。",
        "error"
      );
      return;
    }

    try {
      this.gameState = await this.fetchGameState(proposed);
      this.sessionId = proposed;
      await this.markOccupiedRoles();
      this.elements.identityForm.classList.remove("hidden");
      FengTuz.setNotice(
        this.elements.joinNotice,
        "場次驗證成功，請輸入暱稱並選擇角色。",
        "success"
      );
    } catch (error) {
      this.elements.identityForm.classList.add("hidden");
      FengTuz.setNotice(this.elements.joinNotice, error.message, "error");
    }
  },

  renderRoleChoices() {
    this.elements.roleGrid.replaceChildren();
    FengTuz.config.roles.forEach((role) => {
      const button = FengTuz.createElement("button", {
        className: "role-card",
        type: "button"
      });
      button.dataset.roleId = role.id;
      button.append(
        FengTuz.createElement("div", { className: "role-name", text: role.name }),
        FengTuz.createElement("div", {
          className: "role-player",
          text: "點選這個角色"
        })
      );
      button.addEventListener("click", () => {
        if (button.disabled) {
          return;
        }
        this.roleId = role.id;
        this.elements.roleGrid.querySelectorAll(".role-card").forEach((card) => {
          card.classList.toggle("selected", card === button);
        });
      });
      this.elements.roleGrid.appendChild(button);
    });
  },

  async markOccupiedRoles() {
    const response = await this.client
      .from("player_state")
      .select("char_id,player_name,updated_at")
      .eq("session_id", this.sessionId);
    if (response.error) {
      throw new Error("角色狀態讀取失敗：" + response.error.message);
    }
    const onlineThreshold = Date.now() - 100000;
    const onlineRoles = new Map(
      (response.data || [])
        .filter(
          (row) =>
            row.player_name &&
            new Date(row.updated_at).getTime() >= onlineThreshold
        )
        .map((row) => [row.char_id, row.player_name])
    );

    this.elements.roleGrid.querySelectorAll(".role-card").forEach((button) => {
      const playerName = onlineRoles.get(button.dataset.roleId);
      button.disabled = Boolean(playerName);
      const status = button.querySelector(".role-player");
      status.textContent = playerName ? `${playerName} 已選擇` : "可選擇";
    });
  },

  async joinAsPlayer() {
    const nickname = this.elements.nicknameInput.value.trim();
    if (!nickname) {
      FengTuz.setNotice(this.elements.joinNotice, "請輸入暱稱。", "error");
      return;
    }
    if (!this.roleId) {
      FengTuz.setNotice(this.elements.joinNotice, "請選擇一名角色。", "error");
      return;
    }

    this.nickname = nickname.slice(0, 40);
    this.gameState = await this.fetchGameState(this.sessionId);
    await this.savePlayerState();
    this.saveLogin();
    await this.enterPlayerView();
  },

  async restoreLogin(saved) {
    this.sessionId = FengTuz.normalizeSessionCode(saved.sessionId);
    this.roleId = saved.roleId;
    this.nickname = String(saved.nickname || "").slice(0, 40);
    if (
      !FengTuz.isRabbitSessionCode(this.sessionId) ||
      !FengTuz.config.roles.some((role) => role.id === this.roleId) ||
      !this.nickname
    ) {
      return;
    }

    try {
      this.gameState = await this.fetchGameState(this.sessionId);
      await this.savePlayerState();
      await this.enterPlayerView();
    } catch (error) {
      localStorage.removeItem("fengtuz_player_login");
      FengTuz.setNotice(this.elements.joinNotice, error.message, "error");
    }
  },

  playerKey() {
    return `${this.sessionId}_${this.roleId}`;
  },

  visibleClueIds(state = this.gameState) {
    return Object.entries(state?.releasedClues || {})
      .filter(([, entry]) => FengTuz.isClueVisibleToRole(entry, this.roleId))
      .map(([id]) => String(id));
  },

  async savePlayerState() {
    const row = {
      id: this.playerKey(),
      session_id: this.sessionId,
      char_id: this.roleId,
      player_name: this.nickname,
      unlocked_codes: this.visibleClueIds(),
      updated_at: new Date().toISOString()
    };
    const response = await this.client.from("player_state").upsert(row);
    if (response.error) {
      throw new Error("玩家狀態同步失敗：" + response.error.message);
    }
  },

  async enterPlayerView() {
    await this.cleanupRealtime();
    this.elements.joinScreen.classList.add("hidden");
    this.elements.playerScreen.classList.remove("hidden");
    this.elements.currentSession.textContent = this.sessionId;
    this.elements.currentIdentity.textContent =
      `${this.nickname} · ${FengTuz.roleName(this.roleId)}`;

    try {
      this.cards = await FengTuz.fetchAllRabbitCards(
        this.client,
        this.converter,
        (count) => {
          FengTuz.setNotice(
            this.elements.playerNotice,
            `正在分頁載入線索，已完成 ${count} 筆…`
          );
        }
      );
      FengTuz.setNotice(this.elements.playerNotice, "");
    } catch (error) {
      FengTuz.setNotice(this.elements.playerNotice, error.message, "error");
    }

    this.seenClueIds = new Set(this.visibleClueIds());
    this.renderPlayerView();
    this.subscribeToGameState();
    this.startHeartbeat();
  },

  renderPlayerView(newIds = []) {
    const phaseIndex = this.gameState?.currentPhase || 0;
    this.elements.currentPhase.textContent =
      FengTuz.config.phases[phaseIndex] || "等待主持人";
    this.renderVisibleClues(new Set(newIds));
    this.renderBroadcasts();
  },

  renderVisibleClues(newIds = new Set()) {
    this.elements.playerClueList.replaceChildren();
    const byId = new Map(this.cards.map((card) => [String(card.id), card]));
    const visibleIds = this.visibleClueIds();

    if (!visibleIds.length) {
      this.elements.playerClueList.appendChild(
        FengTuz.createElement("div", {
          className: "empty-state",
          text: "主持人尚未發放線索。"
        })
      );
      return;
    }

    visibleIds.forEach((id) => {
      const card = byId.get(id);
      if (!card) {
        return;
      }
      const entry = this.gameState.releasedClues[id];
      const privateForRole = !FengTuz.releasedRecipients(entry).includes("all");
      const article = FengTuz.createElement("article", {
        className: "clue-card" + (newIds.has(id) ? " new-clue" : "")
      });
      const header = FengTuz.createElement("div", { className: "clue-header" });
      header.append(
        FengTuz.createElement("h3", { className: "clue-title", text: card.filename }),
        FengTuz.createElement("span", {
          className: "badge",
          text: privateForRole ? `僅限 ${FengTuz.roleName(this.roleId)}` : "全體線索"
        })
      );
      article.append(
        header,
        FengTuz.createElement("div", {
          className: "muted",
          text: `${card.folder || "未分類"}${card.pageNum ? ` · 第 ${card.pageNum} 頁` : ""}`
        }),
        FengTuz.createElement("pre", {
          className: "clue-text",
          text: card.text || "（此筆線索沒有 OCR 文字）"
        })
      );
      this.elements.playerClueList.appendChild(article);
    });
  },

  renderBroadcasts() {
    this.elements.playerBroadcastHistory.replaceChildren();
    const broadcasts = this.gameState?.broadcasts || [];
    if (!broadcasts.length) {
      this.elements.playerBroadcastHistory.appendChild(
        FengTuz.createElement("div", {
          className: "empty-state",
          text: "主持人尚未發送廣播。"
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
      this.elements.playerBroadcastHistory.appendChild(item);
    });
  },

  subscribeToGameState() {
    if (!this.sessionId || this.gameChannel) {
      return;
    }
    const safeCode = this.sessionId.replace(/[^A-Z0-9]/g, "");
    this.gameChannel = this.client
      .channel("fengtuz_player_game_" + safeCode + "_" + this.roleId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_state",
          filter: `id=eq.${this.sessionId}`
        },
        (payload) => this.applyRealtimeState(payload.new?.state)
      )
      .subscribe();
  },

  async applyRealtimeState(rawState) {
    if (!rawState) {
      return;
    }
    try {
      const nextState = FengTuz.validateRabbitState(rawState);
      if (nextState.status === "ended") {
        this.gameState = nextState;
        FengTuz.setNotice(
          this.elements.playerNotice,
          "主持人已結束場次。你可以安全離開。",
          "error"
        );
        await this.cleanupRealtime();
        return;
      }

      const nextIds = new Set(this.visibleClueIds(nextState));
      const newIds = [...nextIds].filter((id) => !this.seenClueIds.has(id));
      const newBroadcast =
        (nextState.broadcasts?.[0]?.id || "") !==
        (this.gameState?.broadcasts?.[0]?.id || "");
      this.gameState = nextState;
      this.seenClueIds = nextIds;
      this.renderPlayerView(newIds);
      await this.savePlayerState();

      if (newIds.length) {
        FengTuz.showToast(`收到 ${newIds.length} 筆新線索`);
      } else if (newBroadcast) {
        FengTuz.showToast("收到主持人新廣播");
      }
    } catch (error) {
      FengTuz.setNotice(this.elements.playerNotice, error.message, "error");
    }
  },

  startHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.savePlayerState().catch((error) => {
        console.warn("玩家心跳同步失敗", error);
      });
    }, 45000);
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    const cluesActive = tabName === "clues";
    this.elements.cluesPanel.classList.toggle("hidden", !cluesActive);
    this.elements.broadcastPanel.classList.toggle("hidden", cluesActive);
    this.elements.cluesTabButton.classList.toggle("active", cluesActive);
    this.elements.broadcastTabButton.classList.toggle("active", !cluesActive);
  },

  async leaveSession() {
    if (!window.confirm("確定要離開場次嗎？")) {
      return;
    }
    await this.cleanupRealtime();
    if (this.sessionId && this.roleId) {
      const response = await this.client
        .from("player_state")
        .delete()
        .eq("id", this.playerKey());
      if (response.error) {
        console.warn("離開時無法刪除玩家狀態", response.error);
      }
    }
    localStorage.removeItem("fengtuz_player_login");
    this.sessionId = "";
    this.roleId = "";
    this.nickname = "";
    this.gameState = null;
    this.cards = [];
    this.seenClueIds.clear();
    this.elements.identityForm.classList.add("hidden");
    this.elements.playerScreen.classList.add("hidden");
    this.elements.joinScreen.classList.remove("hidden");
    this.elements.sessionCodeInput.value = "";
    this.elements.nicknameInput.value = "";
    this.renderRoleChoices();
    FengTuz.setNotice(this.elements.joinNotice, "已離開場次。", "success");
  },

  async cleanupRealtime() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    const channel = this.gameChannel;
    this.gameChannel = null;
    if (channel && this.client) {
      await this.client.removeChannel(channel);
    }
  }
};

window.addEventListener("DOMContentLoaded", () => RabbitPlayer.init());
