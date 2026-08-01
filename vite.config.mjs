import { defineConfig } from 'vite';

export default defineConfig({
  // Serve the ui/ directory as the web root so index.html & admin.html
  // are available directly at http://localhost:5173/
  root: 'ui',

  server: {
    port: 5173,
    open: '/admin.html',   // Auto-open admin panel on `npm run dev`
    strictPort: false,      // Fall back to next free port automatically
  },

  // Production build outputs to project-root/dist/
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
