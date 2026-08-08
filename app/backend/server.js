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

// M-13: request timeout middleware — tránh request treo vô hạn (default 30s)
function requestTimeout(ms = 30000) {
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

function buildApp({ pool }) {
  if (!secret() || secret().length < 32) {
    throw new Error('JWT_SECRET phải được cấu hình tối thiểu 32 ký tự');
  }
  const tokenBlocklist = new TokenBlocklist({ pool });
  // H-11: dọn reset_token định kỳ (timer unref không giữ process sống)
  new ResetTokenCleanup({ pool });
  // #9: dọn user_tokens cũ hơn 30 ngày định kỳ
  new UserTokensCleanup({ pool });
  // H-08: dọn audit_log >20 năm — archive file nén rồi xóa, chạy tự động hàng ngày
  const auditRetention = new AuditRetention({
    pool,
    retentionDays: Number(process.env.AUDIT_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS,
  });
  // CONFIG-T3: khởi tạo ConfigService cho hệ thống config + workflow
  const { ConfigService } = require('./lib/config-service');
  const configService = new ConfigService();
  // Fire-and-forget startup — nếu DB chưa sẵn sàng thì get() fallback env/param,
  // cache sẽ được populate khi start hoàn tất (tương tự auditRetention.start()).
  configService.start(pool).catch(err => console.error('[ConfigService] Lỗi khởi động:', err.message));
  const authenticateWithBlocklist = makeAuthenticate(tokenBlocklist);
  const app = express();
  // Tin cậy proxy để req.ip trả về IP thật qua X-Forwarded-For khi behind proxy (C-03)
  app.set('trust proxy', process.env.TRUST_PROXY || 1);
  const corsOrigin = process.env.CORS_ORIGIN;
  const allowedOrigins = corsOrigin ? corsOrigin.split(',').map((x) => x.trim()) : [];

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Auth-Token,X-Request-Id');
      res.setHeader('Access-Control-Max-Age', '86400');
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
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10kb' }));
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
    if (!csrfCookie) return next(); // No CSRF cookie = first visit or different domain, allow

    // Get CSRF token from header
    const csrfHeader = req.get('x-csrf-token');

    // Check Origin header for cross-site requests
    const origin = req.get('origin');
    const host = req.get('host');
    const isCrossSite = origin && host && !origin.includes(host);

    // For cross-site requests, require matching CSRF header
    // For same-site requests, the cookie is sent automatically (sameSite: lax)
    if (isCrossSite) {
      if (!csrfHeader || csrfHeader !== csrfCookie) {
        return res.status(403).json({ error: 'CSRF token không hợp lệ hoặc thiếu header x-csrf-token' });
      }
    }

    next();
  });

  // Compression — but never compress Server-Sent Events: buffering would hold
  // pushed events and corrupt live streaming. Skip the /thong-bao/stream path.
  const compression = require('compression');
  app.use(
    compression({
      filter: (req, res) => {
        if (req.path.startsWith('/api/v1/thong-bao/stream')) return false;
        return compression.filter(req, res);
      },
    })
  );

  const { globalLimiter, writeLimiter } = require('./utils/rate-limit');
  const { userLimiter } = require('./utils/rate-limit-user');
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
      hsts: { maxAge: 31536000, includeSubDomains: true },
    })
  );

  // Shared deps for route modules
  const deps = {
    pool,
    tokenBlocklist,
    authenticate: authenticateWithBlocklist,
    authorize,
    configService,
  };

  // Write rate limiter for state-changing methods
  app.use((req, res, next) => {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
      return writeLimiter(req, res, next);
    }
    next();
  });
  app.use(userLimiter);

  // M-13: timeout toàn cục cho mọi request (default 30s)
  app.use(requestTimeout(Number(process.env.REQUEST_TIMEOUT_MS) || 30000));

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

  // H-08: khởi động AuditRetention (cleanup khi start + định kỳ hàng ngày)
  auditRetention.start();

  return app;
}

function createPool() {
  return new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD || undefined,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
}
if (require.main === module) {
  const pool = createPool();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  const app = buildApp({ pool });
  const server = app.listen(port, host, () =>
    console.log(`QLTTXD API đang nghe tại http://${host}:${port}`)
  );
  const shutdown = (signal) => {
    console.log(`[server] Received ${signal}, shutting down gracefully...`);
    // Stop ConfigService notify listener
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
    }, 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
module.exports = {
  buildApp,
  createPool,
  authenticate,
  authorize,
  requestTimeout,
  coordinate: require('./utils/helpers').coordinate,
  TokenBlocklist,
  ResetTokenCleanup,
  UserTokensCleanup,
};
