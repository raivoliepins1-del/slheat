(() => {
  const data = JSON.parse(document.getElementById('calc-data').textContent);
  const $ = (id) => document.getElementById(id);
  const nf = new Intl.NumberFormat(data.locale, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(data.locale, { maximumFractionDigits: 1 });
  const money = (v) => data.money.replace('{v}', v);

  /* ── price calculator ── */
  const form = $('calc');
  const area = $('area'), thick = $('thick'), thickOut = $('thick-out');
  const fill = $('gauge-fill'), tag = $('gauge-tag'), tagText = $('gauge-tag-text'), path = $('gauge-path');

  function picked(name) { return form.querySelector(`input[name="${name}"]:checked`).value; }

  function update() {
    const structure = picked('structure');
    const material = picked('material');
    const a = Math.max(0, parseFloat(String(area.value).replace(',', '.')) || 0);
    const t = parseInt(thick.value, 10);
    const [pmin, pmax] = data.prices[material][data.structures[structure].cat];
    const vol = a * t / 100;

    if (a > 0) {
      const lo = Math.floor(vol * pmin / 10) * 10;
      const hi = Math.ceil(vol * pmax / 10) * 10;
      $('r-price').textContent = money(`${nf.format(lo)}–\u200b${nf.format(hi)}`); // zero-width space: may wrap after the dash
      $('r-vol').textContent = `${nf1.format(vol)} ${data.m3}`;
    } else {
      $('r-price').textContent = '–';
      $('r-vol').textContent = '–';
    }
    $('r-m2').textContent = money(`${nf.format(Math.round(t / 100 * pmin))}–${nf.format(Math.round(t / 100 * pmax))}`);

    thickOut.textContent = `${t} ${data.cm}`;
    tagText.textContent = `${t} ${data.cm}`;
    const shift = `translateY(${(80 - t) * 4}px)`;
    fill.style.transform = shift;
    tag.style.transform = shift;
    path.setAttribute('fill', `url(#tex-${material})`);
  }

  form.addEventListener('change', (e) => {
    if (e.target.name === 'structure') thick.value = data.structures[e.target.value].def;
    update();
  });
  form.addEventListener('input', update);
  form.addEventListener('submit', (e) => e.preventDefault());
  update();

  /* carry calculator choices into the contact form */
  $('calc-cta').addEventListener('click', () => {
    const s = picked('structure');
    const opt = document.querySelector(`#f-what option[data-key="${s}"]`);
    if (opt) opt.selected = true;
    if (parseFloat(area.value) > 0) $('f-area').value = area.value;
  });

  /* ── contact form → email draft ── */
  $('contact-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const lines = [];
    for (const [key, label] of Object.entries(data.form_labels)) {
      let v = String(fd.get(key) || '').trim();
      if (!v) continue;
      if (key === 'area') v += ` ${data.m2}`;
      lines.push(`${label}: ${v}`);
    }
    window.location.href = `mailto:${data.email}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  });

  /* ── thermal background: graded by scroll like a heat map, and slowly "breathing" on its own ── */
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sets = ['cold', 'mid', 'hot'].map((k) => document.querySelector(`.thermal__set--${k}`));
  const clamp = (v) => Math.max(0, Math.min(1, v));
  let progress = 0, last = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress = max > 0 ? clamp(scrollY / max) : 0;
  };
  const paint = (now) => {
    const wobble = reduceMotion ? 0 : Math.sin(now / 9000) * 0.08 + Math.sin(now / 23000) * 0.06;
    const h = clamp(progress + wobble);
    sets[0].style.opacity = clamp(1 - h / 0.6).toFixed(3);
    sets[1].style.opacity = clamp(1 - Math.abs(h - 0.5) / 0.4).toFixed(3);
    sets[2].style.opacity = clamp((h - 0.4) / 0.5).toFixed(3);
  };
  const loop = (now) => {
    if (now - last > 66) { last = now; paint(now); }
    requestAnimationFrame(loop);
  };
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', readScroll);
  readScroll();
  if (reduceMotion) {
    paint(0);
    addEventListener('scroll', () => paint(0), { passive: true });
  } else {
    requestAnimationFrame(loop);
  }

  /* ── float in / float out ── */
  const root = document.documentElement;
  const items = document.querySelectorAll('[data-reveal]');
  const reduce = reduceMotion;
  const startReveals = () => {
    if (reduce || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); e.target.classList.remove('is-above'); }
        else { e.target.classList.remove('is-in'); e.target.classList.toggle('is-above', e.boundingClientRect.top < 0); }
      }
    }, { threshold: 0, rootMargin: '-4% 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  };

  /* ── intro: insulation flecks blow in and form the logo, then it glides into the header ── */
  const intro = document.querySelector('.intro');
  if (root.classList.contains('intro-on') && intro) runIntro(); else startReveals();

  function runIntro() {
    const bg = intro.querySelector('.intro__bg');
    const mark = intro.querySelector('.intro__mark');
    const svg = mark.querySelector('svg');
    const brand = document.querySelector('.brand__logo');
    let gone = false, revealed = false, raf = 0;
    const timers = [];
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    const reveal = () => { if (!revealed) { revealed = true; root.classList.add('intro-done'); startReveals(); } };
    const cleanup = () => {
      if (gone) return; gone = true;
      cancelAnimationFrame(raf); timers.forEach(clearTimeout);
      if (brand) brand.style.visibility = '';
      reveal(); intro.remove();
    };
    const skip = () => {
      if (gone) return;
      reveal();
      const a = intro.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 280, fill: 'forwards' });
      a.onfinish = cleanup;
    };
    intro.addEventListener('click', skip);
    addEventListener('keydown', skip, { once: true });
    if (brand) brand.style.visibility = 'hidden';
    try { play(); } catch (err) { skip(); }

    function play() {
      const ring = svg.querySelector('.ix-ring'), roof = svg.querySelector('.ix-roof');
      const wipe = svg.querySelector('.ix-wipe'), all = svg.querySelector('.ix-all');
      const s1 = svg.querySelector('.ix-spark1'), s2 = svg.querySelector('.ix-spark2');
      const Lr = ring.getTotalLength(), Lf = roof.getTotalLength();
      const PAD = 24; // keeps the round line caps out of sight before a line starts drawing
      ring.style.strokeDasharray = `${Lr} ${Lr + PAD * 2}`; ring.style.strokeDashoffset = Lr + PAD;
      roof.style.strokeDasharray = `${Lf} ${Lf + PAD * 2}`; roof.style.strokeDashoffset = Lf + PAD;
      const seg = (t, a, b) => clamp((t - a) / (b - a));
      const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      const out = (x) => 1 - Math.pow(1 - x, 3);
      const spark = (el, path, len, e) => {
        const p = path.getPointAtLength(len);
        el.setAttribute('transform', `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
        el.setAttribute('opacity', Math.min(1, Math.sin(Math.PI * e) * 3).toFixed(3));
      };
      svg.animate([{ transform: 'scale(.9)' }, { transform: 'scale(1)' }], { duration: 1600, easing: 'cubic-bezier(.2, .7, .2, 1)', fill: 'forwards' });
      const t0 = performance.now();
      const tick = (now) => {
        const t = now - t0;
        const e1 = inOut(seg(t, 80, 1000));                      // ring traces from the green side round to yellow
        ring.style.strokeDashoffset = (Lr + PAD) * (1 - e1);
        spark(s1, ring, Lr * e1, e1);
        const e2 = inOut(seg(t, 600, 1120));                     // roof line draws: wall, eave, apex, eave
        roof.style.strokeDashoffset = (Lf + PAD) * (1 - e2);
        spark(s2, roof, Lf * e2, e2);
        wipe.setAttribute('width', (160 * out(seg(t, 980, 1480))).toFixed(2));  // lettering wipes in
        all.setAttribute('opacity', seg(t, 1440, 1700).toFixed(3));             // white fill and fine detail settle
        if (t < 1760 && !gone) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      later(1560, () => mark.classList.add('glint'));
      later(1900, fly);
    }

    function fly() {
      if (gone) return;
      reveal();
      bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, easing: 'ease', fill: 'forwards' });
      const from = mark.getBoundingClientRect();
      const to = brand ? brand.getBoundingClientRect() : null;
      if (!to || !to.width) { skip(); return; }
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      const sc = to.width / from.width;
      const a = mark.animate(
        [{ transform: 'translate(-50%, -50%)' }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${sc})` }],
        { duration: 640, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' }
      );
      a.onfinish = cleanup;
    }
  }

  /* ── swipe rows: dots follow the scroll, tap a dot to jump ── */
  document.querySelectorAll('.swipe').forEach((row) => {
    const dotsBox = row.nextElementSibling;
    if (!dotsBox || !dotsBox.classList.contains('swipe-dots')) return;
    const dots = [...dotsBox.children];
    const cards = [...row.children];
    let pending = false;
    const sync = () => {
      pending = false;
      let idx = 0;
      if (row.scrollLeft + row.clientWidth >= row.scrollWidth - 4) idx = cards.length - 1;
      else {
        const base = cards[0].offsetLeft;
        let best = Infinity;
        cards.forEach((c, i) => { const d = Math.abs(c.offsetLeft - base - row.scrollLeft); if (d < best) { best = d; idx = i; } });
      }
      dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
    };
    row.addEventListener('scroll', () => { if (!pending) { pending = true; requestAnimationFrame(sync); } }, { passive: true });
    dots.forEach((d, i) => d.addEventListener('click', () => row.scrollTo({ left: cards[i].offsetLeft - cards[0].offsetLeft, behavior: 'smooth' })));
  });

  /* ── map: hover, focus, click or tap a country (or its chip) to show its name ── */
  const map = document.querySelector('.map');
  if (map) {
    const paths = [...map.querySelectorAll('.c')];
    const chips = [...map.querySelectorAll('.map__chip')];
    const tags = [...map.querySelectorAll('.map__tag')];
    let pinned = null;
    const show = (k) => {
      map.classList.toggle('has-active', !!k);
      [...paths, ...chips, ...tags].forEach((el) => el.classList.toggle('is-on', el.dataset.k === k));
      chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.k === k)));
    };
    [...paths, ...chips].forEach((el) => {
      const k = el.dataset.k;
      el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') show(k); });
      el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(pinned); });
      el.addEventListener('focus', () => show(k));
      el.addEventListener('blur', () => show(pinned));
      el.addEventListener('click', (e) => { e.stopPropagation(); pinned = pinned === k ? null : k; show(pinned || (el.matches(':hover') ? k : null)); });
      if (el.tagName.toLowerCase() === 'path') {
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
      }
    });
    document.addEventListener('click', () => { if (pinned) { pinned = null; show(null); } });
  }

  /* ── close language menu on outside click / Escape ── */
  const lang = document.querySelector('.lang');
  if (lang) {
    document.addEventListener('click', (e) => { if (lang.open && !lang.contains(e.target)) lang.open = false; });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && lang.open) { lang.open = false; lang.querySelector('summary').focus(); } });
  }
})();
