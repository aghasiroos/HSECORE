import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { config } from './server/core/config.ts';
import { logger } from './server/core/logger.ts';
import { correlationIdMiddleware } from './server/core/middleware/correlationId.ts';
import { securityHeadersMiddleware, corsMiddleware } from './server/core/middleware/security.ts';
import { standardRateLimiter } from './server/core/middleware/rateLimiter.ts';
import { errorHandlerMiddleware } from './server/core/middleware/errorHandler.ts';
import { createApiRouter } from './server/routes/api.router.ts';
import { requireAuth, requireRole } from './server/core/middleware/auth.ts';
import { startWorkers } from './server/modules/process-management/worker.ts';
import { startAutomationWorker } from './server/services/automation/automationWorker.ts';
import { weatherService } from './server/weather/service.ts';
import { evaluateAndDispatchHeatStressWebhook } from './server/services/webhookDispatcher.ts';
import { monitoringService } from './server/modules/monitoring/monitoring.service.ts';
import { openApiSpec } from './server/modules/monitoring/openapi.doc.ts';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { socketService } from './server/core/socket.ts';

dotenv.config();

// Global System Version Details - Injected via environment or CI/CD
const APP_VERSION = process.env.APP_VERSION || '0.2.8';
const BUILD_ID = process.env.BUILD_ID || '20260913-001';
const RELEASE_ID = process.env.RELEASE_ID || 'dev-release';

import * as dbServices from './server/db-services.ts';
export { runMigrations } from './server/migrate.ts';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.APP_PORT || process.env.PORT) || 3000;

  const runStartupMigrations = async () => {
    try {
      const { runMigrations } = await import('./server/migrate.ts');
      if (typeof runMigrations === 'function') {
        await runMigrations();
      }
      const { preloadSettingsCache } = await import('./server/routes/settings.router.ts');
      await preloadSettingsCache();
    } catch (err) {
      logger.error('Error running migrations:', err);
      if (process.env.STRICT_DB_STARTUP === 'true') {
        throw err;
      }
    }
  };

  if (process.env.STRICT_DB_STARTUP === 'true') {
    await runStartupMigrations();
  } else {
    void runStartupMigrations();
  }

  // Trust proxy configuration strictly reflecting actual deployment architecture:
  // The Node.js application runs directly behind exactly one local Nginx reverse proxy layer (1 hop).
  const trustProxySetting = process.env.TRUST_PROXY !== undefined
    ? (process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY === 'false' ? false : !isNaN(Number(process.env.TRUST_PROXY)) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY)
    : 1; // Exactly 1 hop (Nginx reverse proxy)
  app.set('trust proxy', trustProxySetting);

  // Platform & Container Health Check (MUST be first, unmetered, returning JSON)
  app.get(['/api/health', '/health'], async (req, res) => {
    try {
      const health = await monitoringService.getDbHealth();
      const statusCode = req.query.strict === 'true' && health.status !== 'healthy' ? 503 : 200;
      res.status(statusCode).json({ status: health.status === 'healthy' ? 'ok' : 'degraded', database: health.status });
    } catch {
      res.status(200).json({ status: 'degraded', database: 'initializing' });
    }
  });

  // 1. Fundamental Infrastructure Middleware
  app.use(correlationIdMiddleware);
  app.use(securityHeadersMiddleware);
  app.use(corsMiddleware);
  app.use(compression({
    threshold: 1024,
    level: 6,
    filter: (req, res) => {
      if (
        req.headers['x-no-compression'] ||
        req.originalUrl.includes('/files/') ||
        req.originalUrl.startsWith('/uploads/')
      ) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Apply rate limiter to API routes only to avoid blocking Vite assets/modules
  app.use('/api', standardRateLimiter);

  // 2. Structured Request Logging Middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      const logData = {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        correlationId: (req as any).correlationId,
        ip: req.ip,
      };
      // Filter out noisy routine background polling, telemetry/audit writes, socket.io transports, and dev module requests
      const isRoutineRead = (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') && res.statusCode < 400;
      const isRoutinePollingOrAsset = 
        req.originalUrl.startsWith('/socket.io') ||
        req.originalUrl.startsWith('/api/system/version') || 
        req.originalUrl.startsWith('/api/system/status') ||
        req.originalUrl.startsWith('/health') || 
        req.originalUrl.startsWith('/api/health') ||
        req.originalUrl.startsWith('/api/audit-logs') ||
        req.originalUrl.startsWith('/api/v1/audit-logs') ||
        req.originalUrl.startsWith('/api/weather') ||
        req.originalUrl.startsWith('/api/reverse-geocode') ||
        req.originalUrl.startsWith('/api/ip-location') ||
        req.originalUrl.startsWith('/api/v1/automation/outbox') ||
        req.originalUrl.startsWith('/api/v1/automation/logs') ||
        req.originalUrl.startsWith('/@vite') ||
        req.originalUrl.startsWith('/@fs') ||
        req.originalUrl.startsWith('/@id') ||
        req.originalUrl.startsWith('/src/');

      if (res.statusCode >= 500) {
        logger.error('HTTP 5xx Server Error', logData, logData.correlationId);
      } else if (res.statusCode >= 400) {
        if (!isRoutinePollingOrAsset && res.statusCode !== 401 && res.statusCode !== 404) {
          logger.warn('HTTP 4xx Client Warning', logData, logData.correlationId);
        }
      } else if (durationMs > 4000 && !isRoutinePollingOrAsset) {
        logger.warn('Slow HTTP Request Detected', logData, logData.correlationId);
      } else if ((!isRoutineRead && !isRoutinePollingOrAsset) || process.env.DEBUG_LOGS === 'true') {
        logger.debug('HTTP Request Completed', logData, logData.correlationId);
      }
    });
    next();
  });

  // 3. Container & Kubernetes Detailed Health Checks
  app.get(['/health/detailed', '/api/monitoring/health'], async (req, res) => {
    const health = await monitoringService.getOverallHealth();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  });

  app.get('/health/db', async (req, res) => {
    const dbHealth = await monitoringService.getDbHealth();
    res.status(dbHealth.status === 'healthy' ? 200 : 503).json(dbHealth);
  });

  app.get('/health/services', async (req, res) => {
    const services = await monitoringService.getServicesHealth();
    res.json({ success: true, data: services });
  });

  // System Version & Status Endpoints
  app.get('/api/system/version', (req, res) => {
    res.json({
      version: APP_VERSION,
      buildId: BUILD_ID,
      releaseId: RELEASE_ID,
      updatedAt: new Date().toISOString(),
      minClientVersion: '0.2.0',
    });
  });

  app.get('/api/system/status', async (req, res) => {
    const dbHealth = await monitoringService.getDbHealth();
    res.json({
      version: APP_VERSION,
      buildId: BUILD_ID,
      releaseId: RELEASE_ID,
      database: dbHealth.status,
      realtime: 'connected', // Reflected in UI
      lastDeployment: new Date().toISOString(),
    });
  });

  app.get('/openapi.json', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res) => {
    res.json(openApiSpec);
  });

  // 4. Weather Services (Preserved Full Capabilities)
  app.get('/api/weather', async (req, res) => {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : 30.471003;
      const lon = req.query.lon ? parseFloat(req.query.lon as string) : 49.090324;
      const locationId = req.query.locationId ? String(req.query.locationId) : undefined;
      const provider = req.query.provider ? String(req.query.provider) : undefined;
      const clientTs = req.query.clientTs ? Number(req.query.clientTs) : Date.now();
      const clientTz = req.query.clientTz ? String(req.query.clientTz) : undefined;
      const tzOffsetMin = req.query.tzOffsetMin ? Number(req.query.tzOffsetMin) : undefined;
      const bypassCache = req.query.refresh !== 'false';

      const weatherData = await weatherService.getWeather(
        { lat, lon, locationId, clientTs, clientTz, tzOffsetMin },
        provider,
        bypassCache
      );
      if (weatherData && typeof weatherData.wbgt === 'number') {
        void evaluateAndDispatchHeatStressWebhook({
          stationId: locationId || `${lat.toFixed(3)},${lon.toFixed(3)}`,
          locationName: weatherData.locationName,
          wbgt: weatherData.wbgt,
          temperature: weatherData.tempC,
          humidity: weatherData.hum,
          windSpeed: weatherData.wind,
          riskLevel: weatherData.cat || 'Normal',
          provider: weatherData.provider,
          measuredAt: weatherData.observedAt || weatherData.fetchedAt,
        });
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(weatherData);
    } catch (err: any) {
      logger.warn('Weather service unavailable across all real providers', { error: err?.message });
      res.status(503).json({
        error: true,
        code: 'WEATHER_SERVICE_UNAVAILABLE',
        message: 'عدم دسترسی به سرویس هواشناسی معتبر یا قطع ارتباط شبکه. اطلاعات آزمایشی نمایش داده نمی‌شود.',
        details: err?.message || 'All weather providers unreachable'
      });
    }
  });

  app.get('/api/weather/providers', (req, res) => {
    res.json({
      active: weatherService.getAllProviders(),
      cache: weatherService.getCacheStats(),
    });
  });

  app.get('/api/weather/compare', async (req, res) => {
    try {
      const lat = req.query.lat ? parseFloat(req.query.lat as string) : 30.471003;
      const lon = req.query.lon ? parseFloat(req.query.lon as string) : 49.090324;
      const query = req.query.query ? String(req.query.query) : undefined;
      const clientTs = req.query.clientTs ? Number(req.query.clientTs) : Date.now();
      const clientTz = req.query.clientTz ? String(req.query.clientTz) : undefined;
      const tzOffsetMin = req.query.tzOffsetMin ? Number(req.query.tzOffsetMin) : undefined;
      const comparison = await weatherService.compareSources({ lat, lon, query, clientTs, clientTz, tzOffsetMin });
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.json(comparison);
    } catch (err: any) {
      res.status(500).json({
        error: true,
        message: err?.message || 'Comparison failed'
      });
    }
  });

  app.post('/api/weather/cache/clear', requireAuth, requireRole('ADMIN', 'ADMINISTRATOR', 'HSE_MANAGER'), (req, res) => {
    weatherService.clearCache();
    res.json({ status: 'ok', message: 'Weather cache cleared' });
  });

  const KNOWN_INDUSTRIAL_HUBS = [
    { lat: 30.471, lon: 49.090, city: 'منطقه ویژه اقتصادی پتروشیمی', locality: 'بندر امام خمینی', countryName: 'Iran' },
    { lat: 27.481, lon: 52.617, city: 'منطقه ویژه اقتصادی پارس جنوبی', locality: 'عسلویه', countryName: 'Iran' },
    { lat: 27.147, lon: 56.126, city: 'منطقه ویژه صنایع فلزی و پتروشیمی', locality: 'بندرعباس', countryName: 'Iran' },
    { lat: 35.539, lon: 51.425, city: 'پتروشیمی و پالایشگاه تهران', locality: 'شهر ری', countryName: 'Iran' },
    { lat: 30.551, lon: 49.198, city: 'بندر ماهشهر', locality: 'خوزستان', countryName: 'Iran' },
    { lat: 30.339, lon: 48.304, city: 'پالایشگاه آبادان', locality: 'آبادان', countryName: 'Iran' },
    { lat: 31.320, lon: 48.683, city: 'مناطق نفت‌خیز جنوب', locality: 'اهواز', countryName: 'Iran' },
  ];

  app.get('/api/reverse-geocode', async (req, res) => {
    const latNum = parseFloat(req.query.lat as string);
    const lonNum = parseFloat(req.query.lon as string);

    if (!isNaN(latNum) && !isNaN(lonNum)) {
      const match = KNOWN_INDUSTRIAL_HUBS.find(h => 
        Math.abs(h.lat - latNum) < 0.08 && Math.abs(h.lon - lonNum) < 0.08
      );
      if (match) {
        return res.json({
          ...match,
          displayName: `${match.locality} - ${match.city}`
        });
      }
    }

    try {
      const [nomRes, bdcRes] = await Promise.all([
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latNum}&lon=${lonNum}&accept-language=fa`, {
          headers: { 'User-Agent': 'HSECoreEnterprise/3.2' },
          signal: AbortSignal.timeout(3500)
        }).catch(() => null),
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latNum}&longitude=${lonNum}&localityLanguage=fa`, {
          signal: AbortSignal.timeout(3500)
        }).catch(() => null)
      ]);

      if (nomRes && nomRes.ok) {
        const nomData = await nomRes.json();
        const addr = nomData?.address || {};
        const locality = addr.suburb || addr.Industrial || addr.neighbourhood || addr.town || addr.village || addr.city_district || '';
        const city = addr.city || addr.county || addr.state || nomData?.name || '';
        const countryName = addr.country || 'ایران';
        const combined = [locality, city].filter(Boolean).join('، ') || nomData?.display_name?.split('،')?.slice(0, 2)?.join('،') || 'موقعیت شناسایی‌شده';
        return res.json({
          city: city || combined,
          locality: locality || city,
          countryName,
          displayName: combined
        });
      }

      if (bdcRes && bdcRes.ok) {
        const data = await bdcRes.json();
        const city = data.city || data.locality || data.principalSubdivision || 'موقعیت فعلی';
        const locality = data.locality || data.city || '';
        return res.json({
          ...data,
          city,
          locality,
          displayName: locality && locality !== city ? `${city}، ${locality}` : city
        });
      }

      throw new Error('Reverse geocode providers unreachable');
    } catch {
      res.json({ city: 'ایستگاه پایش محیطی', locality: `${latNum.toFixed(4)}, ${lonNum.toFixed(4)}`, countryName: 'ایران' });
    }
  });

  app.get('/api/ip-location', async (req, res) => {
    try {
      const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
      const isPublicIp = forwarded && !forwarded.startsWith('10.') && !forwarded.startsWith('192.168.') && !forwarded.startsWith('127.') && !forwarded.startsWith('169.254.') && !forwarded.startsWith('172.');
      const ipQuery = isPublicIp ? forwarded : '';

      const ipwhoUrl = ipQuery ? `https://ipwho.is/${encodeURIComponent(ipQuery)}` : 'https://ipwho.is/';
      const r1 = await fetch(ipwhoUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (r1 && r1.ok) {
        const d1 = await r1.json();
        if (d1 && d1.success !== false && typeof d1.latitude === 'number' && typeof d1.longitude === 'number') {
          return res.json({
            lat: d1.latitude,
            lon: d1.longitude,
            city: d1.city || d1.region || 'موقعیت اینترنتی',
            region: d1.region || '',
            countryName: d1.country || '',
            ip: d1.ip || ipQuery,
            source: 'Internet IP Geolocation'
          });
        }
      }

      const ipApiUrl = ipQuery ? `http://ip-api.com/json/${encodeURIComponent(ipQuery)}?lang=fa` : 'http://ip-api.com/json/?lang=fa';
      const r2 = await fetch(ipApiUrl, { signal: AbortSignal.timeout(4000) }).catch(() => null);
      if (r2 && r2.ok) {
        const d2 = await r2.json();
        if (d2 && d2.status === 'success' && typeof d2.lat === 'number' && typeof d2.lon === 'number') {
          return res.json({
            lat: d2.lat,
            lon: d2.lon,
            city: d2.city || d2.regionName || 'موقعیت اینترنتی',
            region: d2.regionName || '',
            countryName: d2.country || '',
            ip: d2.query || ipQuery,
            source: 'Internet IP Geolocation'
          });
        }
      }

      return res.status(503).json({ error: true, message: 'عدم امکان استخراج موقعیت از شبکه اینترنت' });
    } catch (e: any) {
      return res.status(503).json({ error: true, message: e?.message || 'IP geolocation failed' });
    }
  });

  app.get('/api/geocode', async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || String(query).trim().length === 0) {
        return res.json({ results: [] });
      }

      const qStr = String(query).trim().toLowerCase();
      // Match known Iranian industrial hubs locally first
      const matchedHubs = KNOWN_INDUSTRIAL_HUBS.filter(h => 
        h.city.toLowerCase().includes(qStr) || 
        h.locality.toLowerCase().includes(qStr)
      ).map(h => ({
        id: Math.round(h.lat * 1000),
        name: `${h.locality} (${h.city})`,
        latitude: h.lat,
        longitude: h.lon,
        country: 'Iran',
        country_code: 'IR'
      }));

      if (matchedHubs.length > 0) {
        return res.json({ results: matchedHubs });
      }

      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(String(query))}&count=6&language=en`;
      const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const data = await response.json();
      res.json(data);
    } catch {
      res.json({ results: [] });
    }
  });

  // 5. Master Unified Modular Monolith API Router
  app.use('/api', createApiRouter());

  // 6.5. Explicit 404 JSON Handler for API requests (Prevents HTML index.html fallback for broken/unmatched API calls)
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `سرویس درخواستی (${req.method} ${req.path}) در سرور یافت نشد.`,
      },
    });
  });

  // 7. Serve uploads and pdfjs assets securely
  const uploadsDir = config.security.uploadDir;
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', dotfiles: 'ignore' }));
  } catch {
    // Fallback if host mount is restricted
  }
  const { resolveWritableUploadDir } = await import('./server/modules/files/file.service.ts');
  const activeUploadsDir = resolveWritableUploadDir();
  if (activeUploadsDir !== uploadsDir) {
    app.use('/uploads', express.static(activeUploadsDir, { maxAge: '7d', dotfiles: 'ignore' }));
  }
  
  const publicDir = path.resolve(process.cwd(), 'public');
  if (fs.existsSync(publicDir)) {
    app.use('/pdfjs', express.static(path.join(publicDir, 'pdfjs'), { maxAge: '30d', immutable: true }));
    app.use('/assets/aistudio', express.static(path.join(publicDir, 'assets', 'aistudio'), { maxAge: '7d' }));
  }

  // 8. Start Background Workers
  try {
    startWorkers();
    logger.info('Process Management background workers started successfully');
    startAutomationWorker();
    logger.info('HSECORE Internal Automation Engine worker started successfully');
  } catch (err) {
    logger.warn('Process workers initialization note', { error: err });
  }

  // 9. Vite Frontend Integration with proper Cache-Control
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const localDist = path.resolve(__dirname);
    const distPath = fs.existsSync(path.join(cwdDist, 'index.html')) ? cwdDist : localDist;

    logger.info(`Serving production assets from: ${distPath}`);
    
    // API routes should not be cached
    app.use('/api', (req, res, next) => {
      res.setHeader('Cache-Control', 'no-store');
      next();
    });

    // Hash versioned assets can be cached aggressively
    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y', // 31536000 seconds
      immutable: true,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));

    // Other static files (except index.html and service worker)
    app.use(express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('sw.js') || filePath.endsWith('service-worker.js')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (!filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day fallback
        }
      }
    }));

    // Main HTML entry point should NEVER be cached to enable Automatic Client Updates
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
      } else {
        res.status(404).send('HSE Application: index.html not found. Please ensure project build succeeded.');
      }
    });
  }

  // 10. Central Application Error Handler
  app.use(errorHandlerMiddleware);

  // 11. Start Server on Port 3000 and Initialize WebSockets
  const server = app.listen(PORT, config.host, () => {
    logger.info(`[HSE Enterprise Platform] Modular Monolith Server running on http://${config.host}:${PORT}`);
  });

  // Attach Socket.IO to HTTP Server
  try {
    socketService.initialize(server);
  } catch (err) {
    logger.error('Failed to initialize Socket.IO', err);
  }
}

// Global process resilience handlers to protect dev server pre-warming
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception caught gracefully:', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection caught gracefully:', reason);
});

startServer().catch((err) => {
  logger.error('Failed to start server', err);
  process.exit(1);
});
