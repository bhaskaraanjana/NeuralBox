import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        basicSsl(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['logo-512.png', 'logo-192.png'],
            manifest: {
                name: 'NeuralBox',
                short_name: 'NeuralBox',
                description: 'Private AI that runs entirely in your browser. No server, no sign-up.',
                theme_color: '#070b11',
                background_color: '#070b11',
                display: 'standalone',
                orientation: 'portrait-primary',
                start_url: '/',
                icons: [
                    {
                        src: '/logo-192.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                    {
                        src: '/logo-512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable',
                    },
                ],
            },
            workbox: {
                // Only pre-cache the lightweight app shell — NOT the large ML bundles
                globPatterns: ['**/*.{css,html,ico,png,svg,woff,woff2}', 'assets/index-*.js', 'assets/whisper-*.js'],
                // Explicitly exclude large ML model bundles and wasm files
                globIgnores: ['**/node_modules/**', '**/*.wasm', '**/webllm-*.js', '**/transformers-*.js'],
                navigateFallback: 'index.html',
                // Raise the size limit for anything that slips through (default 2 MiB → 10 MiB)
                maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
                runtimeCaching: [
                    {
                        // Cache Google Fonts
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-cache',
                            expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
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
