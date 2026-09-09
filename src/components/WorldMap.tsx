'use client';

import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// colorIdx: 1=black 2=blue 3=white 4=red 5=navy 6=grey 7=striped 8=white-blue
const DOT_COLORS: Record<number, string> = {
  1: '#374151',
  2: '#3b82f6',
  3: '#e2e8f0',
  4: '#ef4444',
  5: '#1e40af',
  6: '#9ca3af',
  7: '#f59e0b',
  8: '#93c5fd',
};

export interface CarDot {
  lat: number;
  lng: number;
  colorIdx: number;
}

interface WorldMapProps {
  geojson: GeoJSON.FeatureCollection | null;
  getColor: (countryName: string) => string;
  getTooltip: (countryName: string) => string;
  carDots?: CarDot[];
}

export default function WorldMap({ geojson, getColor, getTooltip, carDots }: WorldMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const dotsLayerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoveredLayerRef = useRef<L.Layer | null>(null);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: [40, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 8,
      dragging: false,
      scrollWheelZoom: true,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomControl: false,
    });

    const dotsPane = mapRef.current.createPane('dotsPane');
    dotsPane.style.zIndex = '450';

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      noWrap: true,
      bounds: [
        [-85, -180],
        [85, 180],
      ],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(mapRef.current);

    mapRef.current.invalidateSize();

    mapRef.current.on('zoomend', () => {
      if (mapRef.current && mapRef.current.getZoom() === mapRef.current.getMinZoom()) {
        mapRef.current.fitBounds(
          [
            [-58, -175],
            [82, 175],
          ],
          { padding: [24, 24], animate: true }
        );
      }
    });

    const handleResize = () => {
      mapRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update layer when geojson or callbacks change
  const getCountryName = useCallback((feature: GeoJSON.Feature) => {
    const props = feature.properties as Record<string, string> | null;
    return props?.ADMIN || props?.NAME || '';
  }, []);

  useEffect(() => {
    if (!mapRef.current || !geojson) return;

    if (layerRef.current) {
      layerRef.current.remove();
      hoveredLayerRef.current = null;
    }

    layerRef.current = L.geoJSON(geojson, {
      style: (feature) => {
        if (!feature) return {};
        const name = getCountryName(feature);
        const color = getColor(name);
        const isGreyedOut = color === '#111827';
        return {
          fillColor: color,
          fillOpacity: isGreyedOut ? 0.3 : 0.7,
          color: '#444',
          weight: isGreyedOut ? 0.5 : 1,
        };
      },
      onEachFeature: (feature, layer) => {
        const name = getCountryName(feature);
        layer.bindTooltip(() => getTooltip(name), {
          sticky: true,
          className: 'map-tooltip',
        });

        layer.on({
          mouseover: (e) => {
            // Explicitly close the previous layer's tooltip in case its mouseout was swallowed
            // by bringToFront() reordering SVG elements
            if (hoveredLayerRef.current && hoveredLayerRef.current !== e.target) {
              hoveredLayerRef.current.closeTooltip();
              layerRef.current?.resetStyle(hoveredLayerRef.current);
            }
            hoveredLayerRef.current = e.target as L.Layer;
            const l = e.target as L.Path;
            l.setStyle({ weight: 2, color: '#fff', fillOpacity: 0.9 });
            l.bringToFront();
          },
          mouseout: (e) => {
            layerRef.current?.resetStyle(e.target);
            if (hoveredLayerRef.current === e.target) {
              hoveredLayerRef.current = null;
            }
          },
        });
      },
    }).addTo(mapRef.current);

    // Fit to world bounds excluding Antarctica so it doesn't dominate the view
    mapRef.current.fitBounds(
      [
        [-58, -175],
        [82, 175],
      ],
      { padding: [24, 24] }
    );
  }, [geojson, getColor, getTooltip, getCountryName]);

  // Render/remove car color dots when carDots changes
  useEffect(() => {
    if (!mapRef.current) return;
    dotsLayerRef.current?.remove();
    if (!carDots?.length) {
      dotsLayerRef.current = null;
      return;
    }
    const group = L.layerGroup();
    for (const { lat, lng, colorIdx } of carDots) {
      const color = DOT_COLORS[colorIdx];
      if (!color) continue;
      L.circleMarker([lat, lng], {
        radius: 4,
        color: 'transparent',
        fillColor: color,
        fillOpacity: 0.75,
        weight: 0,
        pane: 'dotsPane',
      }).addTo(group);
    }
    group.addTo(mapRef.current);
    dotsLayerRef.current = group;
  }, [carDots]);

  return <div ref={containerRef} className="h-full w-full" />;
}
