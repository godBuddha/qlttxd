'use strict';

/**
 * HC-01 (Settings Center Wave 0): parse a jsonwebtoken-style TTL string
 * ('45s', '30m', '12h', '7d') into an integer number of SECONDS.
 *
 * Used to keep refresh_tokens.expires_at in sync with the JWT expiry signed
 * with expiresIn = cfg.getSync('auth', 'jwt_refresh_ttl', '7d'), so that
 * changing the TTL in Settings Center no longer drifts the two apart.
 *
 * Units: s=1, m=60, h=3600, d=86400.
 * Anything that does not match /^([0-9]+)([smhd])$/ throws a clear Error.
 *
 * @param {string} ttl - TTL string, e.g. '7d'
 * @returns {number} integer seconds
 * @throws {Error} when the input is not a valid TTL string
 */
function ttlToSeconds(ttl) {
  const match = typeof ttl === 'string' ? ttl.match(/^([0-9]+)([smhd])$/) : null;
  if (!match) {
    throw new Error(
      `Invalid TTL '${ttl}': expected format <number><s|m|d> (e.g. '45s', '30m', '12h', '7d')`
    );
  }
  const value = Number(match[1]);
  const unitSeconds = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return value * unitSeconds;
}

module.exports = { ttlToSeconds };
