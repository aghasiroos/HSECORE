import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'recharts',
        'leaflet',
        'lucide-react',
        'axios',
        'moment-jalaali',
        'react-hot-toast',
        'uuid',
        'idb-keyval',
        'qrcode.react',
        'xlsx',
        'html-to-image',
        'fast-xml-parser',
        'motion',
        'motion/react',
      ],
    },
    server: {
      hmr: false,
      watch: null,
    },
    build: {
      target: 'esnext',
      sourcemap: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 4000,
      minify: 'esbuild',
      cssCodeSplit: true,
      rollupOptions: {
        maxParallelFileOps: 24,
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/scheduler/')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/bpmn-js') || id.includes('node_modules/camunda-bpmn-moddle') || id.includes('node_modules/@bpmn-io')) {
              return 'vendor-bpmn';
            }
            if (id.includes('node_modules/three')) {
              return 'vendor-three';
            }
            if (id.includes('node_modules/leaflet')) {
              return 'vendor-maps';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/socket.io-client') || id.includes('node_modules/engine.io-client')) {
              return 'vendor-realtime';
            }
            if (id.includes('node_modules/moment-jalaali') || id.includes('node_modules/moment/')) {
              return 'vendor-date';
            }
            if (id.includes('node_modules/xlsx') || id.includes('node_modules/html-to-image')) {
              return 'vendor-docs';
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
          },
        },
      },
    },
  };
});
