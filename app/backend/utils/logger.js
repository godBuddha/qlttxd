'use strict';
const crypto = require('node:crypto');

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'info'] || 1;

function log(level, message, meta = {}) {
  if (LOG_LEVELS[level] < currentLevel) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta
  };
  const output = level === 'error' ? process.stderr : process.stdout;
  output.write(JSON.stringify(entry) + '\n');
}

const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};

function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - start;
    logger.info('request', {
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: duration,
      request_id: req.requestId,
      ip: req.ip,
    });
    originalEnd.apply(res, args);
  };
  next();
}

module.exports = { logger, requestLogger };
