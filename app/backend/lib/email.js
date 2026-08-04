'use strict';

const nodemailer = require('nodemailer');

/**
 * Email wrapper cho QLTTXD.
 * Tạo transporter từ env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.
 * Nếu SMTP_HOST không được cấu hình → trả null (fallback: chỉ in-app).
 */
function createTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.warn('[email] SMTP_HOST chưa cấu hình — bỏ qua gửi email, chỉ gửi in-app.');
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  return transporter;
}

/**
 * Gửi email.
 * @param {object} opts
 * @param {import('nodemailer').Transporter} opts.transporter
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.html
 * @returns {Promise<boolean>} true nếu gửi thành công
 */
async function sendEmail({ transporter, to, subject, html }) {
  if (!transporter) return false;
  const from = process.env.SMTP_FROM || `QLTTXD <no-reply@${process.env.SMTP_HOST}>`;
  await transporter.sendMail({ from, to, subject, html });
  return true;
}

/**
 * Kiểm tra SMTP có sẵn sàng không.
 * @returns {boolean}
 */
function isSmtpConfigured() {
  return !!process.env.SMTP_HOST;
}

module.exports = { createTransporter, sendEmail, isSmtpConfigured };
