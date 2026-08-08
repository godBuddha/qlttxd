'use strict';

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const multer = require('multer');

const DEFAULT_UPLOAD_MB = 10;
const uploadDirectory = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

/** Compute effective MAX_UPLOAD_MB env → configService → fallback */
function resolveMaxUploadMb(configService) {
  // Env override has priority (per task requirement: KEEP process.env override)
  const envVal = Number(process.env.MAX_UPLOAD_MB);
  if (!Number.isNaN(envVal)) return envVal;
  // Then configService
  if (configService && typeof configService.getSync === 'function') {
    const csVal = configService.getSync('upload', 'max_mb', DEFAULT_UPLOAD_MB);
    const parsed = Number(csVal);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
  }
  // Fallback
  return DEFAULT_UPLOAD_MB;
}

/** Create a multer upload instance with configurable max size.
 * @param {import('../lib/config-service').ConfigService} [configService]
 * @returns {{ upload: import('multer').Middleware, maxUploadMb: number }}
 */
function createUpload(configService) {
  const maxUploadMb = resolveMaxUploadMb(configService);
  const storage = multer.diskStorage({
    destination: (_req, _file, done) => done(null, uploadDirectory),
    filename: (_req, file, done) =>
      done(
        null,
        `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`
      ),
  });
  const uploadInstance = multer({
    storage,
    limits: { fileSize: maxUploadMb * 1024 * 1024 },
    fileFilter: (_req, file, done) => done(null, file.mimetype.startsWith('image/')),
  });
  return { upload: uploadInstance, maxUploadMb };
}

const { upload, maxUploadMb } = createUpload();

function hasSafeImageMagic(file) {
  const bytes = fs.readFileSync(file.path);
  return (
    (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (bytes.length >= 6 &&
      (bytes.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        bytes.subarray(0, 6).toString('ascii') === 'GIF89a')) ||
    (bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP')
  );
}

function removeUploadedFiles(files = []) {
  for (const file of files) fs.rmSync(file.path, { force: true });
}

module.exports = { upload, hasSafeImageMagic, removeUploadedFiles, uploadDirectory };
