import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import {
  Camera,
  MapPin,
  Clock,
  Wrench,
  CheckCircle2,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HazardRow } from "@/components/HazardRow";
import { MapView } from "@/components/MapView";
import {
  hazardsQuery,
  HAZARD_TYPES,
  SEVERITIES,
  STATUS_LABEL,
  type HazardStatus,
} from "@/lib/hazards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoadWatch — Road Hazard Tool" },
      { name: "description", content: "Web-based road hazard inspection, tracking, and reporting tool." },
      { property: "og:title", content: "RoadWatch — Road Hazard Tool" },
      { property: "og:description", content: "Web-based road hazard inspection, tracking, and reporting tool." },
    ],
  }),
  component: ToolDashboard,
});

const chipCls = (active: boolean) =>
  cn(
    "whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer",
    active
      ? "bg-foreground text-background border-foreground font-semibold"
      : "bg-background text-muted-foreground border-border hover:border-foreground hover:text-foreground"
  );

function ToolDashboard() {
  const navigate = useNavigate();
  const { data = [], isLoading, refetch } = useQuery(hazardsQuery);

  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSev, setSelectedSev] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<HazardStatus | null>(null);

  // Statistics
  const openCount = data.filter((h) => h.status === "pending" || h.status === "verified").length;
  const inProgressCount = data.filter((h) => h.status === "in_progress").length;
  const resolvedCount = data.filter((h) => h.status === "resolved").length;

  // Filtered hazards
  const filteredList = useMemo(() => {
    return data.filter((h) => {
      if (selectedType && h.type !== selectedType) return false;
      if (selectedSev && h.severity !== selectedSev) return false;
      if (selectedStatus && h.status !== selectedStatus) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesType = h.type.toLowerCase().includes(query);
        const matchesDesc = h.description?.toLowerCase().includes(query);
        const matchesAddress = h.address?.toLowerCase().includes(query);
        const matchesId = h.id.toLowerCase().includes(query);
        if (!matchesType && !matchesDesc && !matchesAddress && !matchesId) return false;
      }
      return true;
    });
  }, [data, selectedType, selectedSev, selectedStatus, search]);

  const mapCenter = useMemo<[number, number] | undefined>(
    () => (filteredList[0] ? [filteredList[0].latitude, filteredList[0].longitude] : undefined),
    [filteredList[0]?.id]
  );

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-background">
      {/* Top Tool Command Bar */}
      <div className="border-b border-border bg-card px-4 py-3 shrink-0">
        <div className="mx-auto flex flex-wrap items-center justify-between gap-3 max-w-7xl">
          {/* Real-time counters */}
          <div className="flex items-center gap-2 sm:gap-4 divide-x divide-border text-xs sm:text-sm">
            <div className="flex items-center gap-1.5 font-mono">
              <Clock className="size-4 text-amber-500" />
              <span className="font-bold">{openCount}</span>
              <span className="text-muted-foreground hidden sm:inline">Awaiting</span>
            </div>
            <div className="pl-2 sm:pl-4 flex items-center gap-1.5 font-mono">
              <Wrench className="size-4 text-blue-500" />
              <span className="font-bold">{inProgressCount}</span>
              <span className="text-muted-foreground hidden sm:inline">In Repair</span>
            </div>
            <div className="pl-2 sm:pl-4 flex items-center gap-1.5 font-mono">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span className="font-bold">{resolvedCount}</span>
              <span className="text-muted-foreground hidden sm:inline">Fixed</span>
            </div>
          </div>

          {/* Quick tool actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="gap-1.5 h-8 text-xs"
              title="Refresh MongoDB data"
            >
              <RefreshCw className="size-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button asChild variant="signal" size="sm" className="gap-1.5 h-8 text-xs font-bold">
              <Link to="/report">
                <Plus className="size-4" /> Report Hazard
              </Link>
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mx-auto max-w-7xl mt-2.5 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase text-muted-foreground mr-1">
              <Filter className="size-3" /> Filters:
            </span>
            <button
              className={chipCls(!selectedType && !selectedSev && !selectedStatus)}
              onClick={() => {
                setSelectedType(null);
                setSelectedSev(null);
                setSelectedStatus(null);
              }}
            >
              All Hazards ({data.length})
            </button>

            {/* Type Chips */}
            {HAZARD_TYPES.slice(0, 5).map((t) => (
              <button
                key={t.value}
                className={chipCls(selectedType === t.value)}
                onClick={() => setSelectedType(selectedType === t.value ? null : t.value)}
              >
                {t.label}
              </button>
            ))}

            {/* Status Chips */}
            <span className="text-border mx-1">|</span>
            {(["pending", "in_progress", "resolved"] as HazardStatus[]).map((s) => (
              <button
                key={s}
                className={chipCls(selectedStatus === s)}
                onClick={() => setSelectedStatus(selectedStatus === s ? null : s)}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {/* Search filter input */}
          <div className="relative w-full sm:w-48 lg:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search hazards or streets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      {/* Main Tool Work Area: Map + Live Hazard Feed */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Interactive Tool Map */}
        <div className="h-[45vh] lg:h-full lg:flex-1 relative border-r border-border">
          <MapView
            hazards={filteredList}
            center={mapCenter}
            zoom={13}
            onSelect={(id) => navigate({ to: "/hazards/$id", params: { id } })}
            className="h-full w-full"
          />
          <div className="absolute top-3 left-3 z-[400] bg-background/90 backdrop-blur-md border border-border px-3 py-1.5 rounded shadow text-xs font-mono">
            <span className="font-bold text-primary">{filteredList.length}</span> hazards mapped
          </div>
        </div>

        {/* Live Inspection Queue Feed */}
        <aside className="h-[55vh] lg:h-full lg:w-[460px] flex flex-col bg-background">
          <div className="p-3 border-b border-border bg-muted/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-bold uppercase tracking-wider">Live Hazard Feed</h2>
            </div>
            <span className="font-mono text-xs text-muted-foreground">
              {filteredList.length} of {data.length} records
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <RefreshCw className="size-4 animate-spin" /> Querying MongoDB database…
              </div>
            ) : filteredList.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                <p>No road hazards found matching your active filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 text-xs"
                  onClick={() => {
                    setSelectedType(null);
                    setSelectedSev(null);
                    setSelectedStatus(null);
                    setSearch("");
                  }}
                >
                  Reset all filters
                </Button>
              </div>
            ) : (
              filteredList.map((hazard) => <HazardRow key={hazard.id} hazard={hazard} />)
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
