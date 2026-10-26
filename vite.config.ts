import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'vite-hmr-suppressor',
        transformIndexHtml: {
          order: 'pre',
          handler() {
            return [
              {
                tag: 'script',
                attrs: { type: 'text/javascript' },
                children: `
                  (function() {
                    if (typeof window === 'undefined') return;
                    var RealWebSocket = window.WebSocket;
                    if (!RealWebSocket) return;

                    function DummyHmrWebSocket(url) {
                      var target = new EventTarget();
                      target.url = String(url || '');
                      target.readyState = 1;
                      target.bufferedAmount = 0;
                      target.extensions = '';
                      target.protocol = 'vite-hmr';
                      target.binaryType = 'blob';
                      target.onopen = null;
                      target.onclose = null;
                      target.onerror = null;
                      target.onmessage = null;
                      target.send = function() {};
                      target.close = function() {
                        target.readyState = 3;
                        var ev = new Event('close');
                        ev.wasClean = true;
                        ev.code = 1000;
                        target.dispatchEvent(ev);
                        if (typeof target.onclose === 'function') target.onclose(ev);
                      };

                      setTimeout(function() {
                        var openEv = new Event('open');
                        target.dispatchEvent(openEv);
                        if (typeof target.onopen === 'function') target.onopen(openEv);
                      }, 0);

                      return target;
                    }

                    function InterceptedWebSocket(url, protocols) {
                      var isViteHmr = 
                        protocols === 'vite-hmr' ||
                        (Array.isArray(protocols) && protocols.indexOf('vite-hmr') !== -1) ||
                        (typeof url === 'string' && (url.indexOf('vite-hmr') !== -1 || (url.indexOf('token=') !== -1 && url.indexOf(':3000') !== -1)));

                      if (isViteHmr) {
                        return DummyHmrWebSocket(url);
                      }
                      if (protocols !== undefined) {
                        return new RealWebSocket(url, protocols);
                      }
                      return new RealWebSocket(url);
                    }

                    InterceptedWebSocket.prototype = RealWebSocket.prototype;
                    InterceptedWebSocket.CONNECTING = 0;
                    InterceptedWebSocket.OPEN = 1;
                    InterceptedWebSocket.CLOSING = 2;
                    InterceptedWebSocket.CLOSED = 3;

                    window.WebSocket = InterceptedWebSocket;
                  })();
                `,
                injectTo: 'head-prepend',
              },
            ];
          },
        },
      },
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
        'chart.js',
        'xlsx',
        'papaparse',
        'html-to-image',
        'fast-xml-parser',
        'motion',
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
      minify: false,
      cssCodeSplit: true,
      rollupOptions: {
        maxParallelFileOps: 2,
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/three') || id.includes('node_modules/@react-three')) {
              return 'vendor-three';
            }
            if (id.includes('node_modules/bpmn-js') || id.includes('node_modules/camunda-bpmn-moddle') || id.includes('node_modules/@bpmn-io')) {
              return 'vendor-bpmn';
            }
            if (id.includes('node_modules/xlsx') || id.includes('node_modules/papaparse') || id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
              return 'vendor-docs';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/chart.js')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/@mui') || id.includes('node_modules/@emotion')) {
              return 'vendor-mui';
            }
          },
        },
      },
    },
  };
});
