// 静的サイトビルド: data/*.json + src/template.html → dist/index.html
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";

const games = JSON.parse(readFileSync("data/games.json", "utf8"));
const site = JSON.parse(readFileSync("data/site.json", "utf8"));
const tpl = readFileSync("src/template.html", "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl2br = (s) => esc(s).split("\n").map((l) => l.trim()).filter(Boolean).join("<br>");

const featured = games.find((g) => g.featured) ?? games[0];
const list = games.filter((g) => !g.featured).concat(games.filter((g) => g.featured && g !== featured));
// 一覧の階層: 1件目=大, 2件目以降=中（すべて同じサイズ）
const tier = (i) => (i === 0 ? "large" : "medium");

const picture = (g, sizes) => `
      <picture>
        <source srcset="assets/img/${g.image}-sm.webp 960w, assets/img/${g.image}.webp 1920w" sizes="${sizes}" type="image/webp">
        <img src="assets/img/${g.image}.webp" alt="${esc(g.title)}" loading="lazy" decoding="async" width="1920" height="1080">
      </picture>`;

const buttons = (g) => `
      <div class="buttons">
        ${g.steamUrl ? `<a class="btn btn-steam" href="${esc(g.steamUrl)}" target="_blank" rel="noopener" aria-label="${esc(g.title)} を Steam ストアで見る">Steam</a>` : ""}
        ${g.switchUrl ? `<a class="btn btn-switch" href="${esc(g.switchUrl)}" target="_blank" rel="noopener" aria-label="${esc(g.title)} をニンテンドーストアで見る">${esc(g.switchLabel ?? "Nintendo Switch")}</a>` : ""}
      </div>`;

const card = (g, i) => `
    <article class="game ${tier(i)}" id="game-${esc(g.id)}">
      <h3 class="game-title">${esc(g.title)}</h3>
      ${picture(g, tier(i) === "large" ? "(max-width: 960px) 100vw, 906px" : "(max-width: 960px) 100vw, 435px")}
      <div class="game-body">
        <p class="game-desc">${nl2br(g.description)}</p>
        <div class="game-side">
          <dl class="game-meta">
            <div><dt>発売日</dt><dd>${g.release.map(esc).join("<br>")}</dd></div>
            <div><dt>価格</dt><dd>${esc(g.price)}</dd></div>
            <div><dt>対応言語</dt><dd>${esc(g.languages)}</dd></div>
            <div><dt>販売プラットフォーム</dt><dd>${esc(g.platforms)}</dd></div>
          </dl>
          ${buttons(g)}
        </div>
      </div>
    </article>`;

const hero = `
    <a class="hero-link" href="#game-${esc(featured.id)}" aria-label="${esc(featured.title)} の詳細へ">
      <picture>
        <source srcset="assets/img/${featured.image}-sm.webp 960w, assets/img/${featured.image}.webp 1920w" sizes="100vw" type="image/webp">
        <img src="assets/img/${featured.image}.webp" alt="${esc(featured.title)}" fetchpriority="high" decoding="async" width="1920" height="1080">
      </picture>
    </a>`;

const about = site.about.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("\n          ");
const social = site.social.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.name)}"><img src="assets/img/${s.icon}.png" alt="${esc(s.name)}" width="40" height="40"></a>`).join("\n          ");

// 一覧の先頭は featured 以外の最新作。featured 自身は一覧にも「大」で載せる。
const ordered = [featured, ...list];
const cards = ordered.map(card).join("\n");

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
  .replaceAll("{{GAMES}}", cards)
  .replaceAll("{{ABOUT}}", about)
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
writeFileSync("dist/404.html", `<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ページが見つかりません｜${esc(site.title)}</title><meta name="robots" content="noindex"><link rel="stylesheet" href="/style.css"></head><body style="text-align:center;padding:80px 16px"><h1 style="font-family:var(--font-display);font-size:34px;letter-spacing:.14em">404</h1><p>お探しのページは見つかりませんでした。</p><p><a href="/" style="text-decoration:underline">トップページへ戻る</a></p></body></html>`);
writeFileSync("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}sitemap.xml\n`);
writeFileSync("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site.url}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`);
console.log(`built dist/index.html (${games.length} games, featured: ${featured.title})`);
