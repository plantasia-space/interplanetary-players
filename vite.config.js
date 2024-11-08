// vite.config.js

import { defineConfig } from 'vite'
import restart from 'vite-plugin-restart'

export default defineConfig({
    root: '.', // Root directory where index.html is located
    publicDir: 'public', // Serve static assets from 'public' folder
    server: {
        host: true, // Make server accessible over the local network
        open: true, // Automatically open the app in the browser on server start
    },
    build: {
        outDir: 'dist', // Output directory for the build
        emptyOutDir: true, // Empty the output directory before building
        sourcemap: true, // Generate sourcemaps for debugging
    },
    plugins: [
        restart({
            restart: ['public/**'], // Restart server on changes in the public folder
        }),
    ],
})
