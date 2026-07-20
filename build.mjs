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
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "source-plan.html"), "utf8");
const DIST = join(__dirname, "dist");
mkdirSync(join(DIST, "images"), { recursive: true });
mkdirSync(join(DIST, "logos"), { recursive: true });
mkdirSync(join(DIST, "brand"), { recursive: true });
mkdirSync(join(DIST, "sectors"), { recursive: true });

// ── 1. Extract the shared pieces from the source file ──────────────────
const styleBlock = SRC.slice(SRC.indexOf("<style>") + 7, SRC.indexOf("</style>"));
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 8);
const CSS_HASH = hash(styleBlock);
const SITE_JS = readFileSync(join(__dirname, "assets", "site.js"), "utf8");
const JS_HASH = hash(SITE_JS);

const bodyStart = SRC.indexOf("<body>") + 6;
const pageContentMarker = '<!-- PAGE CONTENT -->';
let navHtml = SRC.slice(bodyStart, SRC.indexOf(pageContentMarker)).trim();

let scriptText = SRC.slice(SRC.indexOf("<script>") + 8, SRC.lastIndexOf("</script>"));

// ── 2. Patch: self-host the purple.ai hotlinked images ──────────────────
const IMAGE_MAP = new Map(); // remote-name -> local filename
scriptText = scriptText.replace(
  /https:\/\/www\.purple\.ai\/_next\/image\?url=%2Fimages%2F([A-Za-z0-9_-]+)\.(webp|avif)&w=\d+&q=\d+/g,
  (match, name, ext) => {
    const local = name.toLowerCase() + "." + ext;
    if (!IMAGE_MAP.has(name)) IMAGE_MAP.set(name, { local, ext, url: match });
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
  [`<span style="color:var(--purple);cursor:pointer;" onclick="navigate('home')">Apply here.</span>`,
   `<span style="color:var(--purple);cursor:pointer;" onclick="${SIGNUP}">Apply here.</span>`],
];

// Tools page: buttons that just re-navigated to the same page. Every one sits behind
// "available to registered partners" copy, so routing them to the signup section is the
// sensible placeholder rather than a no-op page reload - except hardware compatibility,
// the guest WiFi checklist, integrations library, and case studies, which have real destinations.
const toolsLabels = [
  "Read the guide →",
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
    <button class="btn-outline-w" onclick="navigate('speak-to-an-expert')">Speak to an expert</button>
  </div>
</div>`;

// ── 5. Assemble each route into a full static HTML document ────────────
const ROUTES = [
  ["home", "index.html", "Purple Partners | Channel partner program"],
  ["app", "app.html", "The Purple app | Purple Partners"],
  ["staff-wifi", "staff-wifi.html", "Staff WiFi | Purple Partners"],
  ["guest-wifi", "guest-wifi.html", "Guest WiFi | Purple Partners"],
  ["guest-wifi-plans", "guest-wifi-plans.html", "Guest WiFi plans | Purple Partners"],
  ["case-studies", "case-studies.html", "Case studies | Purple Partners"],
  ["case-study-newcastle", "case-study-newcastle.html", "Newcastle City Council | Purple Partners"],
  ["case-study-resorts-world-birmingham", "case-study-resorts-world-birmingham.html", "Resorts World Birmingham | Purple Partners"],
  ["case-study-paignton-zoo", "case-study-paignton-zoo.html", "Paignton Zoo | Purple Partners"],
  ["case-study-pizza-express-uae", "case-study-pizza-express-uae.html", "Pizza Express UAE | Purple Partners"],
  ["case-study-st-georges", "case-study-st-georges.html", "St George's Healthcare NHS Trust | Purple Partners"],
  ["case-study-queen-elizabeth-hospital", "case-study-queen-elizabeth-hospital.html", "The Queen Elizabeth Hospital | Purple Partners"],
  ["case-study-avanti-west-coast", "case-study-avanti-west-coast.html", "Avanti West Coast | Purple Partners"],
  ["case-study-c2c", "case-study-c2c.html", "c2c | Purple Partners"],
  ["case-study-pizza-express", "case-study-pizza-express.html", "Pizza Express | Purple Partners"],
  ["case-study-ags-airports", "case-study-ags-airports.html", "AGS Airports | Purple Partners"],
  ["case-study-harrods", "case-study-harrods.html", "Harrods | Purple Partners"],
  ["case-study-mcdonalds-belgium", "case-study-mcdonalds-belgium.html", "McDonald's Belgium | Purple Partners"],
  ["case-study-brussels-south-charleroi-airport", "case-study-brussels-south-charleroi-airport.html", "Brussels South Charleroi Airport | Purple Partners"],
  ["speak-to-an-expert", "speak-to-an-expert.html", "Speak to an expert | Purple Partners"],
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
  ["call-out-day", "call-out-day.html", "Partner Call-Out Days | Purple Partners"],
  ["blog", "blog.html", "Partner blog | Purple Partners"],
  ["blog-airport-rfp", "blog-airport-rfp.html", "Turning WiFi into Revenue | Purple Partners"],
  ["blog-faster-network", "blog-faster-network.html", "How to give your customers a faster network | Purple Partners"],
  ["blog-open-to-secure", "blog-open-to-secure.html", "From open to secure | Purple Partners"],
  ["blog-staff-wifi-education", "blog-staff-wifi-education.html", "Staff WiFi for schools and universities | Purple Partners"],
  ["blog-auto-revocation", "blog-auto-revocation.html", "Auto-revocation | Purple Partners"],
  ["blog-contractor-access", "blog-contractor-access.html", "Contractor and time-limited staff WiFi access | Purple Partners"],
  ["blog-sceptical-it-manager", "blog-sceptical-it-manager.html", "Selling passwordless WiFi to a sceptical IT manager | Purple Partners"],
  ["blog-zero-trust", "blog-zero-trust.html", "Zero Trust networking for WiFi | Purple Partners"],
  ["blog-three-problems", "blog-three-problems.html", "The 3 problems Purple solves | Purple Partners"],
  ["blog-client-meeting", "blog-client-meeting.html", "Introducing identity-based networks in a client meeting | Purple Partners"],
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
<link rel="stylesheet" href="styles.css?v=${CSS_HASH}">
</head>
<body data-page="${slug}">
${navHtml}

<div id="page-content">${content}</div>
<div id="footer-wrap">${footer}</div>

<script src="site.js?v=${JS_HASH}"></script>
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
const downloads = [...IMAGE_MAP.values()].map(async ({ local, url, ext }) => {
  // The Next.js image-optimizer proxy only accepts a fixed set of widths (400s on
  // anything else) - fetch the original source file directly instead.
  const sourceName = url.match(/%2Fimages%2F([A-Za-z0-9_-]+)\.(webp|avif)/)[1];
  const direct = `https://www.purple.ai/images/${sourceName}.${ext}`;
  const res = await fetch(direct);
  if (!res.ok) throw new Error(`Failed to fetch ${direct}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(DIST, "images", local), buf);
  console.log("Downloaded", local, `(${buf.length} bytes)`);
});

await Promise.all(downloads);

// ── 8. Download real blog post images from the live partners.purple.ai (Duda) ──
mkdirSync(join(DIST, "images", "blog"), { recursive: true });
const BLOG_IMAGES = {
  "airport-rfp.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_d983qud983qud983-400w.png",
  "faster-network.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_7dct147dct147dct-400w.png",
  "open-to-secure.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_aa7xvzaa7xvzaa7x-0c115474-400w.png",
  "staff-wifi-education.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_9wz46f9wz46f9wz4-400w.png",
  "auto-revocation.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_vvjsiuvvjsiuvvjs-400w.png",
  "contractor-access.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_tyhiletyhiletyhi-400w.png",
  "sceptical-it-manager.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_eifdwdeifdwdeifd-400w.png",
  "zero-trust.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_oe8uoeoe8uoeoe8u-400w.png",
  "three-problems.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_iwayjeiwayjeiway-400w.png",
  "client-meeting.png": "https://lirp.cdn-website.com/77f83eaf/dms3rep/multi/opt/Gemini_Generated_Image_va0xmhva0xmhva0x-400w.png",
};
const blogDownloads = Object.entries(BLOG_IMAGES).map(async ([local, url]) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(DIST, "images", "blog", local), buf);
  console.log("Downloaded blog/" + local, `(${buf.length} bytes)`);
});
await Promise.all(blogDownloads);

// ── 9. Download real case-study logo/identity images from purple.ai ─────
mkdirSync(join(DIST, "images", "case-studies"), { recursive: true });
const CASE_STUDY_IMAGES = {
  "newcastle.webp": "https://www.purple.ai/images/newcastle-city-council-logo.webp",
  "resorts-world-birmingham.webp": "https://www.purple.ai/images/resorts-world-birmingham-logo.webp",
  "paignton-zoo.png": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c72f9e16892136ecf2e_paignton-zoo.png",
  "pizza-express.png": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c6f84ecd8912fe9d96b_pizzaexpressblack.png",
  "st-georges.avif": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c702c47f6f72d625151_st-georges-hosp-charity.avif",
  "queen-elizabeth-hospital.avif": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c7031b6c17b9964fa71_the-queen-elizabeth-hospital.avif",
  "avanti-west-coast.avif": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c6fb683316babd53cfd_avanti_west_coast_logo.svg_-1.avif",
  "c2c.avif": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c6f3f82a39b8a0a3923_c2c_logo.avif",
  "ags-airports.png": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c6e99613b001ade9b02_ags-airports.png",
  "harrods.png": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c6c3ba728317fc89d24_harrods.png",
  "mcdonalds.png": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c6cafa2a2c570d8cddd_mcdonalds-logo-yellow.png",
  "brussels-south-charleroi.png": "https://cdn.prod.website-files.com/67e7d06f4e3f231ee5df2b76/67ee7c6c00a614f9cea99a53_brussels-south-charleroi-airport.png",
};
const caseStudyDownloads = Object.entries(CASE_STUDY_IMAGES).map(async ([local, url]) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(DIST, "images", "case-studies", local), buf);
  console.log("Downloaded case-studies/" + local, `(${buf.length} bytes)`);
});
await Promise.all(caseStudyDownloads);

console.log(`\nBuilt ${ROUTES.length} pages into dist/.`);
