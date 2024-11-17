import { defineConfig } from 'vite';
import restart from 'vite-plugin-restart';

export default defineConfig({
    base: '/', // Ensure this matches the deployment root
    root: '.', // Root directory where index.html is located
    publicDir: 'public', // Static assets directory
    server: {
        host: true,
        open: true,
    },
    build: {
        outDir: 'dist', // Ensure the output is `dist`
        emptyOutDir: true,
        sourcemap: true,
    },
    plugins: [
        restart({
            restart: ['public/**'],
        }),
    ],
});