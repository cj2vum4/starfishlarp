"use strict";

(function enableLocalTestBackend() {
  const localHost = ["127.0.0.1", "localhost"].includes(location.hostname);
  const enabled = new URLSearchParams(location.search).get("mock") === "1";
  if (!localHost || !enabled) {
    return;
  }

  const storageKey = "fengtuz_mock_database";
  const channels = new Set();
  const seedCards = [
    {
      id: 900001,
      script: "fengtuz",
      filename: "游戏规则",
      folder: "故事背景",
      page_num: 1,
      text: "调查现场并阅读规则。所有玩家都能看到这一条线索。"
    },
    {
      id: 900002,
      script: "fengtuz",
      filename: "病历记录",
      folder: "触发线索",
      page_num: 2,
      text: "林云书曾在医院留下记录。这段文字用于测试台湾繁体转换。"
    },
    {
      id: 900003,
      script: "fengtuz",
      filename: "飞升仪式",
      folder: "结局",
      page_num: 1,
      text: "仪式开始后，请简菲菲说出最后的选择。"
    }
  ];

  function emptyDatabase() {
    return {
      cards: seedCards,
      game_state: [],
      player_state: []
    };
  }

  function readDatabase() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      return stored?.database || stored || emptyDatabase();
    } catch {
      return emptyDatabase();
    }
  }

  function writeDatabase(database, change) {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        database,
        change,
        nonce: crypto.randomUUID()
      })
    );
    window.dispatchEvent(
      new CustomEvent("fengtuz-mock-change", { detail: change })
    );
  }

  function matchesFilter(row, filter) {
    if (!filter) {
      return true;
    }
    const [field, expression] = filter.split("=eq.");
    return String(row?.[field]) === String(expression);
  }

  function notifyChannels(change) {
    channels.forEach((channel) => {
      channel.handlers.forEach((handler) => {
        const config = handler.config;
        if (
          config.table === change.table &&
          (
            matchesFilter(change.new, config.filter) ||
            matchesFilter(change.old, config.filter)
          )
        ) {
          handler.callback(change);
        }
      });
    });
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== storageKey || !event.newValue) {
      return;
    }
    const stored = JSON.parse(event.newValue);
    if (stored.change) {
      notifyChannels(stored.change);
    }
  });
  window.addEventListener("fengtuz-mock-change", (event) => {
    notifyChannels(event.detail);
  });

  class MockQuery {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.filters = [];
      this.rangeBounds = null;
      this.payload = null;
    }

    select() {
      return this;
    }

    eq(field, value) {
      this.filters.push({ field, value });
      return this;
    }

    order() {
      return this;
    }

    range(from, to) {
      this.rangeBounds = { from, to };
      return this;
    }

    maybeSingle() {
      return this.execute(true);
    }

    single() {
      return this.execute(true);
    }

    upsert(payload) {
      this.operation = "upsert";
      this.payload = payload;
      return this.execute(false);
    }

    delete() {
      this.operation = "delete";
      return this;
    }

    then(resolve, reject) {
      return this.execute(false).then(resolve, reject);
    }

    async execute(single) {
      const database = readDatabase();
      const rows = database[this.table] || [];

      if (this.operation === "upsert") {
        const payloads = Array.isArray(this.payload) ? this.payload : [this.payload];
        payloads.forEach((payload) => {
          const index = rows.findIndex((row) => row.id === payload.id);
          if (index >= 0) {
            rows[index] = { ...rows[index], ...payload };
          } else {
            rows.push({ ...payload });
          }
          writeDatabase(database, {
            eventType: index >= 0 ? "UPDATE" : "INSERT",
            table: this.table,
            new: { ...payload },
            old: index >= 0 ? rows[index] : {}
          });
        });
        return { data: null, error: null };
      }

      if (this.operation === "delete") {
        const deleted = rows.find((row) =>
          this.filters.every(
            (filter) => String(row[filter.field]) === String(filter.value)
          )
        );
        const kept = rows.filter(
          (row) =>
            !this.filters.every(
              (filter) => String(row[filter.field]) === String(filter.value)
            )
        );
        database[this.table] = kept;
        writeDatabase(database, {
          eventType: "DELETE",
          table: this.table,
          new: {},
          old: deleted || {}
        });
        return { data: null, error: null };
      }

      let selected = rows.filter((row) =>
        this.filters.every(
          (filter) => String(row[filter.field]) === String(filter.value)
        )
      );
      if (this.rangeBounds) {
        selected = selected.slice(
          this.rangeBounds.from,
          this.rangeBounds.to + 1
        );
      }
      return {
        data: single ? selected[0] || null : selected.map((row) => ({ ...row })),
        error: null
      };
    }
  }

  class MockChannel {
    constructor(name) {
      this.name = name;
      this.handlers = [];
    }

    on(_eventName, config, callback) {
      this.handlers.push({ config, callback });
      return this;
    }

    subscribe() {
      channels.add(this);
      return this;
    }

    unsubscribe() {
      channels.delete(this);
      return Promise.resolve("ok");
    }
  }

  const mockClient = {
    from(table) {
      return new MockQuery(table);
    },
    channel(name) {
      return new MockChannel(name);
    },
    removeChannel(channel) {
      return channel.unsubscribe();
    }
  };

  window.supabase = {
    createClient() {
      return mockClient;
    }
  };
  console.info("《瘋兔子》本機測試後端已啟用。");
})();
