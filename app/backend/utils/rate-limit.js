'use strict';

function makeLimiter(max) {
  if (process.env.NODE_ENV === 'test' || process.env.RATE_LIMIT_DISABLED === 'true') {
    return (_req, _res, next) => next();
  }
  const rateLimit = require('express-rate-limit');
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }
  });
}

const globalLimiter = makeLimiter(100);
const writeLimiter = makeLimiter(30);

module.exports = { globalLimiter, writeLimiter };
