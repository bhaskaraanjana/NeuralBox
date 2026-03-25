import { defineConfig } from 'vite';

export default defineConfig({
    server: {
        port: 6969,
        host: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
    },
    build: {
        target: 'esnext',
    },
    optimizeDeps: {
        exclude: ['@mlc-ai/web-llm'],
    },
});
