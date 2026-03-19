const DB_NAME = 'neuralbox_app';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

const KEY_SETTINGS = 'settings';
const KEY_CONVERSATIONS = 'conversations';
const KEY_MODEL_SELECTION = 'model_selection';
const KEY_MIGRATION = 'migration_v1_local_storage';

let backend = null;
let initPromise = null;

function safeParseJson(raw, fallback) {
    if (typeof raw !== 'string') return fallback;
    try {
        return JSON.parse(raw);
    } catch (_err) {
        return fallback;
    }
}

function canUseIndexedDb() {
    return typeof indexedDB !== 'undefined';
}

function canUseLocalStorage() {
    return typeof localStorage !== 'undefined';
}

function openIndexedDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
    });
}

async function createIndexedDbBackend() {
    const db = await openIndexedDb();

    function read(key) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error || new Error(`Failed to read key: ${key}`));
        });
    }

    function write(key, value) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error(`Failed to write key: ${key}`));
        });
    }

    return {
        type: 'indexeddb',
        get: read,
        set: write,
    };
}

function createLocalStorageBackend() {
    function lsGet(key) {
        if (!canUseLocalStorage()) return null;
        return safeParseJson(localStorage.getItem(`db:${key}`), null);
    }

    function lsSet(key, value) {
        if (!canUseLocalStorage()) return;
        localStorage.setItem(`db:${key}`, JSON.stringify(value));
    }

    return {
        type: 'localstorage',
        get: async (key) => lsGet(key),
        set: async (key, value) => lsSet(key, value),
    };
}

async function ensureBackend() {
    if (backend) return backend;

    if (canUseIndexedDb()) {
        try {
            backend = await createIndexedDbBackend();
            return backend;
        } catch (err) {
            console.warn('[DB] IndexedDB unavailable, falling back to localStorage:', err);
        }
    }

    backend = createLocalStorageBackend();
    return backend;
}

async function migrateLegacyLocalStorage() {
    const store = await ensureBackend();
    const migrated = await store.get(KEY_MIGRATION);
    if (migrated?.done) return;

    if (!canUseLocalStorage()) {
        await store.set(KEY_MIGRATION, { done: true, at: new Date().toISOString(), source: 'none' });
        return;
    }

    const legacySettings = safeParseJson(localStorage.getItem('neuralbox_settings'), null);
    const legacyConversations = safeParseJson(localStorage.getItem('neuralbox_conversations'), null);
    const legacyMessages = safeParseJson(localStorage.getItem('neuralbox_messages'), null);
    const legacyModelSelection = localStorage.getItem('neuralbox_model_selection') || localStorage.getItem('neuralbox_model');

    if (legacySettings && typeof legacySettings === 'object') {
        await store.set(KEY_SETTINGS, legacySettings);
    }

    if (Array.isArray(legacyConversations) && legacyConversations.length > 0) {
        await store.set(KEY_CONVERSATIONS, legacyConversations);
    } else if (Array.isArray(legacyMessages) && legacyMessages.length > 0) {
        const now = Date.now();
        const seedConversation = {
            id: `legacy_${now}`,
            title: String(legacyMessages?.[0]?.content || 'Migrated conversation').slice(0, 40),
            messages: legacyMessages,
            pinned: false,
            createdAt: now,
            updatedAt: now,
        };
        await store.set(KEY_CONVERSATIONS, [seedConversation]);
    }

    if (legacyModelSelection) {
        await store.set(KEY_MODEL_SELECTION, legacyModelSelection);
    }

    await store.set(KEY_MIGRATION, {
        done: true,
        at: new Date().toISOString(),
        source: 'legacy_local_storage',
    });
}

export async function initDatabase() {
    if (!initPromise) {
        initPromise = (async () => {
            await ensureBackend();
            await migrateLegacyLocalStorage();
            return backend;
        })();
    }
    return initPromise;
}

export async function loadSettingsRecord() {
    const store = await initDatabase();
    const value = await store.get(KEY_SETTINGS);
    return value && typeof value === 'object' ? value : {};
}

export async function saveSettingsRecord(settings) {
    const store = await initDatabase();
    const safe = settings && typeof settings === 'object' ? settings : {};
    await store.set(KEY_SETTINGS, safe);
}

export async function loadConversationsRecord() {
    const store = await initDatabase();
    const value = await store.get(KEY_CONVERSATIONS);
    return Array.isArray(value) ? value : [];
}

export async function saveConversationsRecord(conversations) {
    const store = await initDatabase();
    await store.set(KEY_CONVERSATIONS, Array.isArray(conversations) ? conversations : []);
}

export async function loadModelSelectionRecord() {
    const store = await initDatabase();
    const value = await store.get(KEY_MODEL_SELECTION);
    return typeof value === 'string' ? value : null;
}

export async function saveModelSelectionRecord(selectionId) {
    const store = await initDatabase();
    if (typeof selectionId !== 'string') return;
    await store.set(KEY_MODEL_SELECTION, selectionId);
}

