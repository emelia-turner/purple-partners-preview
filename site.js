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
  'app': 'WiFi', 'staff-wifi': 'WiFi', 'guest-wifi': 'WiFi', 'multi-tenant': 'WiFi', 'verify': 'WiFi', 'shield': 'WiFi',
  'benefits': 'Benefits',
  'sectors': 'Sectors', 'sector-hospitality': 'Sectors', 'sector-retail': 'Sectors', 'sector-healthcare': 'Sectors',
  'sector-education': 'Sectors', 'sector-residential': 'Sectors', 'sector-enterprise': 'Sectors', 'sector-transport': 'Sectors',
  'tools': 'Tools', 'marketing': 'Marketing support', 'blog': 'Blog',
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
