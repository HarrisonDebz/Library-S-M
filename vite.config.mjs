import { defineConfig } from 'vite';

export default defineConfig({
  // Serve the ui/ directory as the web root so index.html & admin.html
  // are available directly at http://localhost:5173/
  root: 'ui',

  server: {
    port: 5173,
    open: '/index.html',   // Auto-open public status landing page on `npm run dev`
    strictPort: false,      // Fall back to next free port automatically
  },

  // Production build outputs to project-root/dist/
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'ui/index.html',
        admin: 'ui/admin.html',
      },
    },
  },
});
