import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { HOME, STATE_LABELS } from '../lib/constants.js';
import { errorText } from '../lib/api.js';
import { Loading } from '../components/Loading.jsx';

export function BanDoPage({ api, notify }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(null);

  useEffect(() => {
    api('/api/v1/ban-do/vi-pham').then((r) => setData(r.data || [])).catch((e) => notify(errorText(e), 'error')).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    mapRef.current = L.map(mapNode.current).setView(HOME, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(mapRef.current);
    markersRef.current = L.layerGroup().addTo(mapRef.current);
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;
    markersRef.current.clearLayers();
    const valid = data.filter((p) => p.toa_do && Number.isFinite(Number(p.toa_do.lat)) && Number.isFinite(Number(p.toa_do.lng)));
    if (!valid.length) return;
    const colorMap = { cho_tiep_nhan: '#1f6feb', cho_xac_minh: '#6e40c9', dang_xac_minh: '#bf8700', cho_bo_sung: '#d4a72c', cho_lap_bien_ban: '#da3633', da_lap_bien_ban: '#e16f24', cho_ra_quyet_dinh: '#1a7f37', da_ra_quyet_dinh: '#12a55c', dang_khac_phuc: '#0969da', da_khac_phuc: '#2da44e', da_dong: '#57606a', da_huy: '#b42318' };
    const markers = valid.map((p) => {
      const color = colorMap[p.trang_thai] || '#1f6feb';
      const m = L.circleMarker([Number(p.toa_do.lat), Number(p.toa_do.lng)], { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1 });
      m.bindPopup(`<b>${p.ma_ho_so}</b><br/>${STATE_LABELS[p.trang_thai] || p.trang_thai}<br/>${p.dia_chi || '—'}${p.mo_ta ? `<br/><small>${p.mo_ta.slice(0, 100)}</small>` : ''}`);
      m.addTo(markersRef.current);
      return m;
    });
    if (markers.length > 1) mapRef.current.fitBounds(L.featureGroup(markers).getBounds().pad(0.1));
  }, [data]);

  if (loading) return <Loading />;
  return <><div className="page-title"><div><p className="eyebrow">GIS</p><h2>Bản đồ vi phạm toàn cục</h2><p>{data.length} hồ sơ có tọa độ trên bản đồ.</p></div></div><div ref={mapNode} className="map" style={{ height: 'calc(100vh - 200px)' }} aria-label="Bản đồ vi phạm toàn cục" /></>;
}
