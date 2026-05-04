import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
    plugins: [basicSsl()],
    server: {
        port: 6969,
        host: true,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        },
        watch: {
            ignored: ['**/*.md'],
        },
    },
    build: {
        target: 'esnext',
        rollupOptions: {
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
