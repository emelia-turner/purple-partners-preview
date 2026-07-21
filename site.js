// Purple Partners preview - shared client behaviour for every static page.
// Real per-page navigation replaces the original single-file client-side router.

// ── TESTIMONIAL CAROUSEL ─────────────────────────────────────────
let testimonialTimer = null;
function goToTestimonial(i) {
  const slides = document.querySelectorAll('.quote-slides .quote-card');
  const dots = document.querySelectorAll('.quote-dot');
  if (!slides.length) return;
  slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
  dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
  startTestimonialAutoplay();
}
function startTestimonialAutoplay() {
  const slides = document.querySelectorAll('.quote-slides .quote-card');
  if (slides.length <= 1) return;
  clearInterval(testimonialTimer);
  testimonialTimer = setInterval(() => {
    const current = document.querySelector('.quote-slides .quote-card.active');
    const idx = [...slides].indexOf(current);
    goToTestimonial((idx + 1) % slides.length);
  }, 6000);
}
document.addEventListener('DOMContentLoaded', startTestimonialAutoplay);

// ── CASE STUDY CAROUSEL ──────────────────────────────────────────
let caseStudyTimer = null;
function goToCaseStudy(i) {
  const slides = document.querySelectorAll('.cs-slides .cs-slide');
  const dots = document.querySelectorAll('.cs-dot');
  if (!slides.length) return;
  slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
  dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
  startCaseStudyAutoplay();
}
function stepCaseStudy(delta) {
  const slides = document.querySelectorAll('.cs-slides .cs-slide');
  if (!slides.length) return;
  const current = document.querySelector('.cs-slides .cs-slide.active');
  const idx = [...slides].indexOf(current);
  goToCaseStudy((idx + delta + slides.length) % slides.length);
}
function startCaseStudyAutoplay() {
  const slides = document.querySelectorAll('.cs-slides .cs-slide');
  if (slides.length <= 1) return;
  clearInterval(caseStudyTimer);
  caseStudyTimer = setInterval(() => {
    const current = document.querySelector('.cs-slides .cs-slide.active');
    const idx = [...slides].indexOf(current);
    goToCaseStudy((idx + 1) % slides.length);
  }, 5000);
}
document.addEventListener('DOMContentLoaded', startCaseStudyAutoplay);

// ── MULTI-CARD CASE STUDY CAROUSEL (sector pages) ─────────────────
// Native horizontal scroll with snap, so it also responds to trackpad/touch
// swipes directly, not just the arrow buttons and dots.
let csmTimer = null;
function csmCardStep() {
  const viewport = document.querySelector('.csm-viewport');
  const card = viewport && viewport.querySelector('.csm-card');
  if (!card) return 0;
  return card.getBoundingClientRect().width + 20;
}
function csmGoTo(i) {
  const viewport = document.querySelector('.csm-viewport');
  const step = csmCardStep();
  if (!viewport || !step) return;
  viewport.scrollTo({ left: i * step, behavior: 'smooth' });
}
function csmStep(delta) {
  const viewport = document.querySelector('.csm-viewport');
  const step = csmCardStep();
  if (!viewport || !step) return;
  const maxScroll = viewport.scrollWidth - viewport.clientWidth;
  let target = viewport.scrollLeft + delta * step;
  if (target > maxScroll - 2) target = 0;
  if (target < 0) target = maxScroll;
  viewport.scrollTo({ left: target, behavior: 'smooth' });
}
function csmUpdateDots() {
  const viewport = document.querySelector('.csm-viewport');
  const dots = document.querySelectorAll('.csm-carousel .cs-dot');
  const step = csmCardStep();
  if (!viewport || !dots.length || !step) return;
  const idx = Math.round(viewport.scrollLeft / step);
  dots.forEach((d, i) => d.classList.toggle('active', i === idx));
}
function startCsmAutoplay() {
  const viewport = document.querySelector('.csm-viewport');
  if (!viewport || viewport.querySelectorAll('.csm-card').length <= 1) return;
  clearInterval(csmTimer);
  csmTimer = setInterval(() => csmStep(1), 4500);
}
document.addEventListener('DOMContentLoaded', () => {
  const viewport = document.querySelector('.csm-viewport');
  if (!viewport) return;
  viewport.addEventListener('scroll', csmUpdateDots);
  startCsmAutoplay();
});

function navigate(page) {
  closeAllDD();
  location.href = (page === 'home' ? 'index' : page) + '.html';
}

function toggleDD(id) {
  const el = document.getElementById(id);
  const isOpen = el.classList.contains('open');
  closeAllDD();
  if (!isOpen) el.classList.add('open');
}

function closeAllDD() {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('open'));
}

document.addEventListener('click', e => {
  if (!e.target.closest('.nav-item')) closeAllDD();
});

// ── FORMS (client-side only - no backend wired up yet) ──────────────
function submitMDF() {
  document.getElementById('mdf-form').style.display = 'none';
  document.getElementById('mdf-success').style.display = 'block';
}

function submitPartnerSignup() {
  document.getElementById('signup-form').style.display = 'none';
  document.getElementById('signup-success').style.display = 'block';
}

function submitExpertForm() {
  document.getElementById('expert-form').style.display = 'none';
  document.getElementById('expert-success').style.display = 'block';
}

function submitNewsletter(btnEl) {
  btnEl.closest('.newsletter-cta').classList.add('subscribed');
}

function submitCallOutDay() {
  document.getElementById('call-out-day-form').style.display = 'none';
  document.getElementById('call-out-day-success').style.display = 'block';
}

// ── FAQ ACCORDION ─────────────────────────────────────────────────
function toggleFaq(btnEl) {
  const item = btnEl.closest('.faq-item');
  const wasOpen = item.classList.contains('open');
  item.parentElement.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

// ── BLOG CATEGORY FILTER ─────────────────────────────────────────
function filterBlog(cat, btnEl) {
  document.querySelectorAll('#blog-filters .blog-filter-btn').forEach(b => b.classList.remove('active'));
  btnEl.classList.add('active');
  const cards = document.querySelectorAll('#blog-grid .blog-card');
  let visible = 0;
  cards.forEach(card => {
    const show = cat === 'All' || card.dataset.cat === cat;
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  document.getElementById('blog-empty').style.display = visible === 0 ? 'block' : 'none';
}

// ── ACTIVE NAV HIGHLIGHT ──────────────────────────────────────────
const NAV_MAP = {
  'app': 'WiFi', 'staff-wifi': 'WiFi', 'guest-wifi': 'WiFi', 'guest-wifi-plans': 'WiFi', 'multi-tenant': 'WiFi', 'verify': 'WiFi', 'shield': 'WiFi',
  'benefits': 'Benefits',
  'sectors': 'Sectors', 'sector-hospitality': 'Sectors', 'sector-retail': 'Sectors', 'sector-healthcare': 'Sectors',
  'sector-education': 'Sectors', 'sector-residential': 'Sectors', 'sector-enterprise': 'Sectors', 'sector-transport': 'Sectors',
  'tools': 'Tools', 'marketing': 'Tools', 'call-out-day': 'Tools', 'blog': 'Blog',
};

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  const label = NAV_MAP[page];
  if (!label) return;
  document.querySelectorAll('.nav-link').forEach(el => {
    if (el.textContent.trim().startsWith(label)) el.classList.add('active');
  });
});

// ── COUNT-UP STATS ────────────────────────────────────────────────
// Numbers like "12%", "15x", "80k+", "1.9m" count up from 0 the first time
// they scroll into view. Reads the target straight off the element's own
// text, so no extra data attributes need to be authored per stat.
function initCountUp() {
  const els = document.querySelectorAll('.why-num, .benefit-num, .stat-num');
  if (!els.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const animate = (el) => {
    const raw = el.textContent.trim();
    const match = raw.match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!match) return;
    const target = parseFloat(match[1]);
    const suffix = match[2];
    const decimals = (match[1].split('.')[1] || '').length;
    if (reduceMotion) return;

    const duration = 1000;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(decimals) + suffix;
    }
    el.textContent = '0' + (decimals ? '.' + '0'.repeat(decimals) : '') + suffix;
    requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      animate(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.4 });

  els.forEach(el => {
    if (!/^\d/.test(el.textContent.trim())) return;
    io.observe(el);
  });
}

document.addEventListener('DOMContentLoaded', initCountUp);

// ── HERO PORTAL MOCKUP PARALLAX TILT ─────────────────────────────
// Soft rotateX tilt on the home hero's portal screenshot mockup, tied to
// its position in the viewport: tilted back before it's scrolled to,
// flattens as it centers, tilts the other way as it scrolls past. The
// CSS transition on .hero-dark-frame smooths out the per-event jumps.
function initHeroTilt() {
  const frame = document.querySelector('.hero-dark-frame');
  if (!frame) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function update() {
    const rect = frame.getBoundingClientRect();
    const viewportMid = window.innerHeight / 2;
    const elMid = rect.top + rect.height / 2;
    const progress = (viewportMid - elMid) / window.innerHeight;
    const tilt = Math.max(-5, Math.min(5, progress * 9));
    frame.style.transform = `rotateX(${tilt}deg)`;
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

document.addEventListener('DOMContentLoaded', initHeroTilt);

// ── SCROLL-TRIGGERED SECTION REVEAL ───────────────────────────────
// Fades and lifts each major section (.section, .section-sm, .dark-section)
// into place the first time it scrolls into view, rather than a flat,
// all-at-once page load.
function initScrollReveal() {
  const els = document.querySelectorAll('.section, .section-sm, .dark-section, .reveal');
  if (!els.length) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in-view');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  els.forEach(el => io.observe(el));
}

document.addEventListener('DOMContentLoaded', initScrollReveal);
