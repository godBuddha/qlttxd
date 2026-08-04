'use strict';

const jwt = require('jsonwebtoken');
const { secret } = require('./helpers');

function makeAuthenticate(blocklist) {
  return async function authenticate(req, res, next) {
    const value = req.get('authorization') || ''; const bearerToken = value.startsWith('Bearer ') ? value.slice(7) : null;
    const xAuthToken = req.get('x-auth-token');
    const token = bearerToken || xAuthToken;
    if (!token) return res.status(401).json({ error: 'Thiếu mã xác thực' });
    try {
      const decoded = jwt.verify(token, secret());
      if (await blocklist.has(decoded.jti)) return res.status(401).json({ error: 'Mã xác thực đã bị thu hồi' });
      req.user = decoded;
      return next();
    } catch { return res.status(401).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' }); }
  };
}

// backward-compatible default (no blocklist) for tests that import authenticate directly
const authenticate = makeAuthenticate({ async has() { return false; } });

function authorize(...permissions) {
  return (req, res, next) => permissions.some((p) => req.user.permissions.includes(p))
    ? next() : res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này' });
}

module.exports = { makeAuthenticate, authenticate, authorize };
