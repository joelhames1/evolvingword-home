import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    // three.js is most of the weight; keep it in its own cached file.
    rollupOptions: {
      // The home page, and the owner's page for choosing which worlds show.
      input: { main: 'index.html', owner: 'owner.html' },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/postprocessing/')) return 'post';
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
