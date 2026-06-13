// ============================================================
// NeuralBox Studio — persisted UI state (favorites + recents)
// Reuses the app's existing IndexedDB k/v layer (localStorage fallback).
// ============================================================
import { initDatabase } from '../db/database.js';

const FAV_KEY = 'studio_favorites';
const RECENT_KEY = 'studio_recents';
const MAX_RECENT = 6;

async function read(key, fallback) {
    try {
        const db = await initDatabase();
        const v = await db.get(key);
        return v ?? fallback;
    } catch (_) {
        return fallback;
    }
}

async function write(key, value) {
    try {
        const db = await initDatabase();
        await db.set(key, value);
    } catch (_) { /* best effort */ }
}

export async function getFavorites() {
    const v = await read(FAV_KEY, []);
    return Array.isArray(v) ? v : [];
}

export async function toggleFavorite(id) {
    const favs = await getFavorites();
    const i = favs.indexOf(id);
    if (i >= 0) favs.splice(i, 1); else favs.unshift(id);
    await write(FAV_KEY, favs);
    return favs;
}

export async function getRecents() {
    const v = await read(RECENT_KEY, []);
    return Array.isArray(v) ? v : [];
}

export async function pushRecent(id) {
    const recents = await getRecents();
    const next = [id, ...recents.filter((x) => x !== id)].slice(0, MAX_RECENT);
    await write(RECENT_KEY, next);
    return next;
}
