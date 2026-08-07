import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { HOME, STATE_LABELS } from '../lib/constants.js';
import { errorText } from '../lib/api.js';
import { Loading } from '../components/Loading.jsx';

// Marker colour per status. Colours are decoration only — status is always
// conveyed as text via the legend + sr-only table (WCAG 1.4.1).
const MARKER_COLORS = {
  cho_tiep_nhan: '#1f6feb',
  cho_xac_minh: '#6e40c9',
  dang_xac_minh: '#bf8700',
  cho_bo_sung: '#d4a72c',
  cho_lap_bien_ban: '#da3633',
  da_lap_bien_ban: '#e16f24',
  cho_ra_quyet_dinh: '#1a7f37',
  da_ra_quyet_dinh: '#12a55c',
  dang_khac_phuc: '#0969da',
  da_khac_phuc: '#2da44e',
  da_dong: '#57606a',
  da_huy: '#b42318',
};

export function BanDoPage({ api, notify }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);

  useEffect(() => {
    api('/api/v1/ban-do/vi-pham')
      .then((r) => setData(r.data || []))
      .catch((e) => notify(errorText(e), 'error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    mapRef.current = L.map(mapNode.current).setView(HOME, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(mapRef.current);
    markersRef.current = L.layerGroup().addTo(mapRef.current);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();
    const valid = data.filter(
      (p) =>
        p.toa_do && Number.isFinite(Number(p.toa_do.lat)) && Number.isFinite(Number(p.toa_do.lng))
    );
    if (!valid.length) return;
    const markers = valid.map((p) => {
      const color = MARKER_COLORS[p.trang_thai] || '#1f6feb';
      const m = L.circleMarker([Number(p.toa_do.lat), Number(p.toa_do.lng)], {
        radius: 9,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      });
      m.bindPopup(
        `<b>${p.ma_ho_so}</b><br/>${STATE_LABELS[p.trang_thai] || p.trang_thai}<br/>${p.dia_chi || '—'}${p.mo_ta ? `<br/><small>${p.mo_ta.slice(0, 100)}</small>` : ''}`
      );
      m.addTo(markersRef.current);
      return m;
    });
    if (markers.length > 1) mapRef.current.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
  }, [data]);

  const withCoords = data.filter(
    (p) => p.toa_do && Number.isFinite(Number(p.toa_do.lat)) && Number.isFinite(Number(p.toa_do.lng))
  );
  const presentStates = [...new Set(withCoords.map((p) => p.trang_thai || ''))].filter(Boolean);
  if (loading) return <Loading />;
  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">GIS</p>
          <h2>Bản đồ vi phạm toàn cục</h2>
          <p>{data.length} hồ sơ có tọa độ trên bản đồ.</p>
        </div>
      </div>
      <div
        ref={mapNode}
        className="map"
        style={{ height: 'calc(100vh - 200px)' }}
        role="application"
        aria-label="Bản đồ vi phạm toàn cục"
      />
      {presentStates.length > 0 && (
        <details className="map-legend" aria-label="Chú giải trạng thái">
          <summary>Chú giải trạng thái ({withCoords.length} điểm)</summary>
          <ul className="legend-list">
            {presentStates.map((s) => (
              <li key={s} className="legend-item">
                <i className="swatch" style={{ background: MARKER_COLORS[s] || '#1f6feb' }} aria-hidden="true" />
                {STATE_LABELS[s] || s}
              </li>
            ))}
          </ul>
        </details>
      )}
      <table className="sr-only map-fallback" id="map-fallback">
        <caption>Danh sách hồ sơ trên bản đồ</caption>
        <thead>
          <tr>
            <th scope="col">Mã hồ sơ</th>
            <th scope="col">Trạng thái</th>
            <th scope="col">Địa chỉ</th>
            <th scope="col">Tọa độ</th>
          </tr>
        </thead>
        <tbody>
          {withCoords.map((p) => (
            <tr key={p.id || p.ma_ho_so}>
              <td>{p.ma_ho_so}</td>
              <td>{STATE_LABELS[p.trang_thai] || p.trang_thai || '—'}</td>
              <td>{p.dia_chi || '—'}</td>
              <td>
                {Number(p.toa_do.lat).toFixed(6)}, {Number(p.toa_do.lng).toFixed(6)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
