'use strict';

const rateLimit = require('express-rate-limit');

/** Create a rate limiter instance */
function makeLimiter(configService, max) {
  if (process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_DISABLED === 'true') {
    return (_req, _res, next) => next();
  }
  const windowMs = configService.getSync('rate_limit', 'global_window_ms', 900000);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  });
}

/** Exported factory — called from server.js with configService dependency */
function makeRateLimiters(configService) {
  const globalMax = configService.getSync('rate_limit', 'global_max', 100);
  const writeMax = configService.getSync('rate_limit', 'write_max', 30);
  const globalLimiter = makeLimiter(configService, globalMax);
  const writeLimiter = makeLimiter(configService, writeMax);
  return { globalLimiter, writeLimiter };
}

module.exports = { makeLimiter, makeRateLimiters };
