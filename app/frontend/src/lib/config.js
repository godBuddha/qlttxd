import { API_BASE } from './api.js';

const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Fetch a category of config from /api/v1/config?category=<cat>
 * Returns an array of { id, category, key, value, is_secret }.
 */
export async function fetchConfig(category, options = {}) {
  const { maxAttempts = MAX_RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/config?category=${encodeURIComponent(category)}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Fetch all config categories at once.
 * Returns an object keyed by category: { [category]: [{ key, value, ... }] }
 */
export async function fetchAllConfigs(options = {}) {
  const categories = ['system', 'workflow', 'appearance', 'notification', 'security'];
  const results = {};
  for (const cat of categories) {
    try {
      results[cat] = await fetchConfig(cat, options);
    } catch {
      results[cat] = [];
    }
  }
  return results;
}

/**
 * Get a single config value by category and key.
 * Returns the value or fallback if not found.
 */
export async function getConfigValue(category, key, fallback = null) {
  const items = await fetchConfig(category);
  const item = items.find((i) => i.key === key);
  return item ? item.value : fallback;
}

/**
 * Fetch workflow states from /api/v1/workflow/states
 * This endpoint is public (no auth required).
 * Returns array of state objects or fallback static list.
 */
export async function fetchWorkflowStates(options = {}) {
  const { maxAttempts = MAX_RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/workflow/states`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      // Handle both flat array and paginated response shapes
      return Array.isArray(data) ? data : (data.data || []);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Fetch workflow transitions from /api/v1/workflow/transitions
 * This endpoint is public (no auth required).
 * Returns transition matrix or fallback static object.
 */
export async function fetchWorkflowTransitions(options = {}) {
  const { maxAttempts = MAX_RETRY_ATTEMPTS, delayMs = RETRY_DELAY_MS } = options;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${API_BASE}/api/v1/workflow/transitions`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      // Handle both flat array and paginated response shapes
      const raw = Array.isArray(data) ? data : (data.data || []);
      // Convert flat array to lookup object { [from_state]: [to_states] }
      const transitions = {};
      for (const t of raw) {
        const from = t.from_state || t.trang_thai_tu;
        const to = t.to_state || t.trang_thai_den;
        if (from && to) {
          if (!transitions[from]) transitions[from] = [];
          if (!transitions[from].includes(to)) {
            transitions[from].push(to);
          }
        }
      }
      return transitions;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError;
}

/**
 * Fetch the config schema from /api/v1/config/schema
 * Returns validation schema object.
 */
export async function fetchConfigSchema() {
  try {
    const response = await fetch(`${API_BASE}/api/v1/config/schema`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch {
    return null;
  }
}
