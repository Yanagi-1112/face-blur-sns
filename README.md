# face-blur-sns

**画像をドラッグ&ドロップするだけで、写っている人の顔を自動でぼかすローカルWebアプリ。**

イベントや展示会の集合写真をSNSに投稿したいけれど、一人ひとり手動でぼかすのが面倒 — そんな用途のためのツールです。画像は**一切サーバーに送信されず**、ブラウザ内だけで処理されます。

## 特徴

- **ドラッグ&ドロップで完結** — 複数枚まとめて処理可能（JPEG / PNG / WebP）
- **MediaPipe Tasks Vision による顔検出** — WebAssembly + GPUデリゲートでブラウザ内実行
- **多スケール検出 + NMS** — 1x / 1.8x / 2.5x の3スケールで走らせ、群衆写真の遠方の小さい顔まで拾う
- **楕円クリップの強めガウシアンぼかし** — BBoxを1.4倍に拡張してから半径を画像サイズに応じて自動調整
- **完全ローカル処理** — 画像は外部に送信されません（通信はMediaPipeのモデル/WASMのCDN取得のみ）
- **ZIP一括ダウンロード** — 複数枚処理時は個別DLも一括DLもOK
- **ダークモード対応**

## セットアップ

```bash
git clone https://github.com/Yanagi-1112/face-blur-sns.git
cd face-blur-sns
npm install
npm run dev
# → http://localhost:3000
```

### 必要環境

- Node.js 20+
- モダンブラウザ（WebAssembly + WebGL対応）

### macOS: ワンクリック起動

Finderで **`start.command`** をダブルクリックするだけで、依存のインストール（初回のみ）→ サーバー起動 → ブラウザ自動オープン まで自動で走ります。

## 使い方

1. `npm run dev` で起動し `http://localhost:3000` を開く
2. 画像ファイルをドロップゾーンにドラッグ&ドロップ（またはクリック → ファイル選択）
3. 自動検出 → ぼかし処理が走り、Before / After で比較プレビュー
4. **「ダウンロード」** ボタンで1枚ずつ、または複数枚処理時は **「全てZIPでダウンロード」** で一括保存

## アーキテクチャ

完全にクライアントサイドで完結する構成です。

```
┌─ DropZone (drag & drop) ──────────────────────┐
│                                                │
│     ↓ File[]                                   │
│                                                │
│  detectFaces(img) ──▶ @mediapipe/tasks-vision  │
│   ├─ 1x scale                                  │
│   ├─ 1.8x scale                                │
│   └─ 2.5x scale (small images only)            │
│          │                                     │
│          ▼ BBox[] + NMS(IoU 0.4)               │
│                                                │
│  applyBlurToFaces(img, boxes)                  │
│   ├─ 1.4x expand BBox                          │
│   ├─ ellipse clip                              │
│   └─ ctx.filter = blur(r)                      │
│          │                                     │
│          ▼ HTMLCanvasElement                   │
│                                                │
│  canvas.toBlob → ImagePreview / download       │
└────────────────────────────────────────────────┘
```

### 主要ファイル

| パス | 役割 |
|---|---|
| [`app/page.tsx`](app/page.tsx) | メインUI・処理フロー・ZIP DL |
| [`lib/face-detector.ts`](lib/face-detector.ts) | MediaPipe初期化・多スケール検出・NMS |
| [`lib/blur-canvas.ts`](lib/blur-canvas.ts) | Canvasベースのぼかし適用 |
| [`components/DropZone.tsx`](components/DropZone.tsx) | ドラッグ&ドロップUI |
| [`components/ImagePreview.tsx`](components/ImagePreview.tsx) | サムネイル + DL / 共有ボタン |

### 技術スタック

- [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- [React 19](https://react.dev/)
- [TypeScript 5](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [@mediapipe/tasks-vision](https://www.npmjs.com/package/@mediapipe/tasks-vision) — ブラウザ内推論
- [jszip](https://stuk.github.io/jszip/) — ZIP生成
- [file-saver](https://github.com/eligrey/FileSaver.js) — 保存ダイアログ

## 制限と注意

- 顔検出は `BlazeFace short-range` モデルを使用しており、遠方・小さすぎる顔や横向きは取りこぼすことがあります。多スケール実行で緩和していますが、**最終的にはBefore/Afterで必ず目視確認してください**
- ガウシアンぼかしは完全に不可逆ではありません。**強めの半径**を適用していますが、極端に小さいBBoxでは情報量が残り得るため、確実にプライバシーを守りたい用途ではプレビュー確認を推奨します
- MediaPipe のモデルとWASMはCDN（`jsdelivr` / `storage.googleapis.com`）から取得します。完全オフライン運用したい場合は `public/models/` に配置してコードを書き換えてください

## 開発

```bash
npm run dev      # 開発サーバー
npm run build    # 本番ビルド
npm run start    # 本番サーバー起動
```

## コントリビュート

Issue・PRは歓迎します。特に以下のような拡張を求めています:

- 動画ファイル対応（フレーム単位で処理）
- 手動でぼかし矩形を追加/削除するUI
- モデルのローカル同梱（完全オフライン化）
- モザイク/黒塗りなどぼかしスタイルの切り替え
- 他言語対応

## ライセンス

[MIT License](LICENSE)

## 作者

**やなぎ** — [X: @Yanagi_1112](https://x.com/Yanagi_1112) / [GitHub: @Yanagi-1112](https://github.com/Yanagi-1112)

「生成AIなんでも展示会」の主催者。展示会写真のSNS公開を楽にするために作りました。

## 謝辞

- [MediaPipe](https://developers.google.com/mediapipe) チーム — BlazeFaceモデルおよびTasks Vision SDK
