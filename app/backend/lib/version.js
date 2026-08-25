// Single source of truth for the application version (HC-06).
// Reads once from the backend package.json at require time.
const pkg = require('../package.json');

const APP_VERSION = pkg.version || 'dev';

module.exports = { APP_VERSION };
