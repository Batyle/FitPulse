/* =========================================================
   FitPulse — script.js
   ========================================================= */

(function () {
    'use strict';

    /* =======================================================
       1. CONFIG
       ======================================================= */
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
            templateId: 'template_x7z2cgf',
            publicKey:  'cIeRGuB2mD_8X6NQD'
        },

        SCHEDULER_URL: 'https://script.google.com/macros/s/AKfycbxK4ESnY5JxhM7DeMUHvbYlRm5WMe0lexYsC1ywh6EqVSfh74qnSg7ILjiSYh62rbR3Tw/exec',

        SENDER: {
            name:    'FitPulse',
            email:   'reminders@fitpulse.example',
            tagline: 'Personal fitness reminders, delivered on time.'
        }
    };

    /* =======================================================
       2. VARIATION MAP
       ======================================================= */
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
       4. CUSTOM VARIATIONS STORAGE
       ======================================================= */
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

    /* =======================================================
       5. NORMALISERS
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

    /* =======================================================
       6. EXERCISE DATA LAYER
       ======================================================= */
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

    /* =======================================================
       7. WGER IMAGE LAYER
       ======================================================= */
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

    /* ---------- ENHANCED SEARCH ----------
       Tries the full name, then the first significant keyword.
       Walks all suggestions for a direct image, then fetches the full
       /exerciseinfo/{id}/ record for the top 3 — where wger actually
       stores images. */
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

                // Pass 1 — walk every suggestion, use the first that has an image
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

                // Pass 2 — full record for top 3 suggestions
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

        // Wger keeps each exercise's instructions and image in the same record,
        // so use it directly rather than attaching an unrelated search result.
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

    /* =======================================================
       8. RENDERERS
       ======================================================= */
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

    /* =======================================================
       9. TOAST
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
       10. PREVIEW MODAL CONTROLLER
       ======================================================= */
    const modal = $('#modal');
    const modalTitle = $('#modal-title');
    const modalEyebrow = $('#modal-eyebrow');
    const modalBody = $('#modal-body');
    const modalSource = $('#modal-source');
    const modalBook = $('#modal-book');
    const PENDING_CUSTOMIZATION_KEY = 'fitpulse:pending-reminder-customization';

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
                saveModalCustomization(key);
                window.location.href = `schedule.html?v=${encodeURIComponent(key)}`;
            };
            card.addEventListener('click', go);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
            });
        });
    }

    function previewCustomizerMarkup(variation) {
        return `<section class="preview-customizer" aria-label="Customize workout"><div class="preview-customizer__head"><strong>Make it yours</strong><span>Optional changes</span></div><div class="preview-customizer__grid"><label>Duration (minutes)<input id="preview-duration" type="number" min="5" max="180" value="${esc(variation.duration)}" /></label><label>Target for the day<select id="preview-target"><option value="">Choose a focus</option><option>Build strength</option><option>Improve endurance</option><option>Burn calories</option><option>Mobility &amp; recovery</option><option>Core stability</option><option>Stress relief</option></select></label><label>Fitness level<select id="preview-level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>Goal / note<input id="preview-notes" type="text" maxlength="120" placeholder="e.g. Focus on form today" /></label></div></section>`;
    }

    function saveModalCustomization(key) {
        if (!key) return;
        const duration = Number($('#preview-duration', modal)?.value);
        const payload = { variationKey:key, duration:duration >= 5 && duration <= 180 ? duration : '', target:($('#preview-target', modal)?.value || '').trim(), level:($('#preview-level', modal)?.value || '').trim(), notes:($('#preview-notes', modal)?.value || '').trim() };
        try { sessionStorage.setItem(PENDING_CUSTOMIZATION_KEY, JSON.stringify(payload)); } catch (_) {}
    }

    if (modal) {
        $$('[data-close-modal]', modal).forEach((el) => el.addEventListener('click', closeModal));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    if (modalBook) modalBook.addEventListener('click', (event) => {
        if (!modalPickKey) return;
        event.preventDefault();
        saveModalCustomization(modalPickKey);
        window.location.href = `schedule.html?v=${encodeURIComponent(modalPickKey)}`;
    });

    const modalAddVariation = $('#modal-add-variation');
    if (modalAddVariation) {
        modalAddVariation.addEventListener('click', () => {
            window.location.href = 'schedule.html?add=1';
        });
    }

    /* =======================================================
       11. VARIATION GRID (index page)
       ======================================================= */
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
          <li><strong>${v.duration}</strong> minutes</li>
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
       12. PREVIEW MODAL (index page)
       ======================================================= */
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

            modalBody.innerHTML = previewCustomizerMarkup(v) + exerciseList(items, true);
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

    /* =======================================================
       13. REMINDER STORAGE
       ======================================================= */
    const STORE_KEY = 'fitpulse:reminders';
    const CURRENT_USER_KEY = 'fitpulse:current-user';

    function currentUser() {
        try {
            const user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || 'null');
            return user && user.id && user.email ? user : null;
        } catch (_) { return null; }
    }

    async function authOnServer(action, payload) {
        const res = await fetch(CONFIG.SCHEDULER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(Object.assign({ action }, payload)),
            redirect: 'follow'
        });
        const text = await res.text();
        try { return JSON.parse(text); } catch (_) { throw new Error('The account service returned an invalid response.'); }
    }

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

    function updateReminder(reminder) {
        const list = loadReminders().map((item) => item.id === reminder.id ? reminder : item);
        list.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        saveReminders(list);
        return list;
    }

    /* =======================================================
       14. EMAIL LAYER
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
        if (!exercises || exercises.length === 0) return 'Your coach will walk you through the full session on the day.';
        return exercises.map((ex, i) =>
            `${i + 1}. ${ex.name}\n   • Focus: ${ex.muscle} · Type: ${ex.type}\n   • Equipment: ${ex.equipment} · Level: ${ex.difficulty}`
        ).join('\n\n');
    }

    /* Text-only workout table rendered by EmailJS through {{{workout_html}}}. */
    function buildWorkoutHtml(exercises) {
        if (!exercises || exercises.length === 0) {
            return '<p style="padding:20px;font-size:14px;color:#a4a4b0;text-align:center;margin:0;">Your coach will walk you through the full session on the day.</p>';
        }
        function exerciseLabel(ex) {
            return `<span style="display:inline-block;padding:5px 8px;border:1px solid #3a3a46;border-radius:6px;background:#24242d;color:#d7d7df;font-size:9px;font-weight:800;letter-spacing:0.8px;line-height:1.2;text-transform:uppercase;text-align:center;">${esc(exerciseCategory(ex))}</span>`;
        }
        function exerciseCategory(ex) {
            const type = (String(ex.type || '') + ' ' + String(ex.muscle || '')).toLowerCase();
            if (type.includes('cardio') || type.includes('plyo')) return 'Cardio';
            if (type.includes('chest')) return 'Chest';
            if (type.includes('bicep') || type.includes('arm') || type.includes('tricep')) return 'Arms';
            if (type.includes('ab') || type.includes('core')) return 'Core';
            if (type.includes('leg') || type.includes('quad') || type.includes('hamstring') || type.includes('calf')) return 'Legs';
            if (type.includes('back') || type.includes('lat')) return 'Back';
            if (type.includes('shoulder')) return 'Shoulders';
            if (type.includes('stretch') || type.includes('mobility') || type.includes('yoga')) return 'Mobility';
            if (type.includes('glute')) return 'Glutes';
            return 'Training';
        }
        const rows = exercises.map((ex) => {
            const level = String(ex.difficulty || '').toLowerCase();
            let color = '#a4a4b0', background = '#2a2a33';
            if (level.includes('beg') || level.includes('easy')) { color = '#4ade80'; background = '#0f2e1d'; }
            else if (level.includes('int') || level.includes('med')) { color = '#fbbf24'; background = '#2e2410'; }
            else if (level.includes('adv') || level.includes('hard')) { color = '#f87171'; background = '#2e1516'; }
            else if (level.includes('exp')) { color = '#c084fc'; background = '#261633'; }
            const badge = `<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:${color};background:${background};border:1px solid ${color}55;">${esc(titleCase(ex.difficulty || 'All levels'))}</span>`;
            return `<tr><td style="padding:18px 20px;border-bottom:1px solid #2a2a33;width:56px;vertical-align:top;">${exerciseLabel(ex)}</td><td style="padding:18px 20px;border-bottom:1px solid #2a2a33;vertical-align:top;"><div style="font-size:16px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;line-height:1.3;text-transform:capitalize;">${esc(titleCase(ex.name || ''))}</div><div style="margin-top:8px;font-size:13px;line-height:1.7;color:#a4a4b0;"><span style="color:#6a6a75;">Focus</span>&nbsp; ${esc(titleCase(ex.muscle || '—'))}<br><span style="color:#6a6a75;">Equipment</span>&nbsp; ${esc(titleCase(ex.equipment || '—'))}<br><span style="color:#6a6a75;">Type</span>&nbsp; ${esc(titleCase(ex.type || '—'))}</div><div style="margin-top:12px;">${badge}</div></td></tr>`;
        }).join('');
        return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#1a1a20;border:1px solid #2a2a33;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;"><tbody>${rows}</tbody></table>`;
    }

    function buildEmailText(data, isConfirmation) {
        const intro = isConfirmation
            ? `Your ${data.variationLabel} reminder is confirmed.`
            : `It's time for your ${data.variationLabel} session.`;
        return `${intro}

WHEN
${formatLongDate(data.date)} at ${formatTime(data.time)}

SESSION
${data.duration} minutes · ${data.level} · ${data.repeatLabel}

TARGET
${data.target || 'No specific target selected.'}

NOTES
${data.notes || 'No notes added.'}

YOUR WORKOUT
${buildWorkoutText(data.exercises)}

${CONFIG.SENDER.name} · ${CONFIG.SENDER.tagline}`;
    }

    function buildEmailHtml(data, isConfirmation) {
        const heading = isConfirmation ? 'Your reminder is set' : 'Time to train';
        const intro = isConfirmation
            ? `Your <strong>${esc(data.variationLabel)}</strong> session is locked in. We’ll be here when it’s time to move.`
            : `Your <strong>${esc(data.variationLabel)}</strong> session is ready. Take a breath, warm up, and get after it.`;
        const notes = data.notes
            ? `<tr><td style="padding:0 0 18px;"><div style="padding:14px 16px;border-radius:12px;background:#fff7f2;color:#5b3224;font-size:14px;line-height:1.55;"><strong style="display:block;margin-bottom:4px;color:#c84c1b;">Your note</strong>${esc(data.notes)}</div></td></tr>`
            : '';
        const target = data.target ? `<tr><td style="padding:0 32px 18px;"><div style="font-size:13px;color:#684536;"><strong style="color:#a4502f;">Today’s target:</strong> ${esc(data.target)}</div></td></tr>` : '';

        return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#202126;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(23,24,28,.10);">
      <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#111216,#2b1611);color:#ffffff;">
        <div style="font-size:13px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#ff9b72;">FITPULSE · PERSONAL REMINDER</div>
        <div style="padding-top:14px;font-size:30px;font-weight:800;line-height:1.15;">${heading}</div>
        <div style="padding-top:10px;font-size:15px;line-height:1.55;color:#e2e4e9;">${intro}</div>
      </td></tr>
      <tr><td style="padding:28px 32px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff4ef;border:1px solid #ffd6c5;border-radius:14px;"><tr>
          <td style="padding:16px 18px;width:50%;border-right:1px solid #ffd6c5;"><div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#a4502f;">When</div><div style="padding-top:5px;font-size:16px;font-weight:bold;color:#2b2020;">${esc(formatShortDate(data.date))}</div><div style="padding-top:3px;font-size:14px;color:#694b40;">${esc(formatTime(data.time))}</div></td>
          <td style="padding:16px 18px;"><div style="font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#a4502f;">Session</div><div style="padding-top:5px;font-size:16px;font-weight:bold;color:#2b2020;">${esc(data.duration)} minutes · ${esc(data.level)}</div><div style="padding-top:3px;font-size:14px;color:#694b40;">${esc(data.repeatLabel)}</div></td>
        </tr></table>
      </td></tr>
      ${notes}
      ${target}
      <tr><td style="padding:12px 32px 6px;font-size:20px;font-weight:800;color:#202126;">Your workout plan</td></tr>
      <tr><td style="padding:8px 32px 24px;">${buildWorkoutHtml(data.exercises)}</td></tr>
      <tr><td style="padding:18px 32px;background:#17181c;color:#c9cbd1;font-size:12px;line-height:1.5;">${esc(CONFIG.SENDER.tagline)}<br>Reminder reference: ${esc(data.id)}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
    }

    function buildEmailParams(data, opts) {
        const o = opts || {};
        const isConfirmation = o.mode === 'confirmation';

        const subject = isConfirmation
            ? `Reminder set — ${data.variationLabel} on ${formatShortDate(data.date)}`
            : `⏰ Time to train — ${data.variationLabel}`;

        const emailText = buildEmailText(data, isConfirmation);
        const emailHtml = buildEmailHtml(data, isConfirmation);

        return {
            to_name:  data.name,
            to_email: data.email,
            reply_to: CONFIG.SENDER.email,
            subject: stripEmailEmoji(subject),
            heading: isConfirmation ? 'Your reminder is set ✅' : 'Your workout is waiting 💪',
            heading: isConfirmation ? 'Your reminder is set' : 'Your workout is waiting',
            subheading: isConfirmation
                ? `We'll email you again on ${formatLongDate(data.date)} at ${formatTime(data.time)}.`
                : `It's time for your ${data.variationLabel} session.`,

            reminder_ref:    data.id,
            variation:       data.variationLabel,
            variation_emoji: '',
            class_date:      formatLongDate(data.date),
            short_date:      formatShortDate(data.date),
            class_time:      formatTime(data.time),
            repeat_label:    data.repeatLabel,
            fitness_level:   data.level,
            duration_min:    String(data.duration),
            target:          data.target || 'No specific target selected.',
            notes:           data.notes || 'None',

            workout_list:   buildWorkoutText(data.exercises),
            workout_html:   buildWorkoutHtml(data.exercises),
            exercise_count: String((data.exercises || []).length),
            // `message` supports a plain EmailJS template; `email_html` powers
            // the branded template documented in README.md.
            message:        emailText,
            email_text:     emailText,
            email_html:     emailHtml,

            sender_name:    CONFIG.SENDER.name,
            sender_email:   CONFIG.SENDER.email,
            sender_tagline: CONFIG.SENDER.tagline,
            arrive_note:    'Hydrate. Warm up. Show up.',

            sent_at: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        };
    }

    function stripEmailEmoji(value) {
        return String(value || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s{2,}/g, ' ').trim();
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
                    action: data.isUpdate ? 'update' : 'create',
                    id: data.id, userId: data.userId || '', name: data.name, email: data.email,
                    variation: data.variationLabel, variationKey: data.variationKey,
                    date: data.date, time: data.time,
                    repeat: data.repeat, repeatLabel: data.repeatLabel,
                    level: data.level, duration: data.duration, target: data.target, notes: data.notes,
                    exercises: data.exercises,
                    emailjs: {
                        serviceId: CONFIG.EMAILJS.serviceId,
                        templateId: CONFIG.EMAILJS.templateId,
                        publicKey: CONFIG.EMAILJS.publicKey,
                        templateParams: buildEmailParams(data, { mode: 'reminder' })
                    },
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

    /* =======================================================
       15. BROWSER NOTIFICATIONS
       ======================================================= */
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
                    body: `${reminder.duration} minutes · ${reminder.level}. Open FitPulse for your workout.`,
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
       16. REMINDER DASHBOARD
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
          <li>${r.duration} minutes</li>
          <li>Ref ${esc(r.id)}</li>
        </ul>
        ${!isPast ? `<span class="reminder-card__countdown">${esc(countdownLabel(r.datetime))}</span>` : ''}
        <div class="reminder-card__actions">
          <button class="btn btn--ghost" data-action="send-reminder-now" data-id="${esc(r.id)}">Send email now</button>
          <button class="btn btn--primary" data-action="edit-reminder" data-id="${esc(r.id)}">Edit</button>
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
        list.addEventListener('click', async (e) => {
            const sendBtn = e.target.closest('[data-action="send-reminder-now"]');
            if (sendBtn) {
                const reminder = loadReminders().find((item) => item.id === sendBtn.dataset.id);
                if (!reminder) return;
                const original = sendBtn.textContent;
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending…';
                try {
                    await sendEmail(reminder, { mode: 'reminder' });
                    toast(`Workout email sent to ${reminder.email}.`, 'success');
                } catch (err) {
                    console.error('[FitPulse] Immediate email failed:', err);
                    toast(`Couldn't send the email: ${err.message || 'Please try again.'}`, 'error');
                } finally {
                    sendBtn.disabled = false;
                    sendBtn.textContent = original;
                }
                return;
            }
            const editBtn = e.target.closest('[data-action="edit-reminder"]');
            if (editBtn) {
                startEditingReminder(editBtn.dataset.id);
                return;
            }
            const btn = e.target.closest('[data-action="remove-reminder"]');
            if (!btn) return;
            const id = btn.dataset.id;
            btn.disabled = true;
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
       17. SCHEDULE FORM
       ======================================================= */
    let previewExercises = [];

    function setReminderId(form, id) {
        if (form.reminderId) form.reminderId.value = id || makeReminderId();
    }

    function setEditMode(form, reminder) {
        const isEditing = Boolean(reminder);
        form.dataset.editingId = isEditing ? reminder.id : '';
        setReminderId(form, isEditing ? reminder.id : '');
        const submit = $('#submit-btn');
        if (submit) submit.textContent = isEditing ? 'Save Reminder Changes' : 'Schedule My Reminder';
        const cancel = $('#cancel-edit-btn');
        if (cancel) cancel.hidden = !isEditing;
    }

    function startEditingReminder(id) {
        const form = $('#reminder-form');
        const reminder = loadReminders().find((item) => item.id === id);
        if (!form || !reminder) return;

        form.fullName.value = reminder.name || '';
        form.email.value = reminder.email || '';
        form.variation.value = reminder.variationKey || 'strength';
        form.date.value = reminder.date || '';
        form.time.value = reminder.time || '07:00';
        form.repeat.value = reminder.repeat || 'Once';
        form.level.value = reminder.level || 'Beginner';
        if (form.durationOverride) form.durationOverride.value = reminder.duration || '';
        if (form.target) form.target.value = reminder.target || '';
        if (form.notes) form.notes.value = reminder.notes || '';
        setEditMode(form, reminder);
        clearStatus();
        clearInvalid(form);
        form.variation.dispatchEvent(new Event('change'));
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => form.date.focus(), 350);
    }

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
            id: (form.reminderId && form.reminderId.value) || makeReminderId(),
            isUpdate: Boolean(form.dataset.editingId),
            userId: (currentUser() || {}).id || '',
            name:  (form.fullName.value || '').trim(),
            email: (form.email.value || '').trim(),
            variationKey: key,
            variationLabel: v.label,
            variationEmoji: v.emoji,
            duration: Math.max(5, Math.min(180, Number(form.durationOverride && form.durationOverride.value) || v.duration)),
            date, time,
            datetime: isNaN(dt) ? '' : dt.toISOString(),
            repeat: form.repeat.value,
            repeatLabel: form.repeat.value,
            level: form.level.value,
            target: (form.target && form.target.value || '').trim(),
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

        try {
            const pending = JSON.parse(sessionStorage.getItem(PENDING_CUSTOMIZATION_KEY) || 'null');
            if (pending && (!pending.variationKey || pending.variationKey === form.variation.value)) {
                if (pending.duration && form.durationOverride) form.durationOverride.value = pending.duration;
                if (pending.target && form.target) form.target.value = pending.target;
                if (pending.level && form.level) form.level.value = pending.level;
                if (pending.notes && form.notes) form.notes.value = pending.notes;
            }
        } catch (_) {}

        const dateInput = form.date;
        if (dateInput) dateInput.min = todayISO();

        const user = currentUser();
        if (user) {
            if (!form.fullName.value) form.fullName.value = user.name || '';
            if (!form.email.value) form.email.value = user.email || '';
        }

        setEditMode(form, null);

        const cancelEdit = $('#cancel-edit-btn');
        if (cancelEdit) cancelEdit.addEventListener('click', () => {
            form.reset();
            setEditMode(form, null);
            clearInvalid(form);
            clearStatus();
            if (dateInput) dateInput.min = todayISO();
            const select = $('#variation');
            if (select) select.dispatchEvent(new Event('change'));
        });

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
                if (data.isUpdate) updateReminder(data);
                else addReminder(data);
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
                    `<strong>Reminder ${data.isUpdate ? 'updated' : 'set'}, ${esc(data.name.split(' ')[0])}!</strong>
           <p>${esc(data.variationLabel)} on <strong>${esc(formatLongDate(data.date))}</strong>
           at <strong>${esc(formatTime(data.time))}</strong>. ${esc(schedulerNote)}</p>
           <span class="booking-id">${esc(data.id)}</span>`);

                toast('Reminder scheduled.', 'success');

                form.reset();
                setEditMode(form, null);
                try { sessionStorage.removeItem(PENDING_CUSTOMIZATION_KEY); } catch (_) {}
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

    /* =======================================================
       18. SHARED CHROME
       ======================================================= */
    function initNav() {
        const nav = $('#nav');
        if (!nav) return;
        const onScroll = () => nav.classList.toggle('nav--scrolled', window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    function initLoginForm() {
        const form = $('#login-form');
        if (!form) return;
        const status = $('#login-status');
        const mode = $('#account-mode');
        const nameField = $('#login-name-field');
        const passwordField = $('#login-password-field');
        const resetCodeField = $('#reset-code-field');
        const title = $('#login-title');
        const submit = $('#login-submit');
        let resetRequested = false;
        const existing = currentUser();
        if (existing) {
            status.textContent = `Signed in as ${existing.name || existing.email}.`;
            status.hidden = false;
        }
        const syncMode = () => {
            const registering = mode.value === 'register';
            const recovering = mode.value === 'forgot';
            nameField.hidden = !registering;
            passwordField.hidden = recovering && !resetRequested;
            resetCodeField.hidden = !recovering || !resetRequested;
            form.password.required = !recovering || resetRequested;
            form.code.required = recovering && resetRequested;
            title.textContent = registering ? 'Create your FitPulse account' : recovering ? 'Reset your password' : 'Welcome back';
            submit.textContent = registering ? 'Create account' : recovering ? (resetRequested ? 'Reset password' : 'Email reset code') : 'Log in';
        };
        mode.addEventListener('change', () => { resetRequested = false; syncMode(); });
        syncMode();
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            status.hidden = true;
            const email = form.email.value.trim().toLowerCase();
            const password = form.password.value;
            const name = form.name.value.trim();
            const recovering = mode.value === 'forgot';
            const needsPassword = !recovering || resetRequested;
            if (!/^\S+@\S+\.\S+$/.test(email) || (needsPassword && password.length < 8) || (mode.value === 'register' && name.length < 2) || (recovering && resetRequested && !/^\d{6}$/.test(form.code.value.trim()))) {
                status.textContent = recovering && resetRequested
                    ? 'Enter the six-digit code and a password with at least 8 characters.'
                    : recovering ? 'Enter a valid email address.' : 'Enter a name, valid email, and a password with at least 8 characters.';
                status.hidden = false;
                return;
            }
            submit.disabled = true;
            const label = submit.textContent;
            submit.textContent = 'Please wait…';
            try {
                const action = recovering ? (resetRequested ? 'resetPassword' : 'requestReset') : mode.value;
                const result = await authOnServer(action, { name, email, password, code: form.code.value.trim() });
                if (action === 'requestReset') {
                    resetRequested = true;
                    status.textContent = result.message || 'If an account matches that email, we sent a six-digit reset code.';
                    status.hidden = false;
                    syncMode();
                    form.code.focus();
                    return;
                }
                if (!result || result.status !== 'ok' || !result.user) throw new Error((result && result.message) || 'Unable to access your account.');
                localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(result.user));
                window.location.href = 'schedule.html';
            } catch (err) {
                status.textContent = err.message || 'Unable to access your account.';
                status.hidden = false;
            } finally {
                submit.disabled = false;
                submit.textContent = label;
            }
        });
    }

    /* =======================================================
       19. BOOT
       ======================================================= */
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

        if (page === 'login') initLoginForm();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.FitPulse = {
        getExercises,
        getExercisesWithImages,
        buildWorkoutHtml,
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
