#!/usr/bin/env bash
# 集點系統測試：node tests/run.sh
set -u

cd "$(dirname "$0")/.."

echo "▶ 語法檢查"
syntax_failed=0
tmp_gas="$(mktemp -t gas-XXXXXX.js)"
cp "GoogleAppsScript_玩本記錄.gs" "$tmp_gas"
for file in points.js reviews.js play-record.js "$tmp_gas"; do
    name="$(basename "$file")"
    [ "$file" = "$tmp_gas" ] && name="GoogleAppsScript_玩本記錄.gs"
    if node --check "$file" >/dev/null 2>&1; then
        echo "  ✅ $name"
    else
        echo "  ❌ $name"
        syntax_failed=1
    fi
done
rm -f "$tmp_gas"
[ "$syntax_failed" -eq 0 ] || exit 1

echo
echo "▶ Apps Script 計分邏輯"
node tests/gas.test.js || exit 1

echo
echo "▶ 前端（需要 playwright，沒裝會自動跳過）"
node tests/browser.test.js || exit 1

echo
echo "全部通過。"
