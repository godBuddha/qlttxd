import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useConfig } from '../lib/ConfigContext.jsx';

export function MapView({
  point,
  points = [],
  polygons = [],
  onPick,
  height = '360px',
  label = 'Bản đồ GIS',
}) {
  const node = useRef(null);
  const map = useRef(null);
  const layers = useRef(L.layerGroup());
  const polyLayers = useRef(L.layerGroup());
  const { homeCenter } = useConfig();
  useEffect(() => {
    if (map.current || !node.current) return undefined;
    // HC-02: center mặc định đọc từ config (ui.home_lat / ui.home_lng), fallback HOME
    map.current = L.map(node.current).setView(
      point ? [point.lat, point.lng] : homeCenter(),
      point ? 16 : 12
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map.current);
    layers.current.addTo(map.current);
    polyLayers.current.addTo(map.current);
    if (onPick)
      map.current.on('click', (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }));
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [onPick]);
  useEffect(() => {
    if (!map.current) return;
    layers.current.clearLayers();
    const all = [
      ...(point ? [{ ...point, label: 'Vị trí đã chọn' }] : []),
      ...points.filter(Boolean),
    ];
    const markers = all
      .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
      .map((p) => {
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#1f6feb',
          fillOpacity: 1,
        });
        if (p.label)
          marker.bindPopup(
            `${p.label}<br/>${Number(p.lat).toFixed(6)}, ${Number(p.lng).toFixed(6)}`
          );
        marker.addTo(layers.current);
        return marker;
      });
    if (point && markers[0]) map.current.setView([point.lat, point.lng], 16);
    else if (markers.length > 1)
      map.current.fitBounds(L.featureGroup(markers).getBounds().pad(0.15));
  }, [point, points]);
  useEffect(() => {
    if (!map.current) return;
    polyLayers.current.clearLayers();
    const valid = polygons.filter(Boolean);
    if (!valid.length) return;
    try {
      const geoJsonLayer = L.geoJSON(valid, {
        style: { color: '#1f6feb', weight: 2, fillColor: '#1f6feb', fillOpacity: 0.15 },
      }).addTo(polyLayers.current);
      map.current.fitBounds(geoJsonLayer.getBounds().pad(0.1));
    } catch {
      /* invalid GeoJSON — ignore */
    }
  }, [polygons]);

  // Human-readable, non-color text fallback of the points on the map so screen
  // readers and text browsers get the context even though the markers have no
  // ARIA role of their own (WCAG 1.1.1 / 1.4.1).
  const listed = [
    ...(point ? [{ ...point, label: 'Vị trí đã chọn' }] : []),
    ...points.filter(Boolean),
  ]
    .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
    .map((p) => `${p.label || 'Điểm'}: ${Number(p.lat).toFixed(6)}, ${Number(p.lng).toFixed(6)}`);
  const fallbackText = listed.length
    ? `${label} hiển thị ${listed.length} điểm: ${listed.join('; ')}.`
    : `${label}. Chưa có điểm nào được chọn.`;

  return (
    <div className="map-wrap">
      <div
        ref={node}
        className="map"
        style={{ height }}
        role="application"
        aria-label={label}
      />
      <p className="sr-only">{fallbackText}</p>
    </div>
  );
}