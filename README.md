# stp.works — 株式会社STP WORKS 公式サイト

Wix から移行した静的サイト。**ゲーム情報は `data/games.json` を編集するだけ**で、ビルドすると `dist/` にサイトが出力される。

## 構成

| パス | 役割 |
|---|---|
| `data/games.json` | ゲームタイトル一覧（新作追加はここ）。`featured: true` の1件が最上部（LATEST RELEASE）に大きく出る。下の WORKS は配列の順のまま、`release` 1行目の年ごとにまとめて表示 |
| `data/site.json` | 会社情報・SNS・フッターのリンク |
| `assets/img/` | 画像（`<id>.webp` と `<id>-sm.webp` の2枚組） |
| `src/template.html`, `src/style.css` | 見た目 |
| `build.mjs` | `data` + `src` → `dist/` を生成 |
| `.github/workflows/deploy.yml` | push で GitHub Pages に自動デプロイ（`main`＝本番、`preview`＝ `/preview/` に出るプレビュー） |

## 新作を追加する手順

1. キービジュアル（1920×1080 推奨）を用意し、`python scripts/optimize-image.py 元画像.png <id>` で変換
2. `data/games.json` の**先頭**にエントリを追加し、旧作の `featured` を外して新作に `"featured": true`
3. `node build.mjs` → `python -m http.server 8765 --directory dist` でローカル確認
4. `preview` ブランチに push → `https://www.stp.works/preview/` で確認
5. 問題なければ `main` にマージして push → 本番反映

## 公開までの残作業（初回のみ）

- GitHub リポジトリ作成 → Settings › Pages › Source を **GitHub Actions** に
- Settings › Pages › Custom domain に `www.stp.works`
- DNS（Squarespace）: `www` CNAME → `<GitHubユーザー名>.github.io`、`stp.works` A → 185.199.108.153 / 109.153 / 110.153 / 111.153
