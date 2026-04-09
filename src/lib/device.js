function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

const GPU_VRAM_NAME_HINTS = [
    { pattern: /rtx 5090/i, vramMB: 32768 },
    { pattern: /rtx 4090|rtx 6000 ada|rtx a6000/i, vramMB: 24576 },
    { pattern: /rtx 5080|rtx 4080/i, vramMB: 16384 },
    { pattern: /rtx 5070|rtx 4070 ti|rtx 4070 super/i, vramMB: 12288 },
    { pattern: /rtx 4070|rtx 3080|rtx 2080 ti/i, vramMB: 10240 },
    { pattern: /rtx 3070|rtx 4060 ti|rtx 3060 ti|rtx 2080|rtx a4000/i, vramMB: 8192 },
    { pattern: /rtx 4060|rtx 3060|rtx 2070|rtx 2060|gtx 1080 ti|radeon rx 6700/i, vramMB: 8192 },
    { pattern: /gtx 1660|gtx 1070|radeon rx 6600|radeon rx 7600|arc a770/i, vramMB: 6144 },
    { pattern: /arc a750|arc a580|gtx 1060|radeon rx 580/i, vramMB: 6144 },
];

export function inferGpuClass(gpuName = '') {
    const lower = String(gpuName || '').toLowerCase();
    if (!lower) return 'unknown';
    if (
        /uhd|iris|intel\(r\) hd|intel\(r\) uhd|intel\(r\) iris|radeon\(tm\) graphics|vega \d/i.test(lower)
    ) {
        return 'integrated';
    }
    if (/nvidia|rtx|gtx|radeon rx|rx \d{3,4}|arc a\d{3}/i.test(lower)) {
        return 'discrete';
    }
    return 'unknown';
}

export function estimateGpuVramFromName(gpuName = '') {
    const lower = String(gpuName || '').toLowerCase();
    if (!lower) return null;
    for (const hint of GPU_VRAM_NAME_HINTS) {
        if (hint.pattern.test(lower)) return hint.vramMB;
    }
    if (/rtx 30\d{2}/i.test(lower)) return 8192;
    if (/rtx 40\d{2}/i.test(lower)) return 8192;
    if (/gtx 16\d{2}/i.test(lower)) return 6144;
    if (/radeon rx/i.test(lower)) return 8192;
    if (/arc a\d{3}/i.test(lower)) return 8192;
    return null;
}

export function estimateVramMB({ adapterLimitMB = 0, gpuName = '', deviceMemGB = 0, gpuClass = 'unknown' } = {}) {
    const hintedByNameMB = estimateGpuVramFromName(gpuName);

    let estimatedMB = Number(adapterLimitMB || 0);
    let source = 'adapter_limits';

    const fallbackByMemoryMB = gpuClass === 'integrated'
        ? clamp(Math.round(Math.max(4, Number(deviceMemGB || 4)) * 256), 1024, 4096)
        : clamp(Math.round(Math.max(4, Number(deviceMemGB || 8)) * 512), 3072, 12288);

    if (!estimatedMB || estimatedMB < 768) {
        estimatedMB = fallbackByMemoryMB;
        source = 'device_memory_fallback';
    }

    if (hintedByNameMB && estimatedMB < Math.round(hintedByNameMB * 0.65)) {
        estimatedMB = hintedByNameMB;
        source = 'gpu_name_hint';
    } else if (gpuClass === 'discrete' && estimatedMB < 3072) {
        estimatedMB = Math.max(estimatedMB, 6144);
        source = 'discrete_floor';
    } else if (gpuClass === 'integrated' && estimatedMB < 1024) {
        estimatedMB = Math.max(estimatedMB, 2048);
        source = 'integrated_floor';
    }

    return {
        vramMB: Math.round(estimatedMB),
        source,
    };
}

export function getDeviceTier(vramMB = 0) {
    const value = Number(vramMB || 0);
    if (value >= 6000) return 'premium';
    if (value >= 3000) return 'performance';
    if (value >= 1500) return 'standard';
    return 'lite';
}
