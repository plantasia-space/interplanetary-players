import { defineConfig } from 'vite'
import restart from 'vite-plugin-restart'

export default defineConfig({
    base: '/', // Set to '/' to match the deployment root
    root: '.', // Root directory where index.html is located
    publicDir: 'public', // Serve static assets from 'public' folder
    server: {
        host: true, 
        open: true,
        proxy: {
            '/api': {
                target: 'http://local.plantasia.space', // nginx on port 80
                changeOrigin: true,
                secure: false
            }
        },
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
    },
    plugins: [
        restart({
            restart: ['public/**'],
        }),
    ],
})
