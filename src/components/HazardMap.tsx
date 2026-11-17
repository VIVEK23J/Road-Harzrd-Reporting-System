import { useEffect, useRef } from "react";
import L from "leaflet";
import type { Hazard } from "@/lib/hazards";
import { typeMeta, STATUS_LABEL } from "@/lib/hazards";

type Props = {
  hazards?: Hazard[] | undefined;
  center?: [number, number] | undefined;
  zoom?: number | undefined;
  picked?: { lat: number; lng: number } | null | undefined;
  onPick?: ((p: { lat: number; lng: number }) => void) | undefined;
  onSelect?: ((id: string) => void) | undefined;
  className?: string | undefined;
};

export default function HazardMap({ hazards = [], center, zoom = 13, picked, onPick, onSelect, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickMarker = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const onSelectRef = useRef(onSelect);
  onPickRef.current = onPick;
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView(center ?? [20.5937, 78.9629], center ? zoom : 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on("click", (e) => onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    map.current = m;
    return () => { m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (center && map.current) map.current.setView(center, zoom);
  }, [center?.[0], center?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    hazards.forEach((h) => {
      const icon = L.divIcon({
        className: "",
        html: `<div class="hz-pin sev-${h.severity} ${h.status === "resolved" ? "is-resolved" : ""}"></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      L.marker([h.latitude, h.longitude], { icon })
        .bindTooltip(`${typeMeta(h.type).label} · ${STATUS_LABEL[h.status]}`)
        .on("click", () => onSelectRef.current?.(h.id))
        .addTo(g);
    });
  }, [hazards]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!picked) { pickMarker.current?.remove(); pickMarker.current = null; return; }
    if (!pickMarker.current) {
      pickMarker.current = L.marker([picked.lat, picked.lng], {
        draggable: true,
        icon: L.divIcon({ className: "", html: '<div class="hz-pick"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
      }).addTo(m);
      pickMarker.current.on("dragend", () => {
        const p = pickMarker.current!.getLatLng();
        onPickRef.current?.({ lat: p.lat, lng: p.lng });
      });
    } else pickMarker.current.setLatLng([picked.lat, picked.lng]);
  }, [picked?.lat, picked?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={className} />;
}
