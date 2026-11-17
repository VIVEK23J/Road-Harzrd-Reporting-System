import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import { HazardRow } from "@/components/HazardRow";
import { hazardsQuery, HAZARD_TYPES, SEVERITIES, STATUS_LABEL, type HazardStatus } from "@/lib/hazards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Live hazard map — RoadWatch" },
      { name: "description", content: "Every reported pothole, flood and broken signal on one live map." },
      { property: "og:title", content: "Live hazard map — RoadWatch" },
      { property: "og:description", content: "Every reported pothole, flood and broken signal on one live map." },
    ],
  }),
  component: MapPage,
});

const chip = (on: boolean) => cn("whitespace-nowrap border px-3 py-1.5 text-xs font-medium transition-colors", on ? "border-foreground bg-foreground text-background" : "border-border hover:border-foreground");

function MapPage() {
  const { data = [] } = useQuery(hazardsQuery);
  const navigate = useNavigate();
  const [type, setType] = useState<string | null>(null);
  const [sev, setSev] = useState<string | null>(null);
  const [status, setStatus] = useState<HazardStatus | null>(null);

  const list = useMemo(() => data.filter((h) => (!type || h.type === type) && (!sev || h.severity === sev) && (!status || h.status === status)), [data, type, sev, status]);
  const center = useMemo<[number, number] | undefined>(() => (data[0] ? [data[0].latitude, data[0].longitude] : undefined), [data[0]?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col lg:h-[calc(100vh-3.5rem-3px)] lg:flex-row">
      <MapView hazards={list} center={center} zoom={12} onSelect={(id) => navigate({ to: "/hazards/$id", params: { id } })} className="h-[50vh] w-full lg:h-full lg:flex-1" />
      <aside className="flex w-full flex-col border-l border-border lg:w-[440px]">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-baseline justify-between">
            <h1 className="text-2xl font-bold">Live map</h1>
            <span className="font-mono text-xs text-muted-foreground">{list.length} shown</span>
          </div>
          <Row label="Type">
            <button className={chip(!type)} onClick={() => setType(null)}>All</button>
            {HAZARD_TYPES.map((t) => <button key={t.value} className={chip(type === t.value)} onClick={() => setType(t.value)}>{t.label}</button>)}
          </Row>
          <Row label="Severity">
            <button className={chip(!sev)} onClick={() => setSev(null)}>All</button>
            {SEVERITIES.map((t) => <button key={t.value} className={chip(sev === t.value)} onClick={() => setSev(t.value)}>{t.label}</button>)}
          </Row>
          <Row label="Status">
            <button className={chip(!status)} onClick={() => setStatus(null)}>All</button>
            {(["pending", "verified", "in_progress", "resolved"] as HazardStatus[]).map((s) => <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</button>)}
          </Row>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No hazards match these filters.</p> : list.map((h) => <HazardRow key={h.id} hazard={h} />)}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">{children}</div>
    </div>
  );
}
