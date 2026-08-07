'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const { secret } = require('../utils/helpers');

module.exports = function thongBaoRoutes({ pool, authenticate, tokenBlocklist }) {
  const router = express.Router();

  // POST /api/v1/thong-bao/sse-token — issue short-lived SSE token (60s) for EventSource
  // Requires valid access token in Authorization/X-Auth-Token header
  router.post('/api/v1/thong-bao/sse-token', authenticate, async (req, res, next) => {
    try {
      // Issue a short-lived token specifically for SSE stream
      // This token has type 'sse' and expires in 60 seconds
      const sseToken = jwt.sign(
        { id: req.user.id, type: 'sse', scope: 'thong-bao/stream' },
        secret(),
        { expiresIn: '60s', jwtid: crypto.randomUUID() }
      );
      res.json({ token: sseToken, expiresIn: 60 });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/v1/thong-bao — list notifications for current user (paginated)
  router.get('/api/v1/thong-bao', authenticate, async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const page = Math.max(Number(req.query.page) || 1, 1);
      const offset = (page - 1) * limit;
      const r = await pool.query(
        `SELECT id, ho_so_id, loai, tieu_de, noi_dung, trang_thai, created_at
         FROM thong_bao WHERE nguoi_nhan_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [req.user.id, limit, offset]
      );
      const count = await pool.query(
        'SELECT count(*)::int AS total FROM thong_bao WHERE nguoi_nhan_id=$1',
        [req.user.id]
      );
      res.json({ data: r.rows, total: count.rows[0].total, page, limit });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/v1/thong-bao/stream — Server-Sent Events: push new notifications live
  // Note: EventSource API cannot send custom headers, so a short-lived SSE token is passed as a
  // query param. This token MUST have type 'sse' and scope 'thong-bao/stream'. Regular access
  // tokens are rejected to prevent long-lived tokens leaking into logs/proxy/history.
  router.get('/api/v1/thong-bao/stream', async (req, res) => {
    let user;
    try {
      const token = req.query.token;
      if (!token) throw new Error('missing token');
      const decoded = jwt.verify(token, secret());
      // Only accept SSE tokens with correct type and scope
      if (decoded.type !== 'sse' || decoded.scope !== 'thong-bao/stream') {
        return res.status(401).json({ error: 'Loại token không hợp lệ cho SSE stream' });
      }
      if (await tokenBlocklist.has(decoded.jti))
        {return res.status(401).json({ error: 'Mã xác thực đã bị thu hồi' });}
      user = decoded;
    } catch {
      return res.status(401).json({ error: 'Mã xác thực không hợp lệ hoặc đã hết hạn' });
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write(': connected\n\n');

    // Cursor: last pushed timestamp. thong_bao.id is a UUID (no natural ordering),
    // so we track position by created_at. The frontend dedupes by id, so a tiny
    // overlap on equal timestamps is harmless.
    let cursor =
      req.query.after && /^\d{4}-\d{2}-\d{2}/.test(req.query.after)
        ? new Date(req.query.after).toISOString()
        : new Date(0).toISOString();
    try {
      const maxRes = await pool.query(
        'SELECT COALESCE(MAX(created_at), to_timestamp(0)) AS ts FROM thong_bao WHERE nguoi_nhan_id=$1',
        [user.id]
      );
      const ts = maxRes.rows[0].ts ? new Date(maxRes.rows[0].ts).toISOString() : cursor;
      if (ts > cursor) cursor = ts;
    } catch {
      return res.status(500).json({ error: 'Không thể khởi tạo kết nối thông báo' });
    }

    // Poll for new notifications for THIS user (portal channel) and push them.
    const poll = async () => {
      try {
        const r = await pool.query(
          `SELECT id, ho_so_id, loai, tieu_de, noi_dung, trang_thai, created_at
             FROM thong_bao
            WHERE nguoi_nhan_id=$1 AND kenh='portal' AND created_at > $2
            ORDER BY created_at ASC
            LIMIT 50`,
          [user.id, cursor]
        );
        for (const row of r.rows) {
          res.write(`data: ${JSON.stringify(row)}\n\n`);
          const ts = new Date(row.created_at).toISOString();
          if (ts > cursor) cursor = ts;
        }
      } catch (e) {
        // transient DB error — keep the stream alive, retry next tick
        console.error('[thong-bao/stream] poll error:', e.message);
      }
    };

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        cleanup();
      }
    }, 30000);
    const pollTimer = setInterval(() => poll().catch(() => {}), 5000);
    poll().catch(() => {});

    let closed = false;
    function cleanup() {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      clearInterval(pollTimer);
      res.end();
    }
    req.on('close', cleanup);
    res.on('close', cleanup);
  });

  // GET /api/v1/thong-bao/unread-count
  router.get('/api/v1/thong-bao/unread-count', authenticate, async (req, res, next) => {
    try {
      const r = await pool.query(
        "SELECT count(*)::int AS count FROM thong_bao WHERE nguoi_nhan_id=$1 AND trang_thai='da_gui'",
        [req.user.id]
      );
      res.json({ count: r.rows[0].count });
    } catch (e) {
      next(e);
    }
  });

  // POST /api/v1/thong-bao/:id/mark-read
  router.post('/api/v1/thong-bao/:id/mark-read', authenticate, async (req, res, next) => {
    try {
      const r = await pool.query(
        "UPDATE thong_bao SET trang_thai='da_doc' WHERE id=$1 AND nguoi_nhan_id=$2 RETURNING id",
        [req.params.id, req.user.id]
      );
      if (!r.rows[0]) return res.status(404).json({ error: 'Không tìm thấy thông báo' });
      res.json({ message: 'Đã đánh dấu đã đọc' });
    } catch (e) {
      next(e);
    }
  });

  // POST /api/v1/thong-bao/mark-all-read
  router.post('/api/v1/thong-bao/mark-all-read', authenticate, async (req, res, next) => {
    try {
      await pool.query(
        "UPDATE thong_bao SET trang_thai='da_doc' WHERE nguoi_nhan_id=$1 AND trang_thai='da_gui'",
        [req.user.id]
      );
      res.json({ message: 'Đã đánh dấu tất cả đã đọc' });
    } catch (e) {
      next(e);
    }
  });

  return router;
};
