// スマホアプリの法務のページ（利用規約・プライバシーポリシーなど）を dist/ に書き出す。build.mjs から呼ぶ。
//
// 文面は data/legal/<アプリ>/<言語>/*.md（元の文書から本文だけを取り出したもの）。
// ★ 非公開の扱い（2026-11-10 ユーザー決定）：トップ・メニュー・サイトマップからはリンクしない／noindex。
//    元の文書の【 】は 2026-11-10 のユーザーの指示で埋めた・消した（data/legal の .md に反映済み）。
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---- アプリごと・言語ごとの設定（ページの見出しと案内の文字。法務の本文は .md 側） ----
const APPS = {
  "kosen2-mobile": {
    langs: {
      ja: {
        htmlLang: "ja", label: "日本語",
        app: "古銭プッシャーフレンズ2（Android・iOS 版）",
        pages: { terms: "利用規約", privacy: "プライバシーポリシー", "delete-account": "アカウントとデータの削除", tokushoho: "特定商取引法に基づく表記", support: "サポート" },
        fromPrivacy: (a) => `この内容は${a}の第8項と同じです。`,
        langNav: "言語", docNav: "このアプリの規約など",
      },
      en: {
        htmlLang: "en", label: "English",
        app: "\"Old Coin Pusher Friends 2\" (Android and iOS)",
        pages: { terms: "Terms of Use", privacy: "Privacy Policy", "delete-account": "Deleting Your Account and Data", tokushoho: "Business Information", support: "Support" },
        fromPrivacy: (a) => `This page is the same as Section 8 of the ${a}.`,
        langNav: "Language", docNav: "Documents for this app",
      },
      "zh-hant": {
        htmlLang: "zh-Hant", label: "繁體中文",
        app: "古錢推幣機朋友2（Android・iOS 版）",
        pages: { terms: "使用條款", privacy: "隱私權政策", "delete-account": "帳號及資料之刪除", tokushoho: "事業者資訊", support: "客服支援" },
        fromPrivacy: (a) => `本頁內容與${a}第8節相同。`,
        langNav: "語言", docNav: "本應用程式之條款等",
      },
    },
  },
};
const PAGE_ORDER = ["terms", "privacy", "delete-account", "tokushoho", "support"];

// ---- 小さな Markdown 変換（元の文書で使っている書き方だけ：見出し・段落・番号付き/箇条の入れ子・表・太字・引用・---） ----
const inline = (s) => esc(s)
  .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  .replace(/https?:\/\/[^\s<>（）()「」、。]+/g, (u) => `<a href="${u}" rel="noopener">${u}</a>`)
  .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => `<a href="mailto:${m}">${m}</a>`);

export function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let para = null;     // 段落の行
  let quote = null;    // 引用の行
  let list = null;     // { stack: [{type, items:[{html, child}]}] }
  const flushPara = () => { if (para) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = null; } };
  const flushQuote = () => { if (quote) { out.push(`<blockquote><p>${quote.map(inline).join("<br>")}</p></blockquote>`); quote = null; } };
  const renderList = (l) => `<${l.type}>${l.items.map((it) => `<li${it.value ? ` value="${it.value}"` : ""}>${it.html}${it.child ? renderList(it.child) : ""}</li>`).join("")}</${l.type}>`;
  const flushList = () => { if (list) { out.push(renderList(list.root)); list = null; } };
  const flushAll = () => { flushPara(); flushQuote(); flushList(); };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flushAll(); continue; }
    let m;
    if ((m = line.match(/^(#{1,3}) (.*?)(?:\s*\{#([\w-]+)\})?$/))) {
      flushAll();
      const n = m[1].length;
      out.push(`<h${n}${m[3] ? ` id="${m[3]}"` : ""}>${inline(m[2])}</h${n}>`);
      continue;
    }
    if (/^---$/.test(line)) { flushAll(); out.push("<hr>"); continue; }
    if ((m = line.match(/^> ?(.*)$/))) { flushPara(); flushList(); (quote ??= []).push(m[1]); continue; }
    if (/^\|/.test(line)) {
      flushAll();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th scope="col">${inline(c)}</th>`).join("")}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c, j) => (j === 0 ? `<th scope="row">${inline(c)}</th>` : `<td>${inline(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    if ((m = line.match(/^( *)(?:(\d+)\.|-) (.*)$/))) {
      flushPara(); flushQuote();
      const depth = Math.floor(m[1].length / 3);
      const type = m[2] ? "ol" : "ul";
      if (!list) list = { root: { type, items: [] } };
      // depth の階層のリストを探す（無ければ直前の項目の下に作る）
      let l = list.root;
      for (let d = 0; d < depth; d++) {
        const last = l.items[l.items.length - 1];
        if (!last) break;
        last.child ??= { type, items: [] };
        l = last.child;
      }
      l.items.push({ html: inline(m[3]), value: m[2] });
      continue;
    }
    if (list && (m = line.match(/^( {3,})(.*)$/))) {
      // 番号の項目の続きの行（字下げだけの行）→ その項目に改行して足す
      const depth = Math.floor(m[1].length / 3) - 1;
      let l = list.root;
      for (let d = 0; d < depth && l.items[l.items.length - 1]?.child; d++) l = l.items[l.items.length - 1].child;
      const last = l.items[l.items.length - 1];
      last.html += "<br>" + inline(m[2]);
      continue;
    }
    flushQuote(); flushList();
    (para ??= []).push(line);
  }
  flushAll();
  return out.join("\n");
}

// プライバシーポリシーから {#delete} の節を抜き出す → { title, body }
function deleteSection(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((l) => /^## .*\{#delete\}\s*$/.test(l));
  if (start < 0) throw new Error("privacy.md に {#delete} の節が見つかりません");
  let end = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
  if (end < 0) end = lines.length;
  const title = lines[start].replace(/^## /, "").replace(/\s*\{#delete\}\s*$/, "").replace(/^\d+\.\s*/, "");
  return { title, body: lines.slice(start + 1, end).join("\n") };
}

// ---- ページの枠 ----
function page({ site, ui, lang, langs, slug, appId, title, bodyHtml }) {
  const root = "../../../"; // dist/<アプリ>/<言語>/<ページ>/index.html から dist/ へ
  const langNav = langs.map((l) => (l === lang
    ? `<span aria-current="true">${esc(APPS[appId].langs[l].label)}</span>`
    : `<a href="../../${l}/${slug}/" hreflang="${esc(APPS[appId].langs[l].htmlLang)}" lang="${esc(APPS[appId].langs[l].htmlLang)}">${esc(APPS[appId].langs[l].label)}</a>`)).join("");
  const docNav = PAGE_ORDER.map((p) => (p === slug
    ? `<span aria-current="page">${esc(ui.pages[p])}</span>`
    : `<a href="../${p}/">${esc(ui.pages[p])}</a>`)).join("");
  return `<!DOCTYPE html>
<html lang="${esc(ui.htmlLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${esc(title)}｜${esc(ui.app)}｜${esc(site.title)}</title>
  <link rel="icon" href="${root}assets/img/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="stylesheet" href="${root}style.css">
  <link rel="stylesheet" href="${root}legal.css">
</head>
<body class="legal">
  <header class="legal-header">
    <div class="legal-inner legal-header-inner">
      <a class="legal-logo" href="${root}"><img src="${root}assets/img/logo.png" alt="${esc(site.title)}" width="980" height="160"></a>
      <nav class="legal-lang" aria-label="${esc(ui.langNav)}">${langNav}</nav>
    </div>
  </header>
  <main class="legal-inner legal-main">
    <p class="legal-app">${esc(ui.app)}</p>
    <div class="legal-body">
${bodyHtml}
    </div>
  </main>
  <footer class="legal-footer">
    <div class="legal-inner">
      <nav class="legal-docs" aria-label="${esc(ui.docNav)}">${docNav}</nav>
      <p class="legal-copy">${esc(site.copyright)}</p>
    </div>
  </footer>
</body>
</html>
`;
}

// ---- 書き出し ----
export function buildLegal(site, distDir = "dist") {
  const written = [];
  for (const [appId, app] of Object.entries(APPS)) {
    const langs = Object.keys(app.langs);
    for (const lang of langs) {
      const ui = app.langs[lang];
      const dir = `data/legal/${appId}/${lang}`;
      const read = (n) => readFileSync(`${dir}/${n}.md`, "utf8");
      const put = (slug, html) => {
        const d = `${distDir}/${appId}/${lang}/${slug}`;
        mkdirSync(d, { recursive: true });
        writeFileSync(`${d}/index.html`, html);
        written.push(`${appId}/${lang}/${slug}/`);
      };
      const common = { site, ui, lang, langs, appId };
      for (const slug of ["terms", "privacy", "tokushoho", "support"]) {
        if (!existsSync(`${dir}/${slug}.md`)) throw new Error(`${dir}/${slug}.md がありません`);
        put(slug, page({ ...common, slug, title: ui.pages[slug], bodyHtml: mdToHtml(read(slug)) }));
      }
      // アカウントとデータの削除：プライバシーポリシーの {#delete} の節をそのまま単独のページに
      const del = deleteSection(read("privacy"));
      const from = `<p class="legal-from">${ui.fromPrivacy(`<a href="../privacy/#delete">${esc(ui.pages.privacy)}</a>`)}</p>`;
      put("delete-account", page({ ...common, slug: "delete-account", title: del.title,
        bodyHtml: `<h1>${inline(del.title)}</h1>\n${from}\n<div class="legal-delete">\n${mdToHtml(del.body)}\n</div>` }));
    }
  }
  return written;
}
