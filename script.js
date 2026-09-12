(function () {
    'use strict';

    const CONFIG = {
        API_KEY: 'YOUR_API_NINJAS_KEY',
        API_BASE: 'https://api.api-ninjas.com/v1/exercises',
        FALLBACK_URL:
            'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',

        WGER_BASE: 'https://wger.de/api/v2',
        WGER_CACHE_TTL: 1000 * 60 * 60,
        WGER_LIMIT: 40,

        CACHE_TTL: 1000 * 60 * 30,
        MODAL_LIMIT: 5,
        PREVIEW_LIMIT: 4,

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

    const VARIATIONS = {
        yoga: {
            label: 'Yoga Flow', emoji: '🧘', tag: 'Mobility',
            blurb: 'Slow flow, deep stretch and breath work to open up and reset.',
            duration: 45, intensity: 'Low impact',
            api: { param: 'type', value: 'stretching' },
            fallback: (ex) => ex.category === 'stretching',
            wgerCategory: 12, wgerFallbackId: 348
        },
        hiit: {
            label: 'HIIT Blast', emoji: '🔥', tag: 'Conditioning',
            blurb: 'Short, brutal, effective intervals that keep burning for hours.',
            duration: 30, intensity: 'High impact',
            api: { param: 'type', value: 'plyometrics' },
            fallback: (ex) => ex.category === 'plyometrics' || ex.category === 'cardio',
            wgerCategory: 9, wgerFallbackId: 2
        },
        strength: {
            label: 'Strength Builder', emoji: '💪', tag: 'Iron',
            blurb: 'Progressive barbell and dumbbell work to build your base.',
            duration: 50, intensity: 'Low impact',
            api: { param: 'muscle', value: 'biceps' },
            fallback: (ex) => (ex.primaryMuscles || []).includes('biceps'),
            wgerCategory: 8, wgerFallbackId: 91
        },
        cardio: {
            label: 'Cardio Sprint', emoji: '🏃', tag: 'Endurance',
            blurb: 'Steady-state and interval cardio to build your engine.',
            duration: 35, intensity: 'Med impact',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: 15, wgerFallbackId: 91
        },
        mobility: {
            label: 'Mobility & Stretch', emoji: '🤍', tag: 'Recovery',
            blurb: 'Joint-friendly mobility work to keep you moving pain-free.',
            duration: 25, intensity: 'Low impact',
            api: { param: 'type', value: 'stretching' },
            fallback: (ex) => ex.category === 'stretching',
            wgerCategory: 12, wgerFallbackId: 348
        },
        pilates: {
            label: 'Core Pilates', emoji: '🤸', tag: 'Core',
            blurb: 'Control, alignment and a core that actually shows up.',
            duration: 40, intensity: 'Low impact',
            api: { param: 'muscle', value: 'abdominals' },
            fallback: (ex) => (ex.primaryMuscles || []).includes('abdominals'),
            wgerCategory: 10, wgerFallbackId: 3
        },
        spin: {
            label: 'Spin Endurance', emoji: '🚴', tag: 'Endurance',
            blurb: 'Climb, sprint, recover — a properly loud indoor ride.',
            duration: 45, intensity: 'Med impact',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: 9, wgerFallbackId: 91
        },
        dance: {
            label: 'Dance Cardio', emoji: '💃', tag: 'Dance',
            blurb: 'Latin rhythms, big energy, no choreography stress required.',
            duration: 45, intensity: 'Med impact',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: 9, wgerFallbackId: 91
        }
    };

    const VARIATION_KEYS = Object.keys(VARIATIONS);

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

    const CUSTOM_VARIATIONS_KEY = 'fitpulse:custom-variations';

    function loadCustomVariations() {
        try {
            const raw = localStorage.getItem(CUSTOM_VARIATIONS_KEY);
            if (!raw) return {};
            const obj = JSON.parse(raw);
            return obj && typeof obj === 'object' ? obj : {};
        } catch (_) { return {}; }
    }

    function saveCustomVariations(obj) {
        try { localStorage.setItem(CUSTOM_VARIATIONS_KEY, JSON.stringify(obj)); }
        catch (err) { console.warn('[FitPulse] Could not save custom variations:', err); }
    }

    function getAllVariations() {
        return Object.assign({}, VARIATIONS, loadCustomVariations());
    }

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
        const translations = Array.isArray(ex.translations) ? ex.translations : [];
        const english = translations.find((item) => Number(item.language) === 2) || translations[0] || {};
        const muscles = Array.isArray(ex.muscles) ? ex.muscles : [];
        const equipment = Array.isArray(ex.equipment) ? ex.equipment : [];
        return {
            id: ex.id,
            name: english.name || ex.name || ex.name_clean || 'Untitled',
            type: ex.category ? ex.category.name : 'Workout',
            muscle: muscles[0] ? muscles[0].name : (ex.category ? ex.category.name : 'Full body'),
            equipment: equipment[0] ? equipment[0].name : 'Bodyweight',
            difficulty: 'All levels',
            instructions: stripHtml(english.description || ex.description || ''),
            image: main ? (main.thumbnails && main.thumbnails.medium) || main.image : ''
        };
    }

    const cache = new Map();
    const wgerCache = new Map();
    let fallbackDbPromise = null;

    function hasUsableApiKey() {
        return Boolean(CONFIG.API_KEY) && !/YOUR_|PASTE_/i.test(CONFIG.API_KEY);
    }

    async function fetchApiNinjas(key) {
        const all = getAllVariations();
        const { param, value } = all[key].api;
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

        const all = getAllVariations();
        const matches = db.filter(all[key].fallback);
        if (matches.length === 0) throw new Error(`No fallback exercises for "${key}"`);
        return shuffle(matches).slice(0, 14).map(normalizeFreeDb);
    }

    async function getExercises(key, options) {
        const opts = options || {};
        const limit = opts.limit || CONFIG.MODAL_LIMIT;
        const all = getAllVariations();
        const safeKey = all[key] ? key : 'strength';

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
        if (source === 'wger') return 'Wger exercise library';
        return source === 'api-ninjas' ? 'API Ninjas Exercises API' : 'free-exercise-db (offline fallback)';
    }

    async function fetchWgerByCategory(categoryId) {
        const key = `cat:${categoryId}`;
        const hit = wgerCache.get(key);
        if (hit && Date.now() - hit.at < CONFIG.WGER_CACHE_TTL) return hit.items;

        try {
            const url = `${CONFIG.WGER_BASE}/exerciseinfo/?category=${categoryId}&limit=${CONFIG.WGER_LIMIT}&language=2`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`wger responded ${res.status}`);
            const data = await res.json();
            const items = (data.results || []).map(normalizeWger).filter((w) => w.image);
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
        if (hit && Date.now() - hit.at < CONFIG.WGER_CACHE_TTL) return hit.items[0] || null;

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

    async function searchWgerByName(name) {
        if (!name) return null;

        const clean = String(name).replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
        if (!clean) return null;

        const cacheKey = `search:${clean.toLowerCase()}`;
        const hit = wgerCache.get(cacheKey);
        if (hit) return hit.item;

        const queries = [clean];
        const words = clean.split(/\s+/).filter((w) => w.length > 3);
        if (words.length > 1 && words[0].toLowerCase() !== clean.toLowerCase()) {
            queries.push(words[0]);
        }

        for (const q of queries) {
            try {
                const url = `${CONFIG.WGER_BASE}/exercise/search/?term=${encodeURIComponent(q)}&language=english&format=json`;
                const res = await fetch(url);
                if (!res.ok) continue;

                const data = await res.json();
                const suggestions = data.suggestions || [];
                if (suggestions.length === 0) continue;

                for (const s of suggestions.slice(0, 6)) {
                    const direct = (s.data && (s.data.image || s.data.image_thumbnail)) || '';
                    if (direct) {
                        const item = {
                            id: s.data ? s.data.id : null,
                            name: s.value || (s.data ? s.data.name : q),
                            image: direct
                        };
                        wgerCache.set(cacheKey, { at: Date.now(), item });
                        return item;
                    }
                }

                for (const s of suggestions.slice(0, 3)) {
                    if (s.data && s.data.id) {
                        const full = await fetchWgerById(s.data.id);
                        if (full && full.image) {
                            wgerCache.set(cacheKey, { at: Date.now(), item: full });
                            return full;
                        }
                    }
                }
            } catch (err) {
                console.warn('[FitPulse] wger search failed for "%s":', q, err);
            }
        }

        wgerCache.set(cacheKey, { at: Date.now(), item: null });
        return null;
    }

    async function getExercisesWithImages(key, options) {
        const opts = options || {};
        const limit = opts.limit || CONFIG.MODAL_LIMIT;
        const variations = getAllVariations();
        const variation = variations[key] || variations.strength;

        if (variation.wgerCategory) {
            const wgerItems = await fetchWgerByCategory(variation.wgerCategory);
            if (wgerItems.length) {
                return {
                    items: shuffle(wgerItems).slice(0, limit),
                    source: 'wger',
                    wgerCount: Math.min(wgerItems.length, limit)
                };
            }
        }

        const exerciseResult = await getExercises(key, { limit });

        const searches = await Promise.all(
            exerciseResult.items.map((ex) => searchWgerByName(ex.name))
        );

        const items = exerciseResult.items.map((ex, i) => {
            const m = searches[i];
            return Object.assign({}, ex, { image: m && m.image ? m.image : '' });
        });

        const withImages = items.filter((x) => x.image).length;
        return { items, source: exerciseResult.source, wgerCount: withImages };
    }

    async function getVariationHeroImage(key) {
        const all = getAllVariations();
        const variation = all[key];
        if (!variation) return '';

        if (variation.wgerCategory) {
            const items = await fetchWgerByCategory(variation.wgerCategory);
            if (items.length > 0) {
                const pick = items[Math.floor(Math.random() * items.length)];
                if (pick.image) return pick.image;
            }
        }
        if (variation.wgerFallbackId) {
            const single = await fetchWgerById(variation.wgerFallbackId);
            if (single && single.image) return single.image;
        }
        return '';
    }

    function imageMarkup(url, alt, cls) {
        if (!url) {
            return `<div class="${cls} ex-card__media--placeholder" aria-hidden="true"></div>`;
        }
        return `<div class="${cls}"><img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" onerror="this.parentNode.classList.add('ex-card__media--placeholder');this.parentNode.innerHTML='';" /></div>`;
    }

    function exerciseCard(ex, clickable) {
        const cls = levelClass(ex.difficulty);
        const media = imageMarkup(ex.image, ex.name, 'ex-card__media');
        const clickAttr = clickable ? ' data-pickable="true" role="button" tabindex="0"' : '';
        const hint = clickable
            ? `<span class="ex-card__pick-hint" aria-hidden="true">Tap to choose →</span>`
            : '';

        return `
      <article class="ex-card${clickable ? ' ex-card--pickable' : ''}"${clickAttr}>
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
        ${hint}
      </article>`;
    }

    function exerciseList(items, clickable) {
        return `<div class="ex-list">${items.map((it) => exerciseCard(it, clickable)).join('')}</div>`;
    }

    function loadingMarkup(message) {
        return `<div class="loading-block"><span class="spinner spinner--lg" aria-hidden="true"></span><p>${esc(message || 'Loading…')}</p></div>`;
    }

    function errorMarkup(message) {
        return `<div class="empty-state"><strong>Couldn't load exercises</strong><p>${esc(message || 'Please check your connection and try again.')}</p></div>`;
    }

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

    const modal = $('#modal');
    const modalTitle = $('#modal-title');
    const modalEyebrow = $('#modal-eyebrow');
    const modalBody = $('#modal-body');
    const modalSource = $('#modal-source');
    const modalBook = $('#modal-book');

    let lastFocused = null;
    let modalToken = 0;
    let modalPickKey = null;

    function openModal(options) {
        if (!modal) return;
        lastFocused = document.activeElement;
        modalTitle.textContent = options.title || 'Variation';
        modalEyebrow.textContent = options.eyebrow || 'Sample exercises';
        modalBody.innerHTML = options.body || '';
        modalSource.textContent = options.source || '';
        if (modalBook) modalBook.href = options.href || 'schedule.html';
        modalPickKey = options.key || null;
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
        modalPickKey = null;
        if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function wireModalCardPicks() {
        if (!modalBody) return;
        const cards = modalBody.querySelectorAll('.ex-card--pickable');
        cards.forEach((card) => {
            const go = () => {
                const key = modalPickKey;
                if (!key) return;
                window.location.href = `schedule.html?v=${encodeURIComponent(key)}`;
            };
            card.addEventListener('click', go);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
            });
        });
    }

    if (modal) {
        $$('[data-close-modal]', modal).forEach((el) => el.addEventListener('click', closeModal));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    const modalAddVariation = $('#modal-add-variation');
    if (modalAddVariation) {
        modalAddVariation.addEventListener('click', () => {
            window.location.href = 'schedule.html?add=1';
        });
    }

    function variationCardMarkup(key, heroImage) {
        const all = getAllVariations();
        const v = all[key];
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

    async function openVariationModal(key) {
        const all = getAllVariations();
        const v = all[key];
        if (!v) return;
        const token = ++modalToken;

        openModal({
            eyebrow: 'Tap a card to choose this variation',
            title: `${v.label} — what you'll do`,
            body: loadingMarkup(`Fetching ${v.label} exercises…`),
            source: '',
            href: `schedule.html?v=${encodeURIComponent(key)}`,
            key: key
        });

        try {
            const { items, source, wgerCount } = await getExercisesWithImages(key, {
                limit: CONFIG.MODAL_LIMIT
            });
            if (token !== modalToken) return;

            modalBody.innerHTML = exerciseList(items, true);
            modalSource.textContent =
                `${items.length} exercises · ${sourceLabel(source)} · ${wgerCount} matched photos · tap any card to choose`;
            wireModalCardPicks();
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
        if (!exercises || exercises.length === 0) return 'Your coach will walk you through the full session on the day.';
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
        const res = await window.emailjs.send(CONFIG.EMAILJS.serviceId, CONFIG.EMAILJS.templateId, params);
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
            try { return JSON.parse(text); } catch (_) { return { raw: text }; }
        } catch (err) {
            console.warn('[FitPulse] Server scheduler failed:', err);
            return { error: String(err.message || err) };
        }
    }

    const notificationTimers = new Map();

    async function requestNotificationPermission() {
        if (!('Notification' in window)) return 'unsupported';
        if (Notification.permission === 'granted') return 'granted';
        if (Notification.permission === 'denied') return 'denied';
        try { return await Notification.requestPermission(); } catch (_) { return 'denied'; }
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
        const all = getAllVariations();
        const v = all[r.variationKey] || { emoji: '🏋️' };
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

    let previewExercises = [];

    function populateVariationSelect() {
        const select = $('#variation');
        if (!select) return;
        const all = getAllVariations();
        const previous = select.value;
        select.innerHTML = Object.keys(all)
            .map((k) => {
                const v = all[k];
                const label = (v.emoji ? v.emoji + ' ' : '') + v.label;
                return `<option value="${esc(k)}">${esc(label)}</option>`;
            })
            .join('');
        if (previous && all[previous]) select.value = previous;
        renderCustomChips();
    }

    function renderCustomChips() {
        const select = $('#variation');
        const field = select ? select.closest('.field') : null;
        if (!field) return;

        const old = field.querySelector('.custom-variation-list');
        if (old) old.remove();

        const customs = loadCustomVariations();
        const keys = Object.keys(customs);
        if (keys.length === 0) return;

        const row = document.createElement('div');
        row.className = 'custom-variation-list';
        row.innerHTML = keys.map((k) => `
      <span class="custom-chip" data-key="${esc(k)}">
        ${esc((customs[k].emoji || '') + ' ' + customs[k].label)}
        <button type="button" data-action="remove-custom" data-key="${esc(k)}" aria-label="Remove ${esc(customs[k].label)}">✕</button>
      </span>
    `).join('');

        field.appendChild(row);

        row.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove-custom"]');
            if (!btn) return;
            const key = btn.dataset.key;
            const list = loadCustomVariations();
            delete list[key];
            saveCustomVariations(list);
            populateVariationSelect();
            const s = $('#variation');
            if (s) s.dispatchEvent(new Event('change'));
            toast('Custom variation removed.', 'success');
        });
    }

    function openCustomModal() {
        const m = $('#custom-modal');
        if (!m) return;
        $('#custom-name').value = '';
        $('#custom-emoji').value = '';
        $('#custom-duration').value = '30';
        $('#custom-category').value = '15';
        $('#custom-name-error').textContent = '';
        m.hidden = false;
        document.body.classList.add('modal-open');
        setTimeout(() => $('#custom-name').focus(), 50);
    }

    function closeCustomModal() {
        const m = $('#custom-modal');
        if (!m) return;
        m.hidden = true;
        document.body.classList.remove('modal-open');
    }

    function saveCustomVariation() {
        const nameEl = $('#custom-name');
        const name = (nameEl.value || '').trim();
        const emoji = ($('#custom-emoji').value || '').trim() || '✨';
        const duration = Math.max(5, Math.min(180, Number($('#custom-duration').value) || 30));
        const categoryId = Number($('#custom-category').value) || 15;

        if (name.length < 2) {
            $('#custom-name-error').textContent = 'Give it a name (at least 2 characters).';
            nameEl.focus();
            return;
        }

        const key = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
        if (!key || key === 'custom_') {
            $('#custom-name-error').textContent = 'Use at least one letter or number.';
            return;
        }

        const all = getAllVariations();
        if (all[key]) {
            $('#custom-name-error').textContent = 'You already have a variation with this name.';
            return;
        }

        const custom = {
            label: name,
            emoji,
            tag: 'Custom',
            blurb: `Your own custom ${name} session.`,
            duration,
            intensity: 'Custom',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: categoryId,
            wgerFallbackId: null,
            isCustom: true
        };

        const list = loadCustomVariations();
        list[key] = custom;
        saveCustomVariations(list);
        closeCustomModal();
        populateVariationSelect();

        const select = $('#variation');
        if (select) {
            select.value = key;
            select.dispatchEvent(new Event('change'));
        }
        toast(`"${name}" added.`, 'success');
    }

    function readForm(form) {
        const all = getAllVariations();
        const key = form.variation.value;
        const v = all[key] || all.strength;
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
        if (!getAllVariations()[data.variationKey]) { markInvalid(form.variation, 'Please choose a variation.'); ok = false; }

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
            const all = getAllVariations();
            const key = select.value;
            const v = all[key];
            if (!v) { body.innerHTML = errorMarkup('Select a variation to preview.'); previewExercises = []; return; }

            const myToken = ++token;
            body.innerHTML = loadingMarkup(`Loading ${v.label} exercises…`);

            const title = $('#preview-title');
            if (title) title.textContent = `${v.label} — preview`;

            try {
                const { items, source, wgerCount } = await getExercisesWithImages(key, { limit: CONFIG.PREVIEW_LIMIT });
                if (myToken !== token) return;
                previewExercises = items;
                body.innerHTML = exerciseList(items, false);

                const foot = $('#preview-source');
                if (foot) {
                    foot.innerHTML = `${items.length} exercises · <strong>${esc(sourceLabel(source))}</strong> · ${wgerCount} matched photos`;
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
        if (getAllVariations()[preKey]) form.variation.value = preKey;

        const dateInput = form.date;
        if (dateInput) dateInput.min = todayISO();

        clearInvalid(form);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearStatus();
            clearInvalid(form);

            const data = readForm(form);

            if (!validate(data)) {
                toast('Please fix the highlighted fields.', 'error');
                const firstBad = $('.field.is-invalid input, .field.is-invalid select', form);
                if (firstBad) firstBad.focus();
                return;
            }

            setSubmitting(true);

            data.exercises = previewExercises.map((ex) => ({
                name: titleCase(ex.name), type: titleCase(ex.type),
                muscle: titleCase(ex.muscle), equipment: titleCase(ex.equipment),
                difficulty: titleCase(ex.difficulty),
                image: ex.image || ''
            }));

            try {
                await requestNotificationPermission();
                addReminder(data);
                renderReminders();
                scheduleBrowserNotification(data);

                await sendEmail(data, { mode: 'confirmation' });
                const sched = await scheduleOnServer(data);
                if (sched && sched.status === 'error') {
                    console.warn('[FitPulse] Scheduler rejected the reminder:', sched.message);
                }

                const schedulerNote = schedulerReady()
                    ? 'Your reminder email is queued for delivery.'
                    : 'Saved locally. Add a Scheduler URL in the config to enable scheduled email delivery.';

                showStatus('success',
                    `<strong>Reminder set, ${esc(data.name.split(' ')[0])}!</strong>
           <p>${esc(data.variationLabel)} on <strong>${esc(formatLongDate(data.date))}</strong>
           at <strong>${esc(formatTime(data.time))}</strong>. ${esc(schedulerNote)}</p>
           <span class="booking-id">${esc(data.id)}</span>`);

                toast('Reminder scheduled.', 'success');

                form.reset();
                clearInvalid(form);
                if (dateInput) dateInput.min = todayISO();

                const select = $('#variation');
                if (select) select.dispatchEvent(new Event('change'));
            } catch (err) {
                console.error('[FitPulse] Scheduling failed:', err);
                showStatus('error',
                    `<strong>We couldn't schedule your reminder.</strong>
           <p>${esc(err.message || 'Unexpected error.')} It's still saved locally, so nothing is lost.</p>`);
                toast('Something went wrong. Please try again.', 'error');
            } finally {
                setSubmitting(false);
            }
        });
    }

    function initNav() {
        const nav = $('#nav');
        if (!nav) return;
        const onScroll = () => nav.classList.toggle('nav--scrolled', window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    function init() {
        initNav();

        const page = document.body.dataset.page;

        if (page === 'home') {
            renderVariationGrid();
            initVariationActions();
        }

        if (page === 'schedule') {
            populateVariationSelect();
            initPreview();
            initScheduleForm();
            initReminderDashboard();

            const addBtn = $('#add-variation-btn');
            if (addBtn) addBtn.addEventListener('click', openCustomModal);

            const anotherReminderBtn = $('#add-another-reminder-btn');
            if (anotherReminderBtn) anotherReminderBtn.addEventListener('click', () => {
                const form = $('#reminder-form');
                if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setTimeout(() => { const variation = $('#variation'); if (variation) variation.focus(); }, 350);
            });

            const customModal = $('#custom-modal');
            if (customModal) {
                $$('[data-close-custom]', customModal).forEach((el) =>
                    el.addEventListener('click', closeCustomModal)
                );
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && !customModal.hidden) closeCustomModal();
                });
            }

            const saveBtn = $('#save-custom-btn');
            if (saveBtn) saveBtn.addEventListener('click', saveCustomVariation);

            const nameInput = $('#custom-name');
            if (nameInput) {
                nameInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); saveCustomVariation(); }
                });
            }

            const params = new URLSearchParams(window.location.search);
            if (params.get('add') === '1') {
                setTimeout(openCustomModal, 250);
            }
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.FitPulse = {
        getExercises,
        getExercisesWithImages,
        getVariationHeroImage,
        fetchWgerByCategory,
        fetchWgerById,
        searchWgerByName,
        getAllVariations,
        loadCustomVariations,
        saveCustomVariations,
        VARIATIONS,
        loadReminders,
        clearCache: () => { cache.clear(); wgerCache.clear(); },
        config: CONFIG
    };
})();