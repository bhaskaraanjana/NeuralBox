import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
    server: {
        port: 6969,
        host: true,
        headers: {
            // Cross-origin isolation enables SharedArrayBuffer -> multi-threaded WASM
            // for transformers.js, and is required by WebLLM (WebGPU) in chat.html.
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    preview: {
        port: 6969,
        host: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            // Multi-page: the new Studio shell (index.html) + the original
            // WebLLM chat experience, preserved verbatim at chat.html.
            input: {
                main: resolve(__dirname, 'index.html'),
                chat: resolve(__dirname, 'chat.html'),
            },
            output: {
                manualChunks(id) {
                    if (id.includes('@mlc-ai/web-llm')) return 'webllm';
                    if (id.includes('@huggingface/transformers')) return 'transformers';
                },
            },
        },
    },
    optimizeDeps: {
        exclude: ['@mlc-ai/web-llm'],
    },
});
