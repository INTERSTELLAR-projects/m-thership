// Rank-grid preview: the grid points over an OpenStreetMap base (react-leaflet). Loaded lazily by
// MapPackTab so Leaflet only ships when the Map pack tab is opened. Points are where a rank
// tracker would search from; no rank numbers are drawn until tracking is connected.
import { useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Rectangle, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { gridPoints } from "@/features/claude/mapPack";

function FitTo({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { padding: [18, 18] });
  }, [map, bounds && bounds.flat().join(",")]);
  return null;
}

export default function MapPackGridMap({ grid, office }) {
  const pts = gridPoints(grid.center, grid.radius_miles, grid.grid_size);
  if (!pts.length) return null;
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
  const hasOffice = office && Number.isFinite(office.lat) && Number.isFinite(office.lng);
  return (
    <MapContainer bounds={bounds} scrollWheelZoom={false} className="h-[360px] w-full rounded-sm border border-hair" style={{ zIndex: 0 }}>
      {/* CARTO light basemap: OSM's own tile servers block app traffic (403 "Access blocked"). */}
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" subdomains="abcd" maxZoom={20} attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>' />
      <FitTo bounds={bounds} />
      <Rectangle bounds={bounds} pathOptions={{ color: "#ff3c00", weight: 1, fillOpacity: 0.04, dashArray: "4 4" }} />
      {pts.map((p) => (
        <CircleMarker key={`${p.row}-${p.col}`} center={[p.lat, p.lng]} radius={5} pathOptions={{ color: "#ff6a00", weight: 1.5, fillColor: "#ffffff", fillOpacity: 0.95 }}>
          <Tooltip direction="top">Point {p.row + 1}·{p.col + 1} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)}</Tooltip>
        </CircleMarker>
      ))}
      {hasOffice && (
        <CircleMarker center={[office.lat, office.lng]} radius={8} pathOptions={{ color: "#ff3c00", weight: 2, fillColor: "#ff3c00", fillOpacity: 1 }}>
          <Tooltip direction="top" permanent>GBP location</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
