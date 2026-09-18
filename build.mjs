// 静的サイトビルド: data/*.json + src/template.html → dist/index.html
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from "node:fs";

const games = JSON.parse(readFileSync("data/games.json", "utf8"));
const site = JSON.parse(readFileSync("data/site.json", "utf8"));
const tpl = readFileSync("src/template.html", "utf8");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nl2br = (s) => esc(s).split("\n").map((l) => l.trim()).filter(Boolean).join("<br>");

const featured = games.find((g) => g.featured) ?? games[0];
const list = games.filter((g) => !g.featured).concat(games.filter((g) => g.featured && g !== featured));
// 一覧の階層: 1件目=大, 2〜5件目=中, 以降=小（現サイトの見た目に合わせる）
const tier = (i) => (i === 0 ? "large" : i <= 4 ? "medium" : "small");

const picture = (g, sizes) => `
      <picture>
        <source srcset="assets/img/${g.image}-sm.webp 960w, assets/img/${g.image}.webp 1920w" sizes="${sizes}" type="image/webp">
        <img src="assets/img/${g.image}.webp" alt="${esc(g.title)}" loading="lazy" decoding="async" width="1920" height="1080">
      </picture>`;

const buttons = (g) => `
      <div class="buttons">
        ${g.steamUrl ? `<a class="btn btn-steam" href="${esc(g.steamUrl)}" target="_blank" rel="noopener">Steam</a>` : ""}
        ${g.switchUrl ? `<a class="btn btn-switch" href="${esc(g.switchUrl)}" target="_blank" rel="noopener">${esc(g.switchLabel ?? "Nintendo Switch")}</a>` : ""}
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

const html = tpl
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
writeFileSync("dist/robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}sitemap.xml\n`);
writeFileSync("dist/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${site.url}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`);
console.log(`built dist/index.html (${games.length} games, featured: ${featured.title})`);
