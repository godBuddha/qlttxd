require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const { Pool } = require('pg');
const { TokenBlocklist } = require('./token-blocklist');
const { ResetTokenCleanup } = require('./reset-token-cleanup');
const { UserTokensCleanup } = require('./user-tokens-cleanup');
const { AuditRetention, DEFAULT_RETENTION_DAYS } = require('./jobs/audit-retention');

const { secret } = require('./utils/helpers');
const { makeAuthenticate, authenticate, authorize } = require('./utils/middleware');
const cookie = require('cookie');

// M-13: request timeout middleware — tránh request treo vô hạn
function requestTimeout(ms) {
  return (req, res, next) => {
    req.setTimeout(ms);
    res.setTimeout(ms, () => {
      if (!res.headersSent) {
        res.status(408).json({ error: 'Yêu cầu quá thời gian chờ' });
      }
    });
    next();
  };
}

// Route modules
const authRoutes = require('./routes/auth');
const danhMucRoutes = require('./routes/danh-muc');
const baoCaoRoutes = require('./routes/bao-cao');
const hoSoRoutes = require('./routes/ho-so');
const thongKeRoutes = require('./routes/thong-ke');
const adminUsersRoutes = require('./routes/admin-users');
const adminLocationsRoutes = require('./routes/admin-locations');
const adminCatalogsRoutes = require('./routes/admin-catalogs');
const thongBaoRoutes = require('./routes/thong-bao');
const banDoRoutes = require('./routes/ban-do');
const docsRoutes = require('./routes/docs');
const configRoutes = require('./routes/config');

function createPool(configService) {
  const cs = { getSync: configService ? configService.getSync.bind(configService) : _fallback => undefined };
  return new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD || undefined,
    max: cs.getSync('pool', 'max', 20) ?? 20,
    idleTimeoutMillis: cs.getSync('pool', 'idle_timeout_ms', 30000) ?? 30000,
    connectionTimeoutMillis: cs.getSync('pool', 'connect_timeout_ms', 5000) ?? 5000,
  });
}

/** Build App Factory */
module.exports.buildApp = function buildApp({ pool, configService }) {
  // Ensure JWT_SECRET is set (random fallback if missing)
  secret();

  // CONFIG-T4a: Lightweight sync config reader (cache|env|fallback only)
  const cfg = {
    getSync(cat, key, fb) {
      if (configService && typeof configService.getSync === 'function') {
        return configService.getSync(cat, key, fb);
      }
      // Pure-fallback no-op (tests may not supply configService)
      return fb;
    },
  };

  // ── Pre-create shared deps (before app instantiation) ──
  const tokenBlocklist = new TokenBlocklist({ pool, configService });
  new ResetTokenCleanup({ pool, configService });
  new UserTokensCleanup({ pool, configService });

  // Wave 1 (HC-03): retention days come from Settings Center DB only
  const auditRetention = new AuditRetention({
    pool,
    configService,
    retentionDays: Number(cfg.getSync('audit', 'retention_days', 7300)),
  });

  const { ConfigService } = require('./lib/config-service');
  if (!configService) {
    configService = new ConfigService();
    configService.start(pool).catch(err => console.error('[ConfigService] Lỗi khởi động:', err.message));
  }

  const authenticateWithBlocklist = makeAuthenticate(tokenBlocklist);

  const app = express();
  // Tin cậy proxy để req.ip trả về IP thật qua X-Forwarded-For khi behind proxy (C-03)
  app.set('trust proxy', process.env.TRUST_PROXY || 1);
  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin ? corsOrigin.split(',').map((x) => x.trim()) : [];

  // CONFIG-T4a: runtime configs
  const reqTimeoutMs = cfg.getSync('security', 'request_timeout_ms', 30000);
  const corsMaxAgeSec = cfg.getSync('security', 'cors_max_age', 86400);
  const jsonLimit = cfg.getSync('upload', 'body_limit_json', '1mb');
  const urlLimit = cfg.getSync('upload', 'body_limit_url', '10kb');
  const hstsMaxAge = cfg.getSync('security', 'hsts_max_age', 31536000);

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Auth-Token,X-Request-Id');
      res.setHeader('Access-Control-Max-Age', String(corsMaxAgeSec));
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }
    next();
  });
  app.use((req, res, next) => {
    const requestId = req.get('X-Request-Id') || require('node:crypto').randomUUID();
    req.requestId = requestId;
    res.set({ 'X-Request-Id': requestId });
    next();
  });
  const { requestLogger } = require('./utils/logger');
  app.use(requestLogger);
  app.use(express.json({ limit: jsonLimit }));
  app.use(express.urlencoded({ extended: true, limit: urlLimit }));
  // Parse cookies from request headers
  app.use((req, res, next) => {
    req.cookies = cookie.parse(req.headers.cookie || '');
    next();
  });

  // CSRF protection middleware for state-changing requests
  // Only applies to POST/PATCH/PUT/DELETE with cookies present (cross-site check)
  app.use((req, res, next) => {
    const stateChanging = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
    if (!stateChanging) return next();

    // Get CSRF token from cookie
    const csrfCookie = req.cookies?.qlttxd_csrf;
    if (!csrfCookie) return next();

    const csrfHeader = req.get('x-csrf-token');

    const origin = req.get('origin');
    const host = req.get('host');
    const isCrossSite = origin && host && !origin.includes(host);

    if (isCrossSite) {
      if (!csrfHeader || csrfHeader !== csrfCookie) {
        return res.status(403).json({ error: 'CSRF token không hợp lệ hoặc thiếu header x-csrf-token' });
      }
    }

    next();
  });

  // Compression — but never compress SSE: buffering would hold pushed events and corrupt live streaming.
  const compression = require('compression');
  app.use(
    compression({
      filter: (req, res) => {
        if (req.path.startsWith('/api/v1/thong-bao/stream')) return false;
        return compression.filter(req, res);
      },
    })
  );

  // CONFIG-T4a: rate-limiters từ configService
  const { makeRateLimiters } = require('./utils/rate-limit');
  const { makeUserLimiter } = require('./utils/rate-limit-user');
  const { globalLimiter, writeLimiter } = makeRateLimiters(configService);
  app.use(globalLimiter);

  // Security headers via helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
          imgSrc: ["'self'", 'https://*.tile.openstreetmap.org', 'data:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: false,
      hsts: { maxAge: hstsMaxAge, includeSubDomains: true },
    })
  );

  // Shared deps for route modules
  const deps = {
    pool,
    tokenBlocklist,
    authenticate: authenticateWithBlocklist,
    authorize,
    configService,
    auditRetention,
  };

  // Write rate limiter for state-changing methods
  app.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      return writeLimiter(req, res, next);
    }
    next();
  });
  const userLimiter = makeUserLimiter(configService);
  app.use(userLimiter);

  // M-13: timeout toàn cục cho mọi request (HC-03: config only, no env override)
  app.use(requestTimeout(Number(reqTimeoutMs)));

  // Register route modules
  app.use(authRoutes(deps));
  app.use(danhMucRoutes(deps));
  app.use(baoCaoRoutes(deps));
  app.use(hoSoRoutes(deps));
  app.use(thongKeRoutes(deps));
  app.use(adminUsersRoutes(deps));
  app.use(adminLocationsRoutes(deps));
  app.use(adminCatalogsRoutes(deps));
  app.use(thongBaoRoutes(deps));
  app.use(banDoRoutes(deps));
  app.use(docsRoutes(deps));
  app.use(configRoutes(deps));

  // Store configService on app for shutdown handling
  app.configService = configService;

  app.use((error, req, res, _next) => {
    if (error instanceof require('multer').MulterError) {
      return res.status(400).json({ error: `Tải tệp thất bại: ${error.message}` });
    }
    const { logger } = require('./utils/logger');
    logger.error('unhandled', {
      request_id: req.requestId,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
  });

  // H-08: khởi động AuditRetention
  auditRetention.start();

  return app;
};

if (require.main === module) {
  const { ConfigService } = require('./lib/config-service');
  const configService = new ConfigService();
  const pool = createPool(configService);
  configService.start(pool).catch(err => console.error('[ConfigService] Lỗi khởi động:', err.message));

  const app = module.exports.buildApp({ pool, configService });

  // CONFIG-T4a: forced shutdown timer + audit retention days từ config
  const forcedShutdownMs = configService.getSync('security', 'forced_shutdown_ms', 10000);

  // Default must match docker-compose/Caddy upstream (3001)
  const port = Number(process.env.PORT || 3001);
  const host = process.env.HOST || '0.0.0.0';
  const server = app.listen(port, host, () =>
    console.log(`QLTTXD API đang nghe tại http://${host}:${port}`)
  );
  const shutdown = (signal) => {
    console.log(`[server] Received ${signal}, shutting down gracefully...`);
    if (app.configService && typeof app.configService.stop === 'function') {
      app.configService.stop();
    }
    server.close(() => {
      console.log('[server] HTTP server closed');
      pool
        .end()
        .then(() => {
          console.log('[server] Pool drained');
          process.exit(0);
        })
        .catch(() => process.exit(1));
    });
    setTimeout(() => {
      console.error('[server] Forced shutdown after 10s');
      process.exit(1);
    }, forcedShutdownMs);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// ── Named exports ──
module.exports.buildApp = module.exports.buildApp;
module.exports.createPool = createPool;
module.exports.authenticate = authenticate;
module.exports.authorize = authorize;
module.exports.requestTimeout = requestTimeout;
module.exports.coordinate = require('./utils/helpers').coordinate;
module.exports.TokenBlocklist = TokenBlocklist;
module.exports.ResetTokenCleanup = ResetTokenCleanup;
module.exports.UserTokensCleanup = UserTokensCleanup;
