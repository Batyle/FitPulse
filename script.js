/* =========================================================
   FitPulse — script.js
   Personal fitness reminders
   • API Ninjas / free-exercise-db → live exercise data
   • wger.de API → real exercise photos (no key required)
   • EmailJS → confirmation + reminder emails
   • Notification API + localStorage → in-browser reminders
   ========================================================= */

(function () {
    'use strict';

    /* =======================================================
       1. CONFIG
       ======================================================= */
    const CONFIG = {
        /* --- Exercise data (API Ninjas) --- */
        API_KEY: 'YOUR_API_NINJAS_KEY',
        API_BASE: 'https://api.api-ninjas.com/v1/exercises',
        FALLBACK_URL:
            'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',

        /* --- wger.de exercise images (no key required) --- */
        WGER_BASE: 'https://wger.de/api/v2',
        WGER_CACHE_TTL: 1000 * 60 * 60,
        WGER_LIMIT: 40,

        CACHE_TTL: 1000 * 60 * 30,
        MODAL_LIMIT: 5,
        PREVIEW_LIMIT: 4,

        /* --- EmailJS --- */
        EMAILJS: {
            serviceId:  'service_kmrvd4s',
            templateId: 'template_x7z2cgf'
        },

        SCHEDULER_URL: '',

        SENDER: {
            name:    'FitPulse',
            email:   'reminders@fitpulse.example',
            tagline: 'Personal fitness reminders, delivered on time.'
        }
    };

    /* =======================================================
       2. VARIATION MAP — with wger category mapping
       ---------------------------------------------------------
       wger category IDs:
         8  = Arms          9  = Legs       10 = Abs
         11 = Chest         12 = Back       13 = Shoulders
         14 = Calves        15 = Cardio
       ======================================================= */
    const VARIATIONS = {
        yoga: {
            label: 'Yoga Flow', emoji: '🧘', tag: 'Mobility',
            blurb: 'Slow flow, deep stretch and breath work to open up and reset.',
            duration: 45, intensity: 'Low impact',
            api: { param: 'type', value: 'stretching' },
            fallback: (ex) => ex.category === 'stretching',
            wgerCategory: 12,
            wgerFallbackId: 348
        },
        hiit: {
            label: 'HIIT Blast', emoji: '🔥', tag: 'Conditioning',
            blurb: 'Short, brutal, effective intervals that keep burning for hours.',
            duration: 30, intensity: 'High impact',
            api: { param: 'type', value: 'plyometrics' },
            fallback: (ex) => ex.category === 'plyometrics' || ex.category === 'cardio',
            wgerCategory: 9,
            wgerFallbackId: 2
        },
        strength: {
            label: 'Strength Builder', emoji: '💪', tag: 'Iron',
            blurb: 'Progressive barbell and dumbbell work to build your base.',
            duration: 50, intensity: 'Low impact',
            api: { param: 'muscle', value: 'biceps' },
            fallback: (ex) => (ex.primaryMuscles || []).includes('biceps'),
            wgerCategory: 8,
            wgerFallbackId: 91
        },
        cardio: {
            label: 'Cardio Sprint', emoji: '🏃', tag: 'Endurance',
            blurb: 'Steady-state and interval cardio to build your engine.',
            duration: 35, intensity: 'Med impact',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: 15,
            wgerFallbackId: 91
        },
        mobility: {
            label: 'Mobility & Stretch', emoji: '🤍', tag: 'Recovery',
            blurb: 'Joint-friendly mobility work to keep you moving pain-free.',
            duration: 25, intensity: 'Low impact',
            api: { param: 'type', value: 'stretching' },
            fallback: (ex) => ex.category === 'stretching',
            wgerCategory: 12,
            wgerFallbackId: 348
        },
        pilates: {
            label: 'Core Pilates', emoji: '🤸', tag: 'Core',
            blurb: 'Control, alignment and a core that actually shows up.',
            duration: 40, intensity: 'Low impact',
            api: { param: 'muscle', value: 'abdominals' },
            fallback: (ex) => (ex.primaryMuscles || []).includes('abdominals'),
            wgerCategory: 10,
            wgerFallbackId: 3
        },
        spin: {
            label: 'Spin Endurance', emoji: '🚴', tag: 'Endurance',
            blurb: 'Climb, sprint, recover — a properly loud indoor ride.',
            duration: 45, intensity: 'Med impact',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: 9,
            wgerFallbackId: 91
        },
        dance: {
            label: 'Dance Cardio', emoji: '💃', tag: 'Dance',
            blurb: 'Latin rhythms, big energy, no choreography stress required.',
            duration: 45, intensity: 'Med impact',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: 9,
            wgerFallbackId: 91
        }
    };

    const VARIATION_KEYS = Object.keys(VARIATIONS);

    /* =======================================================
       3. UTILITIES
       ======================================================= */
    const $ = (sel, root) => (root || document).querySelector(sel);
    const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function titleCase(str) {
        return String(str || '').toLowerCase().split(/\s+/).filter(Boolean)
            .map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
    }

    function truncate(str, max) {
        const s = String(str || '').replace(/\s+/g, ' ').trim();
        return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
    }

    function shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function stripHtml(html) {
        if (!html) return '';
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return (tmp.textContent || tmp.innerText || '').trim();
    }

    function todayISO() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function formatLongDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso + 'T00:00:00');
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }

    function formatShortDate(iso) {
        if (!iso) return '—';
        const d = new Date(iso + 'T00:00:00');
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function formatTime(hhmm) {
        if (!hhmm) return '—';
        const [h, m] = hhmm.split(':').map(Number);
        if (isNaN(h)) return hhmm;
        const d = new Date();
        d.setHours(h, m || 0, 0, 0);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function makeReminderId() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
        const rand = String(Math.floor(1000 + Math.random() * 9000));
        return `FP-${stamp}-${rand}`;
    }

    function levelClass(raw) {
        const v = String(raw || '').toLowerCase().trim();
        if (v.startsWith('beg') || v === 'easy' || v === 'novice') return 'beginner';
        if (v.startsWith('int') || v === 'medium' || v === 'moderate') return 'intermediate';
        if (v.startsWith('adv') || v === 'hard') return 'advanced';
        if (v.startsWith('exp') || v === 'elite') return 'expert';
        return 'beginner';
    }

    /* =======================================================
       4. NORMALISERS
       ======================================================= */
    function normalizeApiNinjas(ex) {
        return {
            name: ex.name || 'Untitled exercise',
            type: ex.type || 'strength',
            muscle: ex.muscle || 'full body',
            equipment: ex.equipment || 'bodyweight',
            difficulty: ex.difficulty || 'beginner',
            instructions: ex.instructions || '',
            image: ''
        };
    }

    function normalizeFreeDb(ex) {
        const muscles = ex.primaryMuscles || [];
        return {
            name: ex.name || 'Untitled exercise',
            type: ex.category || 'strength',
            muscle: muscles[0] || 'full body',
            equipment: ex.equipment || 'bodyweight',
            difficulty: ex.level || 'beginner',
            instructions: Array.isArray(ex.instructions) ? ex.instructions[0] : '',
            image: ''
        };
    }

    function normalizeWger(ex) {
        const images = Array.isArray(ex.images) ? ex.images : [];
        const main = images.find((i) => i.is_main) || images[0] || null;

        return {
            id: ex.id,
            name: ex.name || ex.name_clean || 'Untitled',
            category: ex.category ? ex.category.name : '',
            description: stripHtml(ex.description || ''),
            image: main ? main.image : ''
        };
    }

    /* =======================================================
       5. EXERCISE DATA LAYER
       ======================================================= */
    const cache = new Map();
    const wgerCache = new Map();
    let fallbackDbPromise = null;

    function hasUsableApiKey() {
        return Boolean(CONFIG.API_KEY) && !/YOUR_|PASTE_/i.test(CONFIG.API_KEY);
    }

    async function fetchApiNinjas(key) {
        const { param, value } = VARIATIONS[key].api;
        const url = `${CONFIG.API_BASE}?${param}=${encodeURIComponent(value)}`;

        const res = await fetch(url, { method: 'GET', headers: { 'X-Api-Key': CONFIG.API_KEY } });
        if (!res.ok) throw new Error(`API Ninjas responded ${res.status}`);

        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('API Ninjas returned an empty payload');
        return shuffle(data).map(normalizeApiNinjas);
    }

    function loadFallbackDb() {
        if (!fallbackDbPromise) {
            fallbackDbPromise = fetch(CONFIG.FALLBACK_URL)
                .then((r) => { if (!r.ok) throw new Error(`Fallback dataset ${r.status}`); return r.json(); })
                .catch((err) => { fallbackDbPromise = null; throw err; });
        }
        return fallbackDbPromise;
    }

    async function fetchFreeDb(key) {
        const db = await loadFallbackDb();
        if (!Array.isArray(db)) throw new Error('Fallback dataset malformed');

        const matches = db.filter(VARIATIONS[key].fallback);
        if (matches.length === 0) throw new Error(`No fallback exercises for "${key}"`);
        return shuffle(matches).slice(0, 14).map(normalizeFreeDb);
    }

    async function getExercises(key, options) {
        const opts = options || {};
        const limit = opts.limit || CONFIG.MODAL_LIMIT;
        const safeKey = VARIATIONS[key] ? key : 'strength';

        const hit = cache.get(safeKey);
        if (hit && Date.now() - hit.at < CONFIG.CACHE_TTL) {
            return { items: hit.items.slice(0, limit), source: hit.source };
        }

        let items;
        let source;

        try {
            if (!hasUsableApiKey()) throw new Error('No API Ninjas key configured');
            items = await fetchApiNinjas(safeKey);
            source = 'api-ninjas';
        } catch (primaryError) {
            console.warn(`[FitPulse] Primary API unavailable for "${safeKey}" — ${primaryError.message}. Falling back.`);
            items = await fetchFreeDb(safeKey);
            source = 'free-exercise-db';
        }

        cache.set(safeKey, { at: Date.now(), items, source });
        return { items: items.slice(0, limit), source };
    }

    function sourceLabel(source) {
        return source === 'api-ninjas' ? 'API Ninjas Exercises API' : 'free-exercise-db (offline fallback)';
    }

    /* =======================================================
       6. WGER IMAGE LAYER
       ======================================================= */

    async function fetchWgerByCategory(categoryId) {
        const key = `cat:${categoryId}`;
        const hit = wgerCache.get(key);
        if (hit && Date.now() - hit.at < CONFIG.WGER_CACHE_TTL) {
            return hit.items;
        }

        try {
            const url = `${CONFIG.WGER_BASE}/exerciseinfo/?category=${categoryId}&limit=${CONFIG.WGER_LIMIT}&language=2`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`wger responded ${res.status}`);

            const data = await res.json();
            const items = (data.results || [])
                .map(normalizeWger)
                .filter((w) => w.image);

            wgerCache.set(key, { at: Date.now(), items });
            return items;
        } catch (err) {
            console.warn(`[FitPulse] wger fetch failed for category ${categoryId}:`, err);
            return [];
        }
    }

    async function fetchWgerById(id) {
        const key = `id:${id}`;
        const hit = wgerCache.get(key);
        if (hit && Date.now() - hit.at < CONFIG.WGER_CACHE_TTL) {
            return hit.items[0] || null;
        }

        try {
            const url = `${CONFIG.WGER_BASE}/exerciseinfo/${id}/`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`wger responded ${res.status}`);

            const data = await res.json();
            const item = normalizeWger(data);
            wgerCache.set(key, { at: Date.now(), items: [item] });
            return item;
        } catch (err) {
            console.warn(`[FitPulse] wger fetch failed for id ${id}:`, err);
            return null;
        }
    }

    function nameSimilarity(a, b) {
        const A = String(a || '').toLowerCase().trim();
        const B = String(b || '').toLowerCase().trim();
        if (!A || !B) return 0;
        if (A === B) return 1;

        const tokensA = new Set(A.split(/\s+/).filter((w) => w.length > 2));
        const tokensB = new Set(B.split(/\s+/).filter((w) => w.length > 2));
        let shared = 0;
        tokensA.forEach((t) => { if (tokensB.has(t)) shared++; });

        const denom = Math.max(tokensA.size, tokensB.size) || 1;
        let score = shared / denom;

        if (A.includes(B) || B.includes(A)) score += 0.3;

        return Math.min(score, 1);
    }

    function attachWgerImages(items, wgerItems) {
        if (!items || items.length === 0) return items;
        if (!wgerItems || wgerItems.length === 0) return items;

        return items.map((ex) => {
            let best = null;
            let bestScore = 0;

            wgerItems.forEach((w) => {
                const s = nameSimilarity(ex.name, w.name);
                if (s > bestScore) {
                    bestScore = s;
                    best = w;
                }
            });

            if (best && bestScore >= 0.25 && best.image) {
                return Object.assign({}, ex, { image: best.image });
            }

            const random = wgerItems[Math.floor(Math.random() * wgerItems.length)];
            return Object.assign({}, ex, { image: random && random.image ? random.image : '' });
        });
    }

    async function getExercisesWithImages(key, options) {
        const opts = options || {};
        const limit = opts.limit || CONFIG.MODAL_LIMIT;
        const variation = VARIATIONS[key] || VARIATIONS.strength;

        const [exerciseResult, wgerItems] = await Promise.all([
            getExercises(key, { limit }),
            fetchWgerByCategory(variation.wgerCategory)
        ]);

        return {
            items: attachWgerImages(exerciseResult.items, wgerItems),
            source: exerciseResult.source,
            wgerCount: wgerItems.length
        };
    }

    async function getVariationHeroImage(key) {
        const variation = VARIATIONS[key];
        if (!variation) return '';

        const items = await fetchWgerByCategory(variation.wgerCategory);
        if (items.length > 0) {
            const pick = items[Math.floor(Math.random() * items.length)];
            if (pick.image) return pick.image;
        }

        if (variation.wgerFallbackId) {
            const single = await fetchWgerById(variation.wgerFallbackId);
            if (single && single.image) return single.image;
        }

        return '';
    }

    /* =======================================================
       7. RENDERERS
       ======================================================= */
    function imageMarkup(url, alt, cls) {
        if (!url) {
            return `<div class="${cls} ex-card__media--placeholder" aria-hidden="true">💪</div>`;
        }
        return `<div class="${cls}"><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.parentNode.classList.add('ex-card__media--placeholder');this.parentNode.innerHTML='💪';" /></div>`;
    }

    function exerciseCard(ex) {
        const cls = levelClass(ex.difficulty);
        const media = imageMarkup(ex.image, ex.name, 'ex-card__media');

        return `
      <article class="ex-card">
        ${media}
        <div class="ex-card__top">
          <h4 class="ex-card__name">${esc(titleCase(ex.name))}</h4>
          <span class="badge badge--${cls}">${esc(titleCase(ex.difficulty))}</span>
        </div>
        <div class="ex-card__meta">
          <div><span class="label">Type</span><span class="value">${esc(titleCase(ex.type))}</span></div>
          <div><span class="label">Muscle</span><span class="value">${esc(titleCase(ex.muscle))}</span></div>
          <div><span class="label">Equipment</span><span class="value">${esc(titleCase(ex.equipment))}</span></div>
          <div><span class="label">Level</span><span class="value">${esc(titleCase(ex.difficulty))}</span></div>
        </div>
        ${ex.instructions ? `<p class="ex-card__instruction">${esc(truncate(ex.instructions, 150))}</p>` : ''}
      </article>`;
    }

    function exerciseList(items) {
        return `<div class="ex-list">${items.map(exerciseCard).join('')}</div>`;
    }

    function loadingMarkup(message) {
        return `<div class="loading-block"><span class="spinner spinner--lg" aria-hidden="true"></span><p>${esc(message || 'Loading…')}</p></div>`;
    }

    function errorMarkup(message) {
        return `<div class="empty-state"><strong>Couldn't load exercises</strong><p>${esc(message || 'Please check your connection and try again.')}</p></div>`;
    }

    /* =======================================================
       8. TOAST
       ======================================================= */
    let toastTimer = null;
    function toast(message, type) {
        const el = $('#toast');
        if (!el) return;
        el.textContent = message;
        el.className = 'toast' + (type ? ` toast--${type}` : '');
        el.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.hidden = true; }, 4200);
    }

    /* =======================================================
       9. MODAL CONTROLLER
       ======================================================= */
    const modal = $('#modal');
    const modalTitle = $('#modal-title');
    const modalEyebrow = $('#modal-eyebrow');
    const modalBody = $('#modal-body');
    const modalSource = $('#modal-source');
    const modalBook = $('#modal-book');

    let lastFocused = null;
    let modalToken = 0;

    function openModal(options) {
        if (!modal) return;
        lastFocused = document.activeElement;
        modalTitle.textContent = options.title || 'Variation';
        modalEyebrow.textContent = options.eyebrow || 'Sample exercises';
        modalBody.innerHTML = options.body || '';
        modalSource.textContent = options.source || '';
        if (modalBook) modalBook.href = options.href || 'schedule.html';
        modal.hidden = false;
        document.body.classList.add('modal-open');
        const closeBtn = $('.icon-btn', modal);
        if (closeBtn) closeBtn.focus();
    }

    function closeModal() {
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        document.body.classList.remove('modal-open');
        modalToken++;
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    if (modal) {
        $$('[data-close-modal]', modal).forEach((el) => el.addEventListener('click', closeModal));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    /* =======================================================
       10. VARIATION GRID (index page)
       ======================================================= */
    function variationCardMarkup(key, heroImage) {
        const v = VARIATIONS[key];
        const media = heroImage
            ? `<div class="variation-card__media"><img src="${esc(heroImage)}" alt="${esc(v.label)}" loading="lazy" /></div>`
            : `<div class="variation-card__media is-loading" aria-hidden="true"></div>`;

        return `
      <article class="variation-card" data-variation="${key}">
        ${media}
        <div class="variation-card__head">
          <span class="variation-card__emoji" aria-hidden="true">${v.emoji}</span>
          <span class="pill">${esc(v.tag)}</span>
        </div>
        <h3>${esc(v.label)}</h3>
        <p>${esc(v.blurb)}</p>
        <ul class="variation-card__meta">
          <li><strong>${v.duration}</strong> min</li>
          <li>${esc(v.intensity)}</li>
          <li>All levels</li>
        </ul>
        <div class="variation-card__actions">
          <button class="btn btn--ghost" data-action="view-exercises" data-variation="${key}">Preview</button>
          <a class="btn btn--primary" href="schedule.html?v=${encodeURIComponent(key)}">Set Reminder</a>
        </div>
      </article>`;
    }

    async function renderVariationGrid() {
        const grid = $('#variation-grid');
        if (!grid) return;

        grid.innerHTML = VARIATION_KEYS.map((k) => variationCardMarkup(k, '')).join('');

        VARIATION_KEYS.forEach(async (key) => {
            try {
                const img = await getVariationHeroImage(key);
                if (!img) return;

                const card = grid.querySelector(`[data-variation="${key}"]`);
                if (!card) return;

                const media = card.querySelector('.variation-card__media');
                if (media) {
                    media.classList.remove('is-loading');
                    media.innerHTML = `<img src="${esc(img)}" alt="${esc(VARIATIONS[key].label)}" loading="lazy" />`;
                }
            } catch (err) {
                console.warn(`[FitPulse] Hero image failed for "${key}":`, err);
            }
        });
    }

    /* =======================================================
       11. PREVIEW MODAL (index page)
       ======================================================= */
    async function openVariationModal(key) {
        const v = VARIATIONS[key];
        if (!v) return;
        const token = ++modalToken;

        openModal({
            eyebrow: 'Sample exercises',
            title: `${v.label} — what you'll do`,
            body: loadingMarkup(`Fetching ${v.label} exercises…`),
            source: '',
            href: `schedule.html?v=${encodeURIComponent(key)}`
        });

        try {
            const { items, source, wgerCount } = await getExercisesWithImages(key, {
                limit: CONFIG.MODAL_LIMIT
            });
            if (token !== modalToken) return;

            modalBody.innerHTML = exerciseList(items);
            modalSource.textContent = `${items.length} exercises · ${sourceLabel(source)} · ${wgerCount} photos from wger.de`;
        } catch (err) {
            if (token !== modalToken) return;
            console.error('[FitPulse] Modal fetch failed:', err);
            modalBody.innerHTML = errorMarkup('Both the live API and the offline library are unavailable right now.');
            modalSource.textContent = 'No data source reachable';
        }
    }

    function initVariationActions() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="view-exercises"]');
            if (btn) openVariationModal(btn.dataset.variation);
        });
    }

    /* =======================================================
       12. REMINDER STORAGE
       ======================================================= */
    const STORE_KEY = 'fitpulse:reminders';

    function loadReminders() {
        try {
            const raw = localStorage.getItem(STORE_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch (_) { return []; }
    }

    function saveReminders(list) {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
        catch (err) { console.warn('[FitPulse] Could not save reminders:', err); }
    }

    function addReminder(reminder) {
        const list = loadReminders();
        list.push(reminder);
        list.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        saveReminders(list);
        return list;
    }

    function removeReminder(id) {
        const list = loadReminders().filter((r) => r.id !== id);
        saveReminders(list);
        return list;
    }

    /* =======================================================
       13. EMAIL LAYER
       ======================================================= */
    function emailjsReady() {
        if (typeof window.emailjs === 'undefined') return false;
        if (typeof window.emailjs.send !== 'function') return false;
        const { serviceId, templateId } = CONFIG.EMAILJS;
        if (!serviceId  || /YOUR_/i.test(serviceId))  return false;
        if (!templateId || /YOUR_/i.test(templateId)) return false;
        return true;
    }

    function schedulerReady() {
        return Boolean(CONFIG.SCHEDULER_URL) && !/YOUR_|PASTE_/i.test(CONFIG.SCHEDULER_URL);
    }

    function buildWorkoutText(exercises) {
        if (!exercises || exercises.length === 0) {
            return 'Your coach will walk you through the full session on the day.';
        }
        return exercises.map((ex, i) =>
            `${i + 1}. ${ex.name}\n   • Focus: ${ex.muscle} · Type: ${ex.type}\n   • Equipment: ${ex.equipment} · Level: ${ex.difficulty}`
        ).join('\n\n');
    }

    function buildWorkoutHtml(exercises) {
        if (!exercises || exercises.length === 0) {
            return '<p style="padding:16px 18px;font-size:14px;color:#555560;">Your coach will walk you through the full session on the day.</p>';
        }
        const rows = exercises.map((ex) => {
            const imgCell = ex.image
                ? `<td style="padding:10px 12px;border-bottom:1px solid #eaeaea;width:72px;vertical-align:middle;"><img src="${esc(ex.image)}" alt="${esc(ex.name)}" width="64" height="48" style="display:block;width:64px;height:48px;object-fit:cover;border-radius:6px;" /></td>`
                : `<td style="padding:10px 12px;border-bottom:1px solid #eaeaea;width:72px;vertical-align:middle;"></td>`;

            return `
        <tr>
          ${imgCell}
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;font-weight:600;color:#111;">${esc(ex.name)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;color:#555;">${esc(ex.muscle)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;color:#555;">${esc(ex.equipment)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #eaeaea;color:#555;">${esc(ex.difficulty)}</td>
        </tr>`;
        }).join('');

        return `
      <table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th align="left" style="padding:10px 12px;border-bottom:2px solid #ddd;width:72px;"></th>
            <th align="left" style="padding:10px 12px;border-bottom:2px solid #ddd;">Exercise</th>
            <th align="left" style="padding:10px 12px;border-bottom:2px solid #ddd;">Muscle</th>
            <th align="left" style="padding:10px 12px;border-bottom:2px solid #ddd;">Equipment</th>
            <th align="left" style="padding:10px 12px;border-bottom:2px solid #ddd;">Level</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
    }

    function buildEmailParams(data, opts) {
        const o = opts || {};
        const isConfirmation = o.mode === 'confirmation';

        const subject = isConfirmation
            ? `Reminder set — ${data.variationLabel} on ${formatShortDate(data.date)}`
            : `⏰ Time to train — ${data.variationLabel}`;

        return {
            to_name:  data.name,
            to_email: data.email,
            reply_to: CONFIG.SENDER.email,
            subject,
            heading: isConfirmation ? 'Your reminder is set ✅' : 'Your workout is waiting 💪',
            subheading: isConfirmation
                ? `We'll email you again on ${formatLongDate(data.date)} at ${formatTime(data.time)}.`
                : `It's time for your ${data.variationLabel} session.`,

            reminder_ref:    data.id,
            variation:       data.variationLabel,
            variation_emoji: data.variationEmoji,
            class_date:      formatLongDate(data.date),
            short_date:      formatShortDate(data.date),
            class_time:      formatTime(data.time),
            repeat_label:    data.repeatLabel,
            fitness_level:   data.level,
            duration_min:    String(data.duration),
            notes:           data.notes || 'None',

            workout_list:   buildWorkoutText(data.exercises),
            workout_html:   buildWorkoutHtml(data.exercises),
            exercise_count: String((data.exercises || []).length),

            sender_name:    CONFIG.SENDER.name,
            sender_email:   CONFIG.SENDER.email,
            sender_tagline: CONFIG.SENDER.tagline,
            arrive_note:    'Hydrate. Warm up. Show up.',

            sent_at: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        };
    }

    async function sendEmail(data, opts) {
        if (!emailjsReady()) {
            console.info('[FitPulse] Demo mode — email payload:', buildEmailParams(data, opts));
            await sleep(1200);
            return { demo: true };
        }

        const params = buildEmailParams(data, opts);
        const res = await window.emailjs.send(
            CONFIG.EMAILJS.serviceId,
            CONFIG.EMAILJS.templateId,
            params
        );

        if (!res || (res.status && res.status >= 400)) {
            throw new Error((res && res.text) || 'Email service rejected the request.');
        }
        return res;
    }

    async function scheduleOnServer(data) {
        if (!schedulerReady()) return { skipped: true };
        try {
            const res = await fetch(CONFIG.SCHEDULER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    id: data.id, name: data.name, email: data.email,
                    variation: data.variationLabel, variationKey: data.variationKey,
                    date: data.date, time: data.time,
                    repeat: data.repeat, repeatLabel: data.repeatLabel,
                    level: data.level, duration: data.duration, notes: data.notes,
                    exercises: data.exercises,
                    timezoneOffsetMinutes: new Date().getTimezoneOffset()
                }),
                redirect: 'follow'
            });
            const text = await res.text();
            try { return JSON.parse(text); }
            catch (_) { return { raw: text }; }
        } catch (err) {
            console.warn('[FitPulse] Server scheduler failed:', err);
            return { error: String(err.message || err) };
        }
    }

    /* =======================================================
       14. BROWSER NOTIFICATIONS
       ======================================================= */
    const notificationTimers = new Map();

    async function requestNotificationPermission() {
        if (!('Notification' in window)) return 'unsupported';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
        try { return await Notification.requestPermission(); }
        catch (_) { return 'denied'; }
    }

    function scheduleBrowserNotification(reminder) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        if (notificationTimers.has(reminder.id)) {
            clearTimeout(notificationTimers.get(reminder.id));
            notificationTimers.delete(reminder.id);
        }

        const when = new Date(reminder.datetime).getTime();
        const delay = when - Date.now();
        if (delay <= 0 || delay > 2147483647) return;

        const timer = setTimeout(() => {
            try {
                new Notification(`Time for ${reminder.variationLabel}`, {
                    body: `${reminder.duration} min · ${reminder.level}. Open FitPulse for your workout.`,
                    tag: reminder.id
                });
            } catch (_) {}
            notificationTimers.delete(reminder.id);
        }, delay);

        notificationTimers.set(reminder.id, timer);
    }

    function rescheduleAllNotifications() {
        notificationTimers.forEach((t) => clearTimeout(t));
        notificationTimers.clear();
        loadReminders().forEach(scheduleBrowserNotification);
    }

    /* =======================================================
       15. REMINDER DASHBOARD
       ======================================================= */
    function countdownLabel(datetimeISO) {
        const target = new Date(datetimeISO).getTime();
        const diff = target - Date.now();
        if (diff <= 0) return 'Past';
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `in ${days}d ${hours % 24}h`;
        if (hours > 0) return `in ${hours}h ${minutes % 60}m`;
        return `in ${minutes}m`;
    }

    function reminderCardMarkup(r) {
        const v = VARIATIONS[r.variationKey] || { emoji: '🏋️' };
        const isPast = new Date(r.datetime).getTime() < Date.now();

        return `
      <article class="reminder-card ${isPast ? 'is-past' : ''}" data-id="${esc(r.id)}">
        <div class="reminder-card__title">
          <span class="reminder-card__emoji" aria-hidden="true">${v.emoji}</span>
          ${esc(r.variationLabel)}
        </div>
        <div class="reminder-card__when">
          ${esc(formatTime(r.time))}
          <small>${esc(formatShortDate(r.date))} · ${esc(r.repeatLabel)}</small>
        </div>
        <ul class="reminder-card__meta">
          <li>${esc(r.level)}</li>
          <li>${r.duration} min</li>
          <li>Ref ${esc(r.id)}</li>
        </ul>
        ${!isPast ? `<span class="reminder-card__countdown">${esc(countdownLabel(r.datetime))}</span>` : ''}
        <div class="reminder-card__actions">
          <button class="btn btn--ghost" data-action="remove-reminder" data-id="${esc(r.id)}">Remove</button>
        </div>
      </article>`;
    }

    function renderReminders() {
        const list = $('#reminders-list');
        if (!list) return;
        const reminders = loadReminders().sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        if (reminders.length === 0) {
            list.innerHTML = `<div class="empty-state"><strong>No reminders yet</strong><p>Once you schedule one, it will appear here.</p></div>`;
            return;
        }
        list.innerHTML = reminders.map(reminderCardMarkup).join('');
    }

    function initReminderDashboard() {
        const list = $('#reminders-list');
        if (!list) return;

        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove-reminder"]');
            if (!btn) return;
            const id = btn.dataset.id;
            const timer = notificationTimers.get(id);
            if (timer) { clearTimeout(timer); notificationTimers.delete(id); }
            removeReminder(id);
            renderReminders();
            toast('Reminder removed.', 'success');
        });

        renderReminders();
        rescheduleAllNotifications();
        setInterval(renderReminders, 60000);
    }

    /* =======================================================
       16. SCHEDULE FORM
       ======================================================= */
    let previewExercises = [];

    function populateVariationSelect() {
        const select = $('#variation');
        if (!select) return;
        select.innerHTML = VARIATION_KEYS
            .map((k) => `<option value="${k}">${esc(VARIATIONS[k].label)}</option>`)
            .join('');
    }

    function readForm(form) {
        const key = form.variation.value;
        const v = VARIATIONS[key] || VARIATIONS.strength;
        const date = form.date.value;
        const time = form.time.value;
        const dt = new Date(`${date}T${(time || '07:00')}:00`);

        return {
            id: makeReminderId(),
            name:  (form.fullName.value || '').trim(),
            email: (form.email.value || '').trim(),
            variationKey: key,
            variationLabel: v.label,
            variationEmoji: v.emoji,
            duration: v.duration,
            date, time,
            datetime: isNaN(dt) ? '' : dt.toISOString(),
            repeat: form.repeat.value,
            repeatLabel: form.repeat.value,
            level: form.level.value,
            notes: (form.notes.value || '').trim()
        };
    }

    function markInvalid(field, message) {
        const wrapper = field.closest('.field');
        if (!wrapper) return;
        wrapper.classList.add('is-invalid');
        const err = $('.field__error', wrapper);
        if (err) err.textContent = message;
    }

    function clearInvalid(form) {
        $$('.field.is-invalid', form).forEach((f) => f.classList.remove('is-invalid'));
    }

    function validate(data) {
        let ok = true;
        const form = $('#reminder-form');

        if (data.name.length < 2) { markInvalid(form.fullName, 'Please enter your name.'); ok = false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) { markInvalid(form.email, 'Please enter a valid email.'); ok = false; }
        if (!VARIATIONS[data.variationKey]) { markInvalid(form.variation, 'Please choose a variation.'); ok = false; }

        if (!data.date) { markInvalid(form.date, 'Please choose a date.'); ok = false; }
        else {
            const dt = new Date(`${data.date}T${data.time || '00:00'}:00`);
            if (isNaN(dt)) { markInvalid(form.date, 'Invalid date.'); ok = false; }
            else if (dt.getTime() < Date.now() - 60000) { markInvalid(form.date, 'Pick a time in the future.'); ok = false; }
        }

        if (!data.time) { markInvalid(form.time, 'Please choose a time.'); ok = false; }
        if (!data.repeat) { markInvalid(form.repeat, 'Please choose a repeat option.'); ok = false; }
        if (!data.level) { markInvalid(form.level, 'Please select your fitness level.'); ok = false; }
        return ok;
    }

    function initPreview() {
        const body = $('#preview-body');
        const select = $('#variation');
        if (!body || !select) return;

        let token = 0;

        async function refresh() {
            const key = select.value;
            const v = VARIATIONS[key];
            if (!v) { body.innerHTML = errorMarkup('Select a variation to preview.'); previewExercises = []; return; }

            const myToken = ++token;
            body.innerHTML = loadingMarkup(`Loading ${v.label} exercises…`);

            const title = $('#preview-title');
            if (title) title.textContent = `${v.label} — preview`;

            try {
                const { items, source, wgerCount } = await getExercisesWithImages(key, {
                    limit: CONFIG.PREVIEW_LIMIT
                });
                if (myToken !== token) return;
                previewExercises = items;
                body.innerHTML = exerciseList(items);

                const foot = $('#preview-source');
                if (foot) {
                    foot.innerHTML = `${items.length} exercises · <strong>${esc(sourceLabel(source))}</strong> · ${wgerCount} photos from wger.de`;
                }
            } catch (err) {
                if (myToken !== token) return;
                console.error('[FitPulse] Preview failed:', err);
                previewExercises = [];
                body.innerHTML = errorMarkup('Preview unavailable — you can still set a reminder.');
            }
        }

        select.addEventListener('change', refresh);
        refresh();
    }

    function setSubmitting(isBusy) {
        const btn = $('#submit-btn');
        if (!btn) return;
        if (isBusy) {
            btn.dataset.original = btn.innerHTML;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Scheduling your reminder…';
        } else {
            btn.disabled = false;
            btn.removeAttribute('aria-busy');
            if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
        }
    }

    function showStatus(type, html) {
        const el = $('#form-status');
        if (!el) return;
        el.className = `alert alert--${type}`;
        el.innerHTML = `<span class="alert__icon" aria-hidden="true">${type === 'success' ? '✓' : '!'}</span><div class="alert__body">${html}</div>`;
        el.hidden = false;
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function clearStatus() {
        const el = $('#form-status');
        if (!el) return;
        el.hidden = true;
        el.innerHTML = '';
    }

    function initScheduleForm() {
        const form = $('#reminder-form');
        if (!form) return;

        const params = new URLSearchParams(window.location.search);
        const preKey = (params.get('v') || '').toLowerCase();
        if (VARIATIONS[preKey]) form.variation.value = preKey;

        const dateInput = form.date;
        if (dateInput) dateInput.min = todayISO();

        clearInvalid(form);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearStatus();
            clearInvalid(form);

            const data = readForm(form);

            if (!validate