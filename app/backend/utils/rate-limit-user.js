'use strict';
const rateLimit = require('express-rate-limit');

const userLimiter = (process.env.NODE_ENV === 'test')
  ? ((_req, _res, next) => next())
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip,
      validate: { ip: false },
      message: { error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.' }
    });

module.exports = { userLimiter };
