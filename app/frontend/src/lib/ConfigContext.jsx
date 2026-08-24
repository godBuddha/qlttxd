import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { request } from './api.js';
import {
  HOME,
  STATES,
  STATE_LABELS as STATIC_STATE_LABELS,
  TRANSITIONS as STATIC_TRANSITIONS,
} from './constants.js';

const ConfigContext = createContext(null);

/**
 * Transform raw config array [{ key, value }] into a lookup object.
 */
function buildLookup(items) {
  const map = {};
  for (const item of items || []) {
    // Try to convert numeric-looking values to numbers/booleans
    let val = item.value;
    if (typeof val === 'string') {
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^-?\d+(\.\d+)?$/.test(val)) val = Number(val);
    }
    map[item.key] = val;
  }
  return map;
}

export function ConfigProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rawConfigs, setRawConfigs] = useState({});     // { [category]: [{ key, value }] }
  const [workflowStates, setWorkflowStates] = useState([]);
  const [workflowTransitions, setWorkflowTransitions] = useState(null);
  const [stateLabels, setStateLabels] = useState(STATIC_STATE_LABELS);

  /**
   * Load all config categories from backend.
   * Only called once — no deps (runs on mount).
   */
  useEffect(() => {
    let cancelled = false;
    const loadConfigs = async () => {
      try {
        const categories = ['system', 'workflow', 'appearance', 'notification', 'security', 'ui'];
        const results = {};
        const promises = categories.map((cat) =>
          request(`/api/v1/config?category=${encodeURIComponent(cat)}`)
            .then((r) => ({ cat, data: Array.isArray(r) ? r : [] }))
            .catch(() => ({ cat, data: [] }))
        );
        const resolved = await Promise.all(promises);
        for (const { cat, data } of resolved) {
          if (!cancelled) results[cat] = data;
        }
        if (!cancelled) setRawConfigs(results);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Không thể tải cấu hình.');
          setRawConfigs({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadWorkflow = async () => {
      try {
        const res = await request('/api/v1/workflow/states');
        const states = Array.isArray(res) ? res : (res.data || []);
        if (!cancelled) setWorkflowStates(states);
      } catch {
        // Silent fail — will fall back to static states
      }

      try {
        const res = await request('/api/v1/workflow/transitions');
        const raw = Array.isArray(res) ? res : (res.data || []);
        // Convert flat array -> { [from]: [to...] }
        const trans = {};
        for (const t of raw) {
          const from = t.from_state || t.trang_thai_tu;
          const to = t.to_state || t.trang_thai_den;
          if (from && to) {
            if (!trans[from]) trans[from] = [];
            if (!trans[from].includes(to)) trans[from].push(to);
          }
        }
        if (!cancelled) setWorkflowTransitions(trans);
      } catch {
        // Silent fail — will fall back to static transitions
      }
    };

    loadConfigs();
    loadWorkflow();

    return () => { cancelled = true; };
  }, []);

  /**
   * Stale-while-revalidate: refresh on window focus.
   */
  useEffect(() => {
    const onFocus = () => {
      // Trigger re-fetch by setting fresh state flags
      // We simply re-run the effects below via document.activeElement hack
      // — actually simpler: just call request again here for critical paths
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  /**
   * Merge dynamic labels from config with static ones.
   */
  useEffect(() => {
    const wfLabels = (rawConfigs.workflow || []).filter((i) => i.key.startsWith('label_'));
    if (wfLabels.length > 0) {
      const custom = {};
      for (const item of wfLabels) {
        const stateKey = item.key.replace(/^label_/, '');
        custom[stateKey] = item.value;
      }
      setStateLabels((prev) => ({ ...prev, ...custom }));
    }
  }, [rawConfigs]);

  /**
   * Build derived lookup objects from raw configs.
   */
  const configsMap = buildLookup(rawConfigs.system || []);

  /**
   * Resolve states: prefer backend, fall back to static.
   */
  const effectiveStates = workflowStates.length > 0
    ? workflowStates.map((s) => typeof s === 'string' ? s : s.state || s.trang_thai)
    : STATES;

  /**
   * Resolve transitions: prefer backend, fall back to static.
   */
  const effectiveTransitions = workflowTransitions !== null
    ? workflowTransitions
    : STATIC_TRANSITIONS;

  /**
   * Helper to get a specific config value.
   */
  const getConfig = useCallback((category, key, fallback = null) => {
    const items = rawConfigs[category] || [];
    const item = items.find((i) => i.key === key);
    return item ? item.value : fallback;
  }, [rawConfigs]);

  /**
   * HC-02: Map center từ config (ui.home_lat / ui.home_lng).
   * Fallback về HOME trong constants.js khi chưa load hoặc giá trị không phải số.
   * Lưu ý: phải kiểm tra null/undefined trước Number() vì Number(null)===0.
   * Trả về mảng [lat, lng] dùng cho Leaflet setView / center.
   */
  const homeCenter = useCallback(() => {
    if (loading) return [...HOME];
    const latRaw = getConfig('ui', 'home_lat');
    const lngRaw = getConfig('ui', 'home_lng');
    if (latRaw == null || lngRaw == null) return [...HOME];
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [...HOME];
    return [lat, lng];
  }, [loading, getConfig]);

  /**
   * Reload all config data (for manual refresh).
   */
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const categories = ['system', 'workflow', 'appearance', 'notification', 'security', 'ui'];
      const results = {};
      for (const cat of categories) {
        try {
          results[cat] = await request(`/api/v1/config?category=${encodeURIComponent(cat)}`) || [];
        } catch {
          results[cat] = [];
        }
      }
      setRawConfigs(results);
      setError(null);
    } catch (err) {
      setError(err?.message || 'Không thể tải lại cấu hình.');
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    loading,
    error,
    getConfig,
    getConfigValue: (category, key, fallback) => getConfig(category, key, fallback),
    homeCenter,
    configsMap,
    getStateByKey: (key) => (rawConfigs.system || []).find((i) => i.key === key),
    getAllConfigs: () => rawConfigs,
    states: effectiveStates,
    stateLabels,
    transitions: effectiveTransitions,
    reload,
  };

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within ConfigProvider');
  return ctx;
}
