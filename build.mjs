// 静的サイトビルド: data/*.json + src/template.html → dist/index.html
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";

const games = JSON.parse(readFileSync("data/games.json", "utf8"));
const site = JSON.parse(readFileSync("data/site.json", "utf8"));
const tpl = readFileSync("src/template.html", "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl2br = (s) => esc(s).split("\n").map((l) => l.trim()).filter(Boolean).join("<br>");

const featured = games.find((g) => g.featured) ?? games[0];
const list = games.filter((g) => !g.featured).concat(games.filter((g) => g.featured && g !== featured));

// 「2024年7月26日（Steam）」→ { year: "2024", dot: "2024.07.26" }
const ymd = (s) => {
  const m = String(s).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  return m ? { year: m[1], dot: `${m[1]}.${m[2].padStart(2, "0")}.${m[3].padStart(2, "0")}` } : null;
};

// スマホでは「Nintendo 」を省いて「Switch」「Switch 2」と短く出す（cls に work-buttons のときだけ）
const storeButtons = (g, cls) => {
  const sw = esc(g.switchLabel ?? "Nintendo Switch");
  // ボタンは flex なので、文字を1つの span に包まないと「Nintendo 」末尾の空白が消える
  const swText = cls === "work-buttons" ? `<span>${sw.replace(/^Nintendo /, '<span class="hide-sp">Nintendo </span>')}</span>` : sw;
  return `<div class="${cls}">
            ${g.steamUrl ? `<a class="btn btn-steam" href="${esc(g.steamUrl)}" target="_blank" rel="noopener" aria-label="${esc(g.title)} を Steam ストアで見る">Steam</a>` : ""}
            ${g.switchUrl ? `<a class="btn btn-switch" href="${esc(g.switchUrl)}" target="_blank" rel="noopener" aria-label="${esc(g.title)} をニンテンドーストアで見る">${swText}</a>` : ""}
          </div>`;
};

// ---- 最上部：featured の1本を大きく ----
const fd = ymd(featured.release[0]);
const hero = `
        <div class="hero-text">
          <p class="hero-label"><span class="squares" aria-hidden="true"><span></span><span></span><span></span></span>LATEST RELEASE</p>
          <h2 class="hero-title">${esc(featured.title)}</h2>
          ${fd ? `<p class="hero-date">${fd.dot} 発売</p>` : ""}
          <p class="hero-desc">${nl2br(featured.description)}</p>
          <dl class="meta">
            <div><dt>価格</dt><dd>${esc(featured.price)}</dd></div>
            <div><dt>対応機種</dt><dd>${esc(featured.platforms)}</dd></div>
            <div><dt>対応言語</dt><dd>${esc(featured.languages)}</dd></div>
          </dl>
          ${storeButtons(featured, "hero-buttons")}
        </div>
        <div class="kv">
          <img src="assets/img/${featured.image}.webp" srcset="assets/img/${featured.image}-sm.webp 960w, assets/img/${featured.image}.webp 1920w" sizes="(max-width: 960px) 100vw, 700px" alt="${esc(featured.title)} キービジュアル" fetchpriority="high" decoding="async" width="1920" height="1080">
        </div>`;

// ---- WORKS：games.json の並び順のまま、発売年（release の1行目）ごとにまとめる ----
const years = [];
for (const g of games) {
  const d = ymd(g.release[0]);
  const y = d ? d.year : "—";
  let last = years[years.length - 1];
  if (!last || last.year !== y) years.push((last = { year: y, items: [] }));
  last.items.push({ g, d });
}
const work = ({ g, d }) => `
            <article class="work" id="game-${esc(g.id)}">
              <img class="work-img" src="assets/img/${g.image}-sm.webp" alt="${esc(g.title)}" loading="lazy" decoding="async" width="960" height="540">
              <div class="work-body">
                ${d ? `<p class="work-date">${d.dot}</p>` : ""}
                <h3 class="work-title">${esc(g.title)}</h3>
                <p class="work-platforms">${esc(g.platforms)}</p>
                ${storeButtons(g, "work-buttons")}
              </div>
            </article>`;
const worksHtml = years.map((y) => `
          <div class="year">
            <p class="year-label">${esc(y.year)}</p>
            <div class="year-works">${y.items.map(work).join("")}
            </div>
          </div>`).join("");

const about = site.about.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n            ");
const social = site.social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener"><img src="assets/img/${s.icon}.png" alt="" width="32" height="32" loading="lazy">${esc(s.name)}</a>`).join("\n            ");
const socialIcons = site.social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.name)}"><img src="assets/img/${s.icon}.png" alt="" width="28" height="28"></a>`).join("\n          ");

// 構造化データの並び: featured を先頭に、残りは games.json の順
const ordered = [featured, ...list];

// ---- 構造化データ（JSON-LD）: 会社 + ゲーム一覧 ----
const priceJPY = (s) => (String(s).match(/(\d[\d,]*)円/) || [])[1]?.replace(/,/g, "");
const gameLd = (g, i) => {
  const d = {
    "@type": "VideoGame",
    "name": g.title,
    "url": `${site.url}#game-${g.id}`,
    "image": `${site.url}assets/img/${g.image}.webp`,
    "description": g.description.replace(/\n/g, " "),
    "inLanguage": g.languages.split("/").map((s) => s.trim()),
    "gamePlatform": g.platforms.split("/").map((s) => s.trim()),
    "applicationCategory": "Game",
    "author": { "@type": "Organization", "name": site.title },
    "publisher": { "@type": "Organization", "name": site.title },
  };
  const m = String(g.release[0]).match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (m) d.datePublished = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const offers = [];
  const price = priceJPY(g.price);
  if (g.steamUrl) offers.push({ "@type": "Offer", "url": g.steamUrl, "priceCurrency": "JPY", ...(price ? { "price": price } : {}), "availability": "https://schema.org/InStock", "seller": { "@type": "Organization", "name": "Steam" } });
  if (g.switchUrl) offers.push({ "@type": "Offer", "url": g.switchUrl, "priceCurrency": "JPY", ...(price ? { "price": price } : {}), "availability": "https://schema.org/InStock", "seller": { "@type": "Organization", "name": "Nintendo eShop" } });
  if (offers.length) d.offers = offers;
  return { "@type": "ListItem", "position": i + 1, "item": d };
};
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${site.url}#organization`,
      "name": site.title,
      "alternateName": "STP WORKS",
      "url": site.url,
      "logo": `${site.url}assets/img/logo.png`,
      "image": `${site.url}assets/img/og.jpg`,
      "description": site.description,
      ...(site.foundingDate ? { "foundingDate": site.foundingDate } : {}),
      "sameAs": site.social.map((s) => s.url),
    },
    {
      "@type": "WebSite",
      "@id": `${site.url}#website`,
      "url": site.url,
      "name": site.title,
      "inLanguage": "ja",
      "publisher": { "@id": `${site.url}#organization` },
    },
    {
      "@type": "WebPage",
      "@id": site.url,
      "url": site.url,
      "name": site.titleTag ?? site.title,
      "description": site.description,
      "isPartOf": { "@id": `${site.url}#website` },
      "about": { "@id": `${site.url}#organization` },
      "primaryImageOfPage": `${site.url}assets/img/${featured.image}.webp`,
    },
    {
      "@type": "ItemList",
      "name": "STP WORKS のゲームタイトル",
      "itemListOrder": "https://schema.org/ItemListOrderDescending",
      "numberOfItems": ordered.length,
      "itemListElement": ordered.map(gameLd),
    },
  ],
};

const html = tpl
  .replaceAll("{{ANALYTICS}}", site.gaMeasurementId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(site.gaMeasurementId)}"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(site.gaMeasurementId)}',{anonymize_ip:true});</script>` : "")
  .replaceAll("{{TITLE_TAG}}", esc(site.titleTag ?? site.title))
  .replaceAll("{{TWITTER}}", esc(site.twitterHandle ?? ""))
  .replaceAll("{{SITE_VERIFICATION}}", site.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}">` : "")
  .replaceAll("{{HERO_IMG}}", `assets/img/${featured.image}.webp`)
  .replaceAll("{{HERO_SRCSET}}", `assets/img/${featured.image}-sm.webp 960w, assets/img/${featured.image}.webp 1920w`)
  .replaceAll("{{JSON_LD}}", JSON.stringify(jsonLd).replace(/</g, "\\u003c"))
  .replaceAll("{{TITLE}}", esc(site.title))
  .replaceAll("{{DESCRIPTION}}", esc(site.description))
  .replaceAll("{{URL}}", esc(site.url))
  .replaceAll("{{HERO}}", hero)
  .replaceAll("{{WORKS}}", worksHtml)
  .replaceAll("{{GAME_COUNT}}", String(games.length))
  .replaceAll("{{FOUNDING_YEAR}}", esc(String(site.foundingDate ?? "").slice(0, 4)))
  .replaceAll("{{ABOUT}}", about)
  .replaceAll("{{SOCIAL_ICONS}}", socialIcons)
  .replaceAll("{{SOCIAL}}", social)
  .replaceAll("{{CONTACT}}", esc(site.contact))
  .replaceAll("{{PRIVACY_URL}}", esc(site.privacyPolicyUrl))
  .replaceAll("{{PRESSKIT_URL}}", esc(site.pressKitUrl))
  .replaceAll("{{COPYRIGHT}}", esc(site.copyright))
  .replaceAll("{{BUILD_DATE}}", new Date().toISOString());

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
writeFileSync("dist/index.html", html);
cpSync("assets", "dist/assets", { recursive: true });
cpSync("src/style.css", "dist/style.css");
writeFileSync("dist/404.html", `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ページが見つかりません｜${esc(site.title)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/style.css"></head><body style="text-align:center;padding:80px 16px"><h1 style="font-family:var(--font-latin);font-weight:500;font-size:40px;letter-spacing:.14em">404</h1><p>お探しのページは見つかりませんでした。</p><p><a href="/" style="text-decoration:underline">トップページへ戻る</a></p></body></html>`);
writeFileSync("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}sitemap.xml\n`);
writeFileSync("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site.url}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`);
console.log(`built dist/index.html (${games.length} games, featured: ${featured.title})`);
