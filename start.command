#!/bin/bash
# 顔ぼかしツール ワンクリック起動スクリプト
# Finderでダブルクリックで起動できます

set -e
cd "$(dirname "$0")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  顔ぼかしツールを起動します"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Node.jsが入っているか確認
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "⚠️  Node.js がインストールされていません。"
  echo "   https://nodejs.org/ja からインストールしてください。"
  echo ""
  read -p "Enterキーで閉じる..."
  exit 1
fi

# ポート3000を確実に開ける（既存プロセスをkill）
if lsof -ti:3000 >/dev/null 2>&1; then
  echo "▸ ポート3000を使用中のプロセスを停止しています..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# 初回のみ依存パッケージをインストール
if [ ! -d "node_modules" ]; then
  echo "▸ 初回セットアップ（依存パッケージのインストール、数分かかります）..."
  npm install
  echo ""
fi

# 3秒後にブラウザを自動で開く（バックグラウンド）
(
  sleep 3
  open "http://localhost:3000"
) &
OPEN_PID=$!

# 終了時にバックグラウンドのopen待機も掃除する
cleanup() {
  kill "$OPEN_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "✓ サーバー起動中... ブラウザが自動で開きます"
echo "  停止するには この画面で Control + C を押すか、ウィンドウを閉じてください"
echo ""

# 開発サーバー起動
npm run dev
