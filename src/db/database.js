const DB_NAME = 'neuralbox_app';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

const KEY_SETTINGS = 'settings';
const KEY_CONVERSATIONS = 'conversations';
const KEY_MODEL_SELECTION = 'model_selection';
const KEY_RAG_DOCS = 'rag_docs';
const KEY_MIGRATION = 'migration_v1_local_storage';

let backend = null;
let initPromise = null;
const memoryStore = new Map();

function safeParseJson(raw, fallback) {
    if (typeof raw !== 'string') return fallback;
    try {
        return JSON.parse(raw);
    } catch (_err) {
        return fallback;
    }
}

function canUseIndexedDb() {
    try {
        return typeof globalThis.indexedDB !== 'undefined';
    } catch (_err) {
        return false;
    }
}

function getLocalStorage() {
    try {
        return globalThis.localStorage || null;
    } catch (_err) {
        return null;
    }
}

function canUseLocalStorage() {
    const storage = getLocalStorage();
    if (!storage) return false;
    const probeKey = '__neuralbox_storage_probe__';
    try {
        storage.setItem(probeKey, '1');
        storage.removeItem(probeKey);
        return true;
    } catch (_err) {
        return false;
    }
}

function openIndexedDb() {
    return new Promise((resolve, reject) => {
        const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);

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
        const storage = getLocalStorage();
        if (!storage) return null;
        try {
            return safeParseJson(storage.getItem(`db:${key}`), null);
        } catch (err) {
            console.warn('[DB] localStorage read failed:', err);
            return null;
        }
    }

    function lsSet(key, value) {
        const storage = getLocalStorage();
        if (!storage) return;
        try {
            storage.setItem(`db:${key}`, JSON.stringify(value));
        } catch (err) {
            console.warn('[DB] localStorage write failed:', err);
        }
    }

    return {
        type: 'localstorage',
        get: async (key) => lsGet(key),
        set: async (key, value) => lsSet(key, value),
    };
}

function createMemoryBackend() {
    return {
        type: 'memory',
        get: async (key) => memoryStore.get(key) || null,
        set: async (key, value) => {
            memoryStore.set(key, value);
        },
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

    if (canUseLocalStorage()) {
        backend = createLocalStorageBackend();
        return backend;
    }

    console.warn('[DB] Persistent browser storage unavailable, falling back to in-memory session storage.');
    backend = createMemoryBackend();
    return backend;
}

async function migrateLegacyLocalStorage() {
    const store = await ensureBackend();
    const migrated = await store.get(KEY_MIGRATION);
    if (migrated?.done) return;

    const storage = getLocalStorage();
    if (!canUseLocalStorage() || !storage) {
        await store.set(KEY_MIGRATION, { done: true, at: new Date().toISOString(), source: 'none' });
        return;
    }

    const legacySettings = safeParseJson(storage.getItem('neuralbox_settings'), null);
    const legacyConversations = safeParseJson(storage.getItem('neuralbox_conversations'), null);
    const legacyMessages = safeParseJson(storage.getItem('neuralbox_messages'), null);
    const legacyModelSelection = storage.getItem('neuralbox_model_selection') || storage.getItem('neuralbox_model');

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
    try {
        const store = await initDatabase();
        const value = await store.get(KEY_SETTINGS);
        return value && typeof value === 'object' ? value : {};
    } catch (err) {
        console.warn('[DB] Failed to load settings:', err);
        return {};
    }
}

export async function saveSettingsRecord(settings) {
    try {
        const store = await initDatabase();
        const safe = settings && typeof settings === 'object' ? settings : {};
        await store.set(KEY_SETTINGS, safe);
    } catch (err) {
        console.warn('[DB] Failed to save settings:', err);
    }
}

export async function loadConversationsRecord() {
    try {
        const store = await initDatabase();
        const value = await store.get(KEY_CONVERSATIONS);
        return Array.isArray(value) ? value : [];
    } catch (err) {
        console.warn('[DB] Failed to load conversations:', err);
        return [];
    }
}

export async function saveConversationsRecord(conversations) {
    try {
        const store = await initDatabase();
        await store.set(KEY_CONVERSATIONS, Array.isArray(conversations) ? conversations : []);
    } catch (err) {
        console.warn('[DB] Failed to save conversations:', err);
    }
}

export async function loadModelSelectionRecord() {
    try {
        const store = await initDatabase();
        const value = await store.get(KEY_MODEL_SELECTION);
        return typeof value === 'string' ? value : null;
    } catch (err) {
        console.warn('[DB] Failed to load model selection:', err);
        return null;
    }
}

export async function saveModelSelectionRecord(selectionId) {
    try {
        const store = await initDatabase();
        if (typeof selectionId !== 'string') return;
        await store.set(KEY_MODEL_SELECTION, selectionId);
    } catch (err) {
        console.warn('[DB] Failed to save model selection:', err);
    }
}

export async function loadRagDocsRecord() {
    try {
        const store = await initDatabase();
        const value = await store.get(KEY_RAG_DOCS);
        return Array.isArray(value) ? value : [];
    } catch (err) {
        console.warn('[DB] Failed to load RAG docs:', err);
        return [];
    }
}

export async function saveRagDocsRecord(docs) {
    try {
        const store = await initDatabase();
        await store.set(KEY_RAG_DOCS, Array.isArray(docs) ? docs : []);
    } catch (err) {
        console.warn('[DB] Failed to save RAG docs:', err);
    }
}
