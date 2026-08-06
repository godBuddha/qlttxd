import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HOME } from '../lib/constants.js';

export function MapView({ point, points = [], polygons = [], onPick, height = '360px' }) {
  const node = useRef(null);
  const map = useRef(null);
  const layers = useRef(L.layerGroup());
  const polyLayers = useRef(L.layerGroup());
  useEffect(() => {
    if (map.current || !node.current) return undefined;
    map.current = L.map(node.current).setView(
      point ? [point.lat, point.lng] : HOME,
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
        if (p.label) marker.bindPopup(p.label);
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
  return <div ref={node} className="map" style={{ height }} aria-label="Bản đồ GIS" />;
}
