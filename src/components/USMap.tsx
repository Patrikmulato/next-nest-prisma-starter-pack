'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Maps GeoJSON properties.name → US_PLATES state name for known mismatches
const GEO_TO_PLATE_NAME: Record<string, string> = {
  'District of Columbia': 'Washington DC',
};

export interface USMapProps {
  selectedState: string | null;
  highlightedStates: Set<string>;
  onStateClick: (state: string) => void;
}

function getStateStyle(
  feature: GeoJSON.Feature | undefined,
  selectedState: string | null,
  highlightedStates: Set<string>
): L.PathOptions {
  if (!feature) return {};
  const geoName = (feature.properties as Record<string, string>)?.name ?? '';
  const plateName = GEO_TO_PLATE_NAME[geoName] ?? geoName;
  const isSelected = plateName === selectedState;
  const allHighlighted = highlightedStates.size === 0;
  const isHighlighted = allHighlighted || highlightedStates.has(plateName);

  return {
    fillColor: isSelected ? '#3b82f6' : isHighlighted ? '#314252' : '#0d1117',
    fillOpacity: isSelected ? 0.8 : isHighlighted ? 0.7 : 0.95,
    color: isSelected ? '#60a5fa' : isHighlighted ? '#4a5a68' : '#1e2530',
    weight: isSelected ? 1.5 : 1,
  };
}

export default function USMap({ selectedState, highlightedStates, onStateClick }: USMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedStateRef = useRef(selectedState);
  const highlightedStatesRef = useRef(highlightedStates);
  const onStateClickRef = useRef(onStateClick);

  useEffect(() => {
    selectedStateRef.current = selectedState;
  }, [selectedState]);
  useEffect(() => {
    highlightedStatesRef.current = highlightedStates;
  }, [highlightedStates]);
  useEffect(() => {
    onStateClickRef.current = onStateClick;
  }, [onStateClick]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: [39, -98],
      zoom: 4,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      dragging: false,
      touchZoom: false,
      keyboard: false,
      zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(mapRef.current);

    fetch('/us-states.geo.json')
      .then((r) => r.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (!mapRef.current) return;

        layerRef.current = L.geoJSON(geojson, {
          style: (feature) =>
            getStateStyle(feature, selectedStateRef.current, highlightedStatesRef.current),
          onEachFeature: (feature, layer) => {
            const geoName = (feature.properties as Record<string, string>)?.name ?? '';
            const plateName = GEO_TO_PLATE_NAME[geoName] ?? geoName;

            layer.bindTooltip(geoName, {
              permanent: true,
              direction: 'center',
              className: 'us-state-label',
            });

            layer.on({
              click: () => onStateClickRef.current(plateName),
              mouseover: (e) => {
                (e.target as L.Path).setStyle({ weight: 2, color: '#fff' });
                (e.target as L.Path).bringToFront();
              },
              mouseout: (e) => {
                layerRef.current?.resetStyle(e.target as L.Layer);
              },
            });
          },
        }).addTo(mapRef.current);

        // Fit to continental US — invalidateSize first so Leaflet sees the real container dimensions
        mapRef.current.invalidateSize();
        mapRef.current.fitBounds(
          [
            [24, -125],
            [50, -66],
          ],
          { padding: [16, 16] }
        );
      });

    const handleResize = () => mapRef.current?.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Re-style when selection or highlights change
  useEffect(() => {
    if (!layerRef.current) return;
    layerRef.current.setStyle((feature) =>
      getStateStyle(feature, selectedState, highlightedStates)
    );
  }, [selectedState, highlightedStates]);

  return <div ref={containerRef} className="h-full w-full" />;
}
