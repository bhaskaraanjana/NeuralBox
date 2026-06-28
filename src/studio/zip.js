// ============================================================
// Tiny, dependency-free ZIP writer (STORE — no compression).
// Model outputs (PNG cutouts, WAV audio) are already compressed,
// so storing them uncompressed costs nothing and keeps this ~1 fn.
// Produces a standard .zip Blob from [{ name, data }] entries,
// where data is a Uint8Array | ArrayBuffer | Blob | string.
// ============================================================

// CRC-32 (IEEE), table built once.
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

async function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof Blob !== 'undefined' && data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
    if (typeof data === 'string') return new TextEncoder().encode(data);
    throw new Error('Unsupported zip entry data');
}

// MS-DOS date/time encoding for the (single) shared timestamp.
function dosDateTime(d = new Date()) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2));
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time: time & 0xFFFF, date: date & 0xFFFF };
}

/**
 * Build a ZIP Blob from entries.
 * @param {Array<{name: string, data: Uint8Array|ArrayBuffer|Blob|string}>} entries
 * @returns {Promise<Blob>}
 */
export async function makeZip(entries) {
    const { time, date } = dosDateTime();
    const encoder = new TextEncoder();
    const fileParts = [];   // local file header + data, in order
    const central = [];     // central directory records
    let offset = 0;         // running offset of each local header

    for (const entry of entries) {
        const nameBytes = encoder.encode(entry.name);
        const bytes = await toBytes(entry.data);
        const crc = crc32(bytes);
        const size = bytes.length;

        // ---- Local file header (30 bytes + name) ----
        const local = new Uint8Array(30 + nameBytes.length);
        const lv = new DataView(local.buffer);
        lv.setUint32(0, 0x04034b50, true);   // signature
        lv.setUint16(4, 20, true);           // version needed
        lv.setUint16(6, 0x0800, true);       // flags: UTF-8 names
        lv.setUint16(8, 0, true);            // method: STORE
        lv.setUint16(10, time, true);
        lv.setUint16(12, date, true);
        lv.setUint32(14, crc, true);
        lv.setUint32(18, size, true);        // compressed size
        lv.setUint32(22, size, true);        // uncompressed size
        lv.setUint16(26, nameBytes.length, true);
        lv.setUint16(28, 0, true);           // extra length
        local.set(nameBytes, 30);
        fileParts.push(local, bytes);

        // ---- Central directory record (46 bytes + name) ----
        const cen = new Uint8Array(46 + nameBytes.length);
        const cv = new DataView(cen.buffer);
        cv.setUint32(0, 0x02014b50, true);   // signature
        cv.setUint16(4, 20, true);           // version made by
        cv.setUint16(6, 20, true);           // version needed
        cv.setUint16(8, 0x0800, true);       // flags: UTF-8
        cv.setUint16(10, 0, true);           // method: STORE
        cv.setUint16(12, time, true);
        cv.setUint16(14, date, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, size, true);
        cv.setUint32(24, size, true);
        cv.setUint16(28, nameBytes.length, true);
        cv.setUint16(30, 0, true);           // extra length
        cv.setUint16(32, 0, true);           // comment length
        cv.setUint16(34, 0, true);           // disk number
        cv.setUint16(36, 0, true);           // internal attrs
        cv.setUint32(38, 0, true);           // external attrs
        cv.setUint32(42, offset, true);      // local header offset
        cen.set(nameBytes, 46);
        central.push(cen);

        offset += local.length + size;
    }

    const centralSize = central.reduce((n, c) => n + c.length, 0);
    const centralOffset = offset;

    // ---- End of central directory (22 bytes) ----
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);       // signature
    ev.setUint16(4, 0, true);                // disk number
    ev.setUint16(6, 0, true);                // disk with central dir
    ev.setUint16(8, entries.length, true);   // entries on this disk
    ev.setUint16(10, entries.length, true);  // total entries
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, centralOffset, true);
    ev.setUint16(20, 0, true);               // comment length

    return new Blob([...fileParts, ...central, end], { type: 'application/zip' });
}

/** Make a filename safe for a zip entry / download (strip path separators). */
export function safeName(name, fallback = 'file') {
    const base = String(name || fallback).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
    return base || fallback;
}
