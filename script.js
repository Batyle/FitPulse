

(function () {
    'use strict';

    /* =======================================================
       1. CONFIG
       ======================================================= */
    const CONFIG = {
        API_KEY: '',
        API_BASE: 'https://api.api-ninjas.com/v1/exercises',
        FALLBACK_URL:
            'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json',

        WGER_BASE: 'https://wger.de/api/v2',
        WGER_CACHE_TTL: 1000 * 60 * 60,
        WGER_LIMIT: 40,

        CACHE_TTL: 1000 * 60 * 30,
        MODAL_LIMIT: 5,
        PREVIEW_LIMIT: 4,

        /* --- New APIs --- */
        QUOTE_API: 'https://zenquotes.io/api/random',
        WEATHER_API: 'https://api.open-meteo.com/v1/forecast',
        WEATHER_LAT: 14.5995,
        WEATHER_LON: 120.9842,
        WEATHER_CITY: 'Manila',

        SCHEDULER_URL: 'https://script.google.com/macros/s/AKfycbxK4ESnY5JxhM7DeMUHvbYlRm5WMe0lexYsC1ywh6EqVSfh74qnSg7ILjiSYh62rbR3Tw/exec',

        SENDER: {
            name:    'FitPulse',
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
        return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
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
       4. CUSTOM VARIATIONS
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
        const instr = Array.isArray(ex.instructions) ? ex.instructions.join(' ') : (ex.instructions || '');
        return {
            name: ex.name || 'Untitled exercise',
            type: ex.category || 'strength',
            muscle: muscles[0] || 'full body',
            equipment: ex.equipment || 'bodyweight',
            difficulty: ex.level || 'beginner',
            instructions: instr,
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

        let instructions = '';
        if (Array.isArray(ex.instructions) && ex.instructions.length) {
            instructions = ex.instructions.map(stripHtml).filter(Boolean).join(' ');
        }
        if (!instructions) {
            instructions = stripHtml(english.description || ex.description || '');
        }

        return {
            id: ex.id,
            name: english.name || ex.name || ex.name_clean || 'Untitled',
            type: ex.category ? ex.category.name : 'Workout',
            muscle: muscles[0] ? muscles[0].name : (ex.category ? ex.category.name : 'Full body'),
            equipment: equipment[0] ? equipment[0].name : 'Bodyweight',
            difficulty: 'All levels',
            instructions: instructions,
            image: main ? (main.thumbnails && main.thumbnails.medium) || main.image : ''
        };
    }

    /* =======================================================
       6. EXERCISE DATA LAYER
       ======================================================= */
    const cache = new Map();
    const wgerCache = new Map();
    const detailCache = new Map();
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
        let items, source;
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
       7. WGER IMAGE + INSTRUCTION LAYER
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
        const hit = detailCache.get(key);
        if (hit && Date.now() - hit.at < CONFIG.WGER_CACHE_TTL) return hit.item;
        try {
            const url = `${CONFIG.WGER_BASE}/exerciseinfo/${id}/`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`wger responded ${res.status}`);
            const data = await res.json();
            const item = normalizeWger(data);
            detailCache.set(key, { at: Date.now(), item });
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
        const hit = detailCache.get(cacheKey);
        if (hit) return hit.item;
        const queries = [clean];
        const words = clean.split(/\s+/).filter((w) => w.length > 3);
        if (words.length > 1 && words[0].toLowerCase() !== clean.toLowerCase()) queries.push(words[0]);
        for (const q of queries) {
            try {
                const url = `${CONFIG.WGER_BASE}/exercise/search/?term=${encodeURIComponent(q)}&language=english&format=json`;
                const res = await fetch(url);
                if (!res.ok) continue;
                const data = await res.json();
                const suggestions = data.suggestions || [];
                if (!suggestions.length) continue;
                for (const s of suggestions.slice(0, 3)) {
                    if (s.data && s.data.id) {
                        const full = await fetchWgerById(s.data.id);
                        if (full && full.image) {
                            detailCache.set(cacheKey, { at: Date.now(), item: full });
                            return full;
                        }
                    }
                }
            } catch (err) {
                console.warn('[FitPulse] wger search failed for "%s":', q, err);
            }
        }
        detailCache.set(cacheKey, { at: Date.now(), item: null });
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
        const enriched = await Promise.all(
            exerciseResult.items.map(async (ex) => {
                const match = await searchWgerByName(ex.name);
                if (match) {
                    return {
                        ...ex,
                        image: match.image || ex.image,
                        instructions: match.instructions || ex.instructions || '',
                        muscle: match.muscle || ex.muscle,
                        equipment: match.equipment || ex.equipment
                    };
                }
                return ex;
            })
        );

        return {
            items: enriched,
            source: exerciseResult.source,
            wgerCount: enriched.filter((x) => x.image).length
        };
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
       8. NEW APIs — ZenQuotes + Open-Meteo
       ======================================================= */
    async function fetchDailyQuote() {
        const cacheKey = 'daily-quote';
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try { return JSON.parse(cached); } catch (_) {}
        }
        try {
            const res = await fetch(CONFIG.QUOTE_API);
            if (!res.ok) throw new Error(`Quote API ${res.status}`);
            const data = await res.json();
            const quote = Array.isArray(data) ? data[0] : data;
            const payload = {
                text: quote.q || 'Discipline beats motivation.',
                author: quote.a || 'Unknown'
            };
            sessionStorage.setItem(cacheKey, JSON.stringify(payload));
            return payload;
        } catch (err) {
            console.warn('[FitPulse] Quote fetch failed:', err);
            return { text: 'Discipline beats motivation.', author: 'FitPulse' };
        }
    }

    async function fetchWeatherAt(dateISO, hourHHMM) {
        try {
            const hour = hourHHMM ? hourHHMM.split(':')[0] : '07';
            const url = `${CONFIG.WEATHER_API}?latitude=${CONFIG.WEATHER_LAT}` +
                `&longitude=${CONFIG.WEATHER_LON}` +
                `&hourly=temperature_2m,precipitation_probability,weather_code` +
                `&timezone=auto&forecast_days=7`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Weather API ${res.status}`);
            const data = await res.json();
            if (!data.hourly || !data.hourly.time) throw new Error('Malformed weather data');

            const targetTime = `${dateISO}T${String(hour).padStart(2, '0')}:00`;
            const idx = data.hourly.time.indexOf(targetTime);
            if (idx === -1) throw new Error('Date out of forecast range');

            return {
                temp: Math.round(data.hourly.temperature_2m[idx]),
                rain: data.hourly.precipitation_probability[idx],
                code: data.hourly.weather_code[idx],
                label: weatherLabel(data.hourly.weather_code[idx]),
                icon: weatherIcon(data.hourly.weather_code[idx])
            };
        } catch (err) {
            console.warn('[FitPulse] Weather fetch failed:', err);
            return null;
        }
    }

    function weatherLabel(code) {
        if (code === 0) return 'Clear';
        if (code <= 2) return 'Partly cloudy';
        if (code === 3) return 'Overcast';
        if (code <= 48) return 'Foggy';
        if (code <= 57) return 'Drizzle';
        if (code <= 67) return 'Rain';
        if (code <= 77) return 'Snow';
        if (code <= 82) return 'Showers';
        if (code <= 86) return 'Snow showers';
        if (code <= 99) return 'Thunderstorm';
        return 'Mixed';
    }
    function weatherIcon(code) {
        if (code === 0) return '☀️';
        if (code <= 2) return '⛅';
        if (code === 3) return '☁️';
        if (code <= 48) return '🌫️';
        if (code <= 57) return '🌦️';
        if (code <= 67) return '🌧️';
        if (code <= 77) return '❄️';
        if (code <= 82) return '🌧️';
        if (code <= 86) return '❄️';
        if (code <= 99) return '⛈️';
        return '🌡️';
    }

    async function renderHeroQuote() {
        const card = $('#hero-quote');
        if (!card) return;
        const text = $('.hero__quote-text', card);
        const author = $('.hero__quote-author', card);
        const q = await fetchDailyQuote();
        if (text) text.textContent = q.text;
        if (author) author.textContent = '— ' + q.author;
    }

    function renderWeatherChip(weather) {
        const field = $('#date') ? $('#date').closest('.field') : null;
        if (!field) return;
        let chip = field.parentElement.querySelector('.weather-chip');
        if (!weather) { if (chip) chip.remove(); return; }
        if (!chip) {
            chip = document.createElement('div');
            chip.className = 'weather-chip';
            field.parentElement.appendChild(chip);
        }
        chip.innerHTML =
            `${weather.icon} <span><strong>${weather.temp}°C</strong> · ${esc(weather.label)} · ` +
            `${weather.rain}% rain at ${esc(CONFIG.WEATHER_CITY)}</span>`;
    }

    /* =======================================================
       9. RENDERERS
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
        const hint = clickable ? `<span class="ex-card__pick-hint" aria-hidden="true">Tap to choose →</span>` : '';

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
       10. TOAST
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
       11. MODAL CONTROLLER
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
        return `<section class="preview-customizer" aria-label="Customize workout"><div class="preview-customizer__head"><strong>Make it yours</strong><span>Optional changes</span></div><div class="preview-customizer__grid"><label>Duration (min)<input id="preview-duration" type="number" min="5" max="180" value="${esc(variation.duration)}" /></label><label>Target for the day<select id="preview-target"><option value="">Choose a focus</option><option>Build strength</option><option>Improve endurance</option><option>Burn calories</option><option>Mobility &amp; recovery</option><option>Core stability</option><option>Stress relief</option></select></label><label>Fitness level<select id="preview-level"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label><label>Goal / note<input id="preview-notes" type="text" maxlength="120" placeholder="e.g. Focus on form today" /></label></div></section>`;
    }
    function saveModalCustomization(key) {
        if (!key) return;
        const duration = Number($('#preview-duration', modal)?.value);
        const payload = {
            variationKey: key,
            duration: duration >= 5 && duration <= 180 ? duration : '',
            target: ($('#preview-target', modal)?.value || '').trim(),
            level: ($('#preview-level', modal)?.value || '').trim(),
            notes: ($('#preview-notes', modal)?.value || '').trim()
        };
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
       12. VARIATION GRID
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
       13. PREVIEW MODAL
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
            const { items, source, wgerCount } = await getExercisesWithImages(key, { limit: CONFIG.MODAL_LIMIT });
            if (token !== modalToken) return;
            modalBody.innerHTML = previewCustomizerMarkup(v) + exerciseList(items, true);
            modalSource.textContent = `${items.length} exercises · ${sourceLabel(source)} · ${wgerCount} matched photos · tap any card to choose`;
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
       14. REMINDER STORAGE
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
    function updateReminder(reminder) {
        const list = loadReminders().map((item) => item.id === reminder.id ? reminder : item);
        list.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        saveReminders(list);
        return list;
    }

    /* =======================================================
       15. APPS SCRIPT — THE ONLY EMAIL SENDER
       ======================================================= */
    function schedulerReady() {
        return Boolean(CONFIG.SCHEDULER_URL) && !/YOUR_|PASTE_/i.test(CONFIG.SCHEDULER_URL);
    }
    async function scheduleOnServer(data) {
        if (!schedulerReady()) {
            console.warn('[FitPulse] No Apps Script URL configured.');
            return { skipped: true };
        }
        try {
            const res = await fetch(CONFIG.SCHEDULER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: data.isUpdate ? 'update' : 'create',
                    id: data.id,
                    name: data.name,
                    email: data.email,
                    variation: data.variationLabel,
                    variationKey: data.variationKey,
                    variationEmoji: data.variationEmoji,
                    date: data.date,
                    time: data.time,
                    repeat: data.repeat,
                    repeatLabel: data.repeatLabel,
                    level: data.level,
                    duration: data.duration,
                    target: data.target,
                    notes: data.notes,
                    exercises: data.exercises,
                    quote: data.quote,
                    weather: data.weather,
                    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
                    senderName: CONFIG.SENDER.name,
                    senderTagline: CONFIG.SENDER.tagline
                }),
                redirect: 'follow'
            });
            const text = await res.text();
            try { return JSON.parse(text); }
            catch (_) {
                const match = text.match(/"bookingId"\s*:\s*"([^"]+)"/);
                if (match) return { status: 'success', bookingId: match[1] };
                return { raw: text };
            }
        } catch (err) {
            console.warn('[FitPulse] Apps Script call failed:', err);
            return { error: String(err.message || err) };
        }
    }
    async function deleteFromServer(id) {
        if (!schedulerReady()) return;
        try {
            await fetch(CONFIG.SCHEDULER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'delete', id: id }),
                redirect: 'follow'
            });
        } catch (err) {
            console.warn('[FitPulse] Delete sync failed:', err);
        }
    }

    /* =======================================================
       16. BROWSER NOTIFICATIONS
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
       17. REMINDER DASHBOARD
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
          <li>${r.duration} min</li>
          <li>Ref ${esc(r.id)}</li>
        </ul>
        ${!isPast ? `<span class="reminder-card__countdown">${esc(countdownLabel(r.datetime))}</span>` : ''}
        <div class="reminder-card__actions">
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
        list.addEventListener('click', (e) => {
            const editBtn = e.target.closest('[data-action="edit-reminder"]');
            if (editBtn) { startEditingReminder(editBtn.dataset.id); return; }
            const btn = e.target.closest('[data-action="remove-reminder"]');
            if (!btn) return;
            const id = btn.dataset.id;
            const timer = notificationTimers.get(id);
            if (timer) { clearTimeout(timer); notificationTimers.delete(id); }
            removeReminder(id);
            deleteFromServer(id);
            renderReminders();
            toast('Reminder removed.', 'success');
        });
        renderReminders();
        rescheduleAllNotifications();
        setInterval(renderReminders, 60000);
    }

    /* =======================================================
       18. SCHEDULE FORM
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
            nameEl.focus(); return;
        }
        const key = 'custom_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32);
        if (!key || key === 'custom_') {
            $('#custom-name-error').textContent = 'Use at least one letter or number.'; return;
        }
        const all = getAllVariations();
        if (all[key]) {
            $('#custom-name-error').textContent = 'You already have a variation with this name.'; return;
        }
        const custom = {
            label: name, emoji, tag: 'Custom',
            blurb: `Your own custom ${name} session.`,
            duration, intensity: 'Custom',
            api: { param: 'type', value: 'cardio' },
            fallback: (ex) => ex.category === 'cardio',
            wgerCategory: categoryId, wgerFallbackId: null,
            isCustom: true
        };
        const list = loadCustomVariations();
        list[key] = custom;
        saveCustomVariations(list);
        closeCustomModal();
        populateVariationSelect();
        const select = $('#variation');
        if (select) { select.value = key; select.dispatchEvent(new Event('change')); }
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
                if (foot) foot.innerHTML = `${items.length} exercises · <strong>${esc(sourceLabel(source))}</strong> · ${wgerCount} matched photos`;
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
            btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending your reminder…';
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

        async function updateWeather() {
            if (!form.date.value || !form.time.value) return;
            const w = await fetchWeatherAt(form.date.value, form.time.value);
            renderWeatherChip(w);
        }
        form.date.addEventListener('change', updateWeather);
        form.time.addEventListener('change', updateWeather);

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
                name: titleCase(ex.name),
                type: titleCase(ex.type),
                muscle: titleCase(ex.muscle),
                equipment: titleCase(ex.equipment),
                difficulty: titleCase(ex.difficulty),
                instructions: ex.instructions || '',
                image: ex.image || ''
            }));

            data.quote = await fetchDailyQuote();
            data.weather = await fetchWeatherAt(data.date, data.time);

            try {
                await requestNotificationPermission();
                if (data.isUpdate) updateReminder(data);
                else addReminder(data);
                renderReminders();
                scheduleBrowserNotification(data);

                const result = await scheduleOnServer(data);
                if (result && result.status === 'error') {
                    throw new Error(result.message || 'The Apps Script backend returned an error.');
                }

                showStatus('success',
                    `<strong>Reminder ${data.isUpdate ? 'updated' : 'set'}, ${esc(data.name.split(' ')[0])}!</strong>
                     <p>${esc(data.variationLabel)} on <strong>${esc(formatLongDate(data.date))}</strong>
                     at <strong>${esc(formatTime(data.time))}</strong>.
                     A confirmation email with the PDF is on its way to <strong>${esc(data.email)}</strong>.</p>
                     <span class="booking-id">${esc(data.id)}</span>`);

                toast('Reminder scheduled — check your inbox.', 'success');

                form.reset();
                setEditMode(form, null);
                try { sessionStorage.removeItem(PENDING_CUSTOMIZATION_KEY); } catch (_) {}
                clearInvalid(form);
                if (dateInput) dateInput.min = todayISO();
                const chip = form.parentElement.querySelector('.weather-chip');
                if (chip) chip.remove();

                const select = $('#variation');
                if (select) select.dispatchEvent(new Event('change'));
            } catch (err) {
                console.error('[FitPulse] Scheduling failed:', err);
                showStatus('error',
                    `<strong>We couldn't send your reminder.</strong>
                     <p>${esc(err.message || 'Unexpected error.')} Your reminder is still saved locally with reference <strong>${esc(data.id)}</strong>.</p>`);
                toast('Something went wrong. Please try again.', 'error');
            } finally {
                setSubmitting(false);
            }
        });
    }

    /* =======================================================
       19. SHARED CHROME
       ======================================================= */
    function initNav() {
        const nav = $('#nav');
        if (!nav) return;
        const onScroll = () => nav.classList.toggle('nav--scrolled', window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* =======================================================
       20. BOOT
       ======================================================= */
    function init() {
        initNav();
        const page = document.body.dataset.page;

        if (page === 'home') {
            renderVariationGrid();
            initVariationActions();
            renderHeroQuote();
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
        getAllVariations,
        loadCustomVariations,
        saveCustomVariations,
        fetchDailyQuote,
        fetchWeatherAt,
        VARIATIONS,
        loadReminders,
        clearCache: () => { cache.clear(); wgerCache.clear(); detailCache.clear(); },
        config: CONFIG
    };
})();