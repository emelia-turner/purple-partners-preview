// Build script: converts the single-file client-routed HTML plan (source-plan.html)
// into a real static multi-page site under dist/, one HTML file per route.
//
// Why: the original prototype swaps innerHTML via a JS router (bad for SEO / real URLs).
// This keeps the exact same page-content template functions (evaluated as-is from the
// source script) but renders each route to its own file at build time, and patches a
// handful of known dead-end CTAs + hotlinked images along the way.

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "source-plan.html"), "utf8");
const DIST = join(__dirname, "dist");
mkdirSync(join(DIST, "images"), { recursive: true });
mkdirSync(join(DIST, "logos"), { recursive: true });
mkdirSync(join(DIST, "brand"), { recursive: true });
mkdirSync(join(DIST, "sectors"), { recursive: true });

// ── 1. Extract the shared pieces from the source file ──────────────────
const styleBlock = SRC.slice(SRC.indexOf("<style>") + 7, SRC.indexOf("</style>"));

const bodyStart = SRC.indexOf("<body>") + 6;
const pageContentMarker = '<!-- PAGE CONTENT -->';
let navHtml = SRC.slice(bodyStart, SRC.indexOf(pageContentMarker)).trim();

let scriptText = SRC.slice(SRC.indexOf("<script>") + 8, SRC.lastIndexOf("</script>"));

// ── 2. Patch: self-host the purple.ai hotlinked images ──────────────────
const IMAGE_MAP = new Map(); // remote-name -> local filename
scriptText = scriptText.replace(
  /https:\/\/www\.purple\.ai\/_next\/image\?url=%2Fimages%2F([A-Za-z0-9_-]+)\.webp&w=\d+&q=\d+/g,
  (match, name) => {
    const local = name.toLowerCase() + ".webp";
    if (!IMAGE_MAP.has(name)) IMAGE_MAP.set(name, { local, url: match });
    return "images/" + local;
  }
);

// ── 3. Patch: route "Become a partner" CTAs to the real onboarding flow ──
const SIGNUP = "location.href='https://onboarding.purple.ai/partner'";
const scriptPatches = [
  [`<button class="btn-primary" onclick="navigate('home')">Become a partner</button>`,
   `<button class="btn-primary" onclick="${SIGNUP}">Become a partner</button>`],
  [`<button class="btn-white" onclick="navigate('home')">Become a partner</button>`,
   `<button class="btn-white" onclick="${SIGNUP}">Become a partner</button>`],
  [`<button class="btn-white" onclick="navigate('home')">Register as a partner</button>`,
   `<button class="btn-white" onclick="${SIGNUP}">Register as a partner</button>`],
  [`<span style="color:var(--purple);cursor:pointer;" onclick="navigate('home')">Apply here.</span>`,
   `<span style="color:var(--purple);cursor:pointer;" onclick="${SIGNUP}">Apply here.</span>`],
];
// The 5 identical product-page "Register as a partner" buttons - replaceAll.
const REGISTER_BTN = `<button class="btn-primary" onclick="navigate('home')">Register as a partner</button>`;
scriptText = scriptText.split(REGISTER_BTN).join(`<button class="btn-primary" onclick="${SIGNUP}">Register as a partner</button>`);

// Tools page: buttons that just re-navigated to the same page. Every one sits behind
// "available to registered partners" copy, so routing them to the signup section is the
// sensible placeholder rather than a no-op page reload - except hardware compatibility
// and the guest WiFi checklist, which have real destinations (external resources).
const toolsLabels = [
  "Browse integrations →",
  "Open calculator →", "Browse case studies →", "Read the guide →",
];
for (const label of toolsLabels) {
  scriptPatches.push([
    `<button class="btn-primary" onclick="navigate('tools')">${label}</button>`,
    `<button class="btn-primary" onclick="${SIGNUP}">${label}</button>`,
  ]);
}
const HARDWARE_DOCS = "https://support.purple.ai/hc/en-gb/articles/7330787441693-Supported-Hardware";
scriptPatches.push([
  `<button class="btn-primary" onclick="navigate('tools')">Check hardware compatibility →</button>`,
  `<button class="btn-primary" onclick="window.open('${HARDWARE_DOCS}','_blank')">Check hardware compatibility →</button>`,
]);

for (const [from, to] of scriptPatches) {
  if (!scriptText.includes(from)) throw new Error("Patch target not found: " + from.slice(0, 80));
  scriptText = scriptText.split(from).join(to);
}

// Nav bar's "Become a partner" button lives outside <script>, patch it separately.
const NAV_BECOME_A_PARTNER = `<button class="btn-solid" onclick="navigate('home')">Become a partner</button>`;
if (!navHtml.includes(NAV_BECOME_A_PARTNER)) throw new Error("Nav patch target not found");
navHtml = navHtml.replace(NAV_BECOME_A_PARTNER, `<button class="btn-solid" onclick="${SIGNUP}">Become a partner</button>`);

// ── 4. Evaluate the (patched) data + page-render functions in a sandbox ────
// Cut the script off before the routing/DOM-dependent tail (navigate/toggleDD/init) -
// none of that runs at build time; we only need the pure template functions.
const cutMarker = "function updateActiveNav";
const cutIndex = scriptText.indexOf(cutMarker);
if (cutIndex === -1) throw new Error("Could not find cut marker to trim routing code");
const buildableScript = scriptText.slice(0, cutIndex) +
  "\nglobalThis.__PAGES__ = PAGES; globalThis.__renderFooter__ = renderFooter;";

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(buildableScript, sandbox, { filename: "source-plan-script.js" });
const { __PAGES__: PAGES, __renderFooter__: renderFooter } = sandbox;

// renderCTA() is defined after the cut point (it's inside the routing section) - it's a
// tiny, static template with no DOM/data dependency, so just re-declare it here verbatim.
const renderCTA = () => `
<div class="cta-band">
  <h2>Ready to add Purple to your portfolio?</h2>
  <p>Join 80,000+ venues already running on Purple. No targets, no minimums, just bigger deals.</p>
  <div class="cta-band-btns">
    <button class="btn-white" onclick="${SIGNUP}">Become a partner</button>
    <button class="btn-outline-w" onclick="navigate('home')">Chat to us</button>
  </div>
</div>`;

// ── 5. Assemble each route into a full static HTML document ────────────
const signupSection = readFileSync(join(__dirname, "assets", "signup-section.html"), "utf8");

const ROUTES = [
  ["home", "index.html", "Purple Partners | Channel partner program"],
  ["app", "app.html", "The Purple app | Purple Partners"],
  ["staff-wifi", "staff-wifi.html", "Staff WiFi | Purple Partners"],
  ["guest-wifi", "guest-wifi.html", "Guest WiFi | Purple Partners"],
  ["multi-tenant", "multi-tenant.html", "Multi-tenant WiFi | Purple Partners"],
  ["verify", "verify.html", "Verify | Purple Partners"],
  ["shield", "shield.html", "Shield | Purple Partners"],
  ["benefits", "benefits.html", "Partner benefits | Purple Partners"],
  ["sectors", "sectors.html", "Sectors | Purple Partners"],
  ["sector-hospitality", "sector-hospitality.html", "Hospitality | Purple Partners"],
  ["sector-retail", "sector-retail.html", "Retail | Purple Partners"],
  ["sector-healthcare", "sector-healthcare.html", "Healthcare | Purple Partners"],
  ["sector-education", "sector-education.html", "Education | Purple Partners"],
  ["sector-residential", "sector-residential.html", "Residential & MDU | Purple Partners"],
  ["sector-enterprise", "sector-enterprise.html", "Enterprise | Purple Partners"],
  ["sector-transport", "sector-transport.html", "Transport & venues | Purple Partners"],
  ["tools", "tools.html", "Partner tools | Purple Partners"],
  ["marketing", "marketing.html", "Marketing support | Purple Partners"],
  ["blog", "blog.html", "Partner blog | Purple Partners"],
];

// Wrap trailing arrow glyphs (" →", " ›") in a span so CSS can nudge just the icon
// on hover, instead of the whole line of text - matches purple.ai's icon-nudge pattern.
function wrapArrows(html) {
  return html
    .replace(/ →(?=<\/\w+>)/g, ' <span class="arr">→</span>')
    .replace(/ ›(?=<\/\w+>)/g, ' <span class="arr">›</span>');
}

function page(slug, title) {
  if (!PAGES[slug]) throw new Error("Missing PAGES entry for " + slug);
  let content = wrapArrows(PAGES[slug]());
  if (slug === "home") content += signupSection;
  content += renderCTA();
  const footer = renderFooter();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
</head>
<body data-page="${slug}">
${navHtml}

<div id="page-content">${content}</div>
<div id="footer-wrap">${footer}</div>

<script src="site.js"></script>
</body>
</html>
`;
}

for (const [slug, file, title] of ROUTES) {
  writeFileSync(join(DIST, file), page(slug, title));
}

// ── 6. Copy shared static assets ────────────────────────────────────────
writeFileSync(join(DIST, "styles.css"), styleBlock.trim() + "\n");
copyFileSync(join(__dirname, "assets", "site.js"), join(DIST, "site.js"));
for (const file of readdirSync(join(__dirname, "assets", "logos"))) {
  copyFileSync(join(__dirname, "assets", "logos", file), join(DIST, "logos", file));
}
for (const file of readdirSync(join(__dirname, "assets", "brand"))) {
  copyFileSync(join(__dirname, "assets", "brand", file), join(DIST, "brand", file));
}
for (const file of readdirSync(join(__dirname, "assets", "sectors"))) {
  copyFileSync(join(__dirname, "assets", "sectors", file), join(DIST, "sectors", file));
}
copyFileSync(join(__dirname, "assets", "robots.txt"), join(DIST, "robots.txt"));

// ── 7. Download the self-hosted images ──────────────────────────────────
const downloads = [...IMAGE_MAP.values()].map(async ({ local, url }) => {
  // The Next.js image-optimizer proxy only accepts a fixed set of widths (400s on
  // anything else) - fetch the original source file directly instead.
  const sourceName = url.match(/%2Fimages%2F([A-Za-z0-9_-]+)\.webp/)[1];
  const direct = `https://www.purple.ai/images/${sourceName}.webp`;
  const res = await fetch(direct);
  if (!res.ok) throw new Error(`Failed to fetch ${direct}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(DIST, "images", local), buf);
  console.log("Downloaded", local, `(${buf.length} bytes)`);
});

await Promise.all(downloads);
console.log(`\nBuilt ${ROUTES.length} pages into dist/.`);
