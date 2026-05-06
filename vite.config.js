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
                // Only pre-cache the lightweight app shell, not the large ML bundles.
                globPatterns: ['**/*.{css,html,ico,png,svg,woff,woff2}', 'assets/index-*.js', 'assets/whisper-*.js'],
                // Large ML runtime chunks are cached after first use instead of during install.
                globIgnores: ['**/node_modules/**', '**/*.wasm', '**/webllm-*.js', '**/transformers-*.js'],
                navigateFallback: 'index.html',
                maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
                runtimeCaching: [
                    {
                        // Cache heavy same-origin ML runtime chunks after first successful online use.
                        urlPattern: ({ url, sameOrigin }) => (
                            sameOrigin &&
                            /\/assets\/(webllm|transformers)-.*\.js$/.test(url.pathname)
                        ),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'neuralbox-ml-runtime',
                            expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Cache optional same-origin runtime WASM files after first successful use.
                        urlPattern: ({ url, sameOrigin }) => (
                            sameOrigin &&
                            /\/assets\/.*\.wasm$/.test(url.pathname)
                        ),
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'neuralbox-runtime-wasm',
                            expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                    {
                        // Cache Google Fonts.
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
