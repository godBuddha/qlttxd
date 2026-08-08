'use strict';

const rateLimit = require('express-rate-limit');

/** Exported factory — called from server.js with configService dependency */
function makeUserLimiter(configService) {
  if (process.env.NODE_ENV === 'test') {
    return (_req, _res, next) => next();
  }
  const windowMs = configService.getSync('rate_limit', 'global_window_ms', 900000);
  const max = configService.getSync('rate_limit', 'user_max', 200);
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip?.replace(/^::ffff:/, ''),
    validate: { ip: false },
    message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' },
  });
}

module.exports = { makeUserLimiter };
