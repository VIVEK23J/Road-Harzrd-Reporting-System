import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ThumbsUp, ExternalLink, Trash2, ShieldAlert, CheckCircle, RefreshCw } from "lucide-react";
import { api, authStorage } from "@/lib/api";
import { HazardThumb } from "@/components/HazardRow";
import { StatusBadge, SeverityMark } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HAZARD_TYPES, STATUS_LABEL, typeMeta, shortId, timeAgo, type Hazard, type HazardStatus } from "@/lib/hazards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — RoadWatch" },
      { name: "description", content: "Review, verify and resolve reported road hazards in MongoDB." },
      { property: "og:title", content: "Admin Console — RoadWatch" },
      { property: "og:description", content: "Review, verify and resolve reported road hazards in MongoDB." },
    ],
  }),
  // Strictly Admin-only: Normal users are immediately rejected and redirected
  beforeLoad: async () => {
    const token = authStorage.getToken();
    if (!token) {
      throw redirect({ to: "/auth", search: { next: "/admin" } });
    }
    const res = await api.getMe();
    if (!res || !res.user) {
      throw redirect({ to: "/auth", search: { next: "/admin" } });
    }
    if (res.user.role !== "admin") {
      toast.error("Access denied: The Admin portal is restricted to the verified Administrator only.");
      throw redirect({ to: "/" });
    }
  },
  component: Admin,
});

const TABS: HazardStatus[] = ["pending", "verified", "in_progress", "resolved", "rejected"];
const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };

function Admin() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<HazardStatus>("pending");

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-hazards"],
    queryFn: async () => {
      return api.getAdminHazards();
    },
  });

  const list = useMemo(
    () =>
      data
        .filter((h) => h.status === tab)
        .sort((a, b) => sevRank[a.severity] - sevRank[b.severity] || b.vote_count - a.vote_count),
    [data, tab]
  );

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((s) => [s, data.filter((h) => h.status === s).length])),
    [data]
  );

  const byType = useMemo(
    () =>
      HAZARD_TYPES.map((t) => ({ ...t, n: data.filter((h) => h.type === t.value).length }))
        .filter((t) => t.n > 0)
        .sort((a, b) => b.n - a.n),
    [data]
  );

  const update = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: HazardStatus; note: string }) => {
      return api.updateHazardStatus(id, status, note);
    },
    onSuccess: (_d, v) => {
      toast.success(`Hazard updated to: ${STATUS_LABEL[v.status]}`);
      qc.invalidateQueries({ queryKey: ["admin-hazards"] });
      qc.invalidateQueries({ queryKey: ["hazards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      return api.deleteHazard(id);
    },
    onSuccess: () => {
      toast.success("Hazard report permanently removed from MongoDB");
      qc.invalidateQueries({ queryKey: ["admin-hazards"] });
      qc.invalidateQueries({ queryKey: ["hazards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-foreground pb-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="size-4" /> Real Admin Portal · MongoDB Live Data
          </div>
          <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">Admin Management Console</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw className="size-3.5" /> Refresh
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 border-2 border-foreground sm:grid-cols-5">
        {TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={cn(
              "border-b border-r border-foreground p-3 text-left transition-colors last:border-r-0 sm:border-b-0",
              tab === s ? "bg-foreground text-background" : "hover:bg-accent"
            )}
          >
            <div className="font-display text-3xl font-bold">{counts[s] ?? 0}</div>
            <div className="text-xs font-medium opacity-75">{STATUS_LABEL[s]}</div>
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_260px]">
        <div>
          {isLoading ? (
            <p className="py-10 text-muted-foreground">Loading hazard queue from MongoDB…</p>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
              <CheckCircle className="size-10 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground font-medium">No hazards in this status. Queue is clear!</p>
            </div>
          ) : (
            list.map((h) => (
              <AdminRow
                key={h.id}
                h={h}
                busy={update.isPending}
                onUpdate={(status, note) => update.mutate({ id: h.id, status, note })}
                onDelete={() => {
                  if (confirm("Are you sure you want to delete this report permanently from MongoDB?")) {
                    remove.mutate(h.id);
                  }
                }}
              />
            ))
          )}
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border p-4 bg-muted/30">
            <p className="eyebrow mb-3">Hazards by Type</p>
            {byType.length === 0 && <p className="text-sm text-muted-foreground">No reports recorded.</p>}
            {byType.map((t) => (
              <div key={t.value} className="mb-3">
                <div className="flex justify-between text-sm">
                  <span>{t.label}</span>
                  <span className="font-mono font-bold">{t.n}</span>
                </div>
                <div className="mt-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(t.n / (data.length || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border p-4 bg-asphalt text-asphalt-foreground">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Admin Session</p>
            <p className="mt-1 text-sm font-semibold">Authorized as Real Administrator</p>
            <p className="mt-0.5 text-xs text-asphalt-foreground/75 font-mono">vivek@gmail.com</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function AdminRow({
  h,
  onUpdate,
  onDelete,
  busy,
}: {
  h: Hazard;
  onUpdate: (s: HazardStatus, note: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [note, setNote] = useState("");
  const next: { s: HazardStatus; label: string; v: "signal" | "ink" | "outline" | "destructive" }[] =
    h.status === "pending"
      ? [
          { s: "verified", label: "Verify", v: "signal" },
          { s: "rejected", label: "Reject", v: "outline" },
        ]
      : h.status === "verified"
      ? [
          { s: "in_progress", label: "Start repair", v: "signal" },
          { s: "rejected", label: "Reject", v: "outline" },
        ]
      : h.status === "in_progress"
      ? [{ s: "resolved", label: "Mark resolved", v: "signal" }]
      : [{ s: "pending", label: "Reopen", v: "outline" }];

  return (
    <div
      className={`sev-${h.severity} flex flex-col gap-4 border-b border-border py-5 pl-4 sm:flex-row`}
      style={{ boxShadow: "inset 5px 0 0 var(--sev)" }}
    >
      <HazardThumb path={h.photo_path || h.photo_url || ""} className="aspect-[4/3] w-full shrink-0 sm:w-40" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="eyebrow">{shortId(h.id)} · {timeAgo(h.created_at)}</span>
          <StatusBadge status={h.status} />
        </div>
        <h3 className="mt-1 text-lg font-bold">{typeMeta(h.type).label}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <SeverityMark severity={h.severity} />
          <span className="inline-flex items-center gap-1 font-mono">
            <ThumbsUp className="size-3.5" />
            {h.vote_count}
          </span>
          <span className="font-mono">
            {h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}
          </span>
          {h.address && <span>{h.address}</span>}
        </div>
        {h.description && <p className="mt-2 text-sm">{h.description}</p>}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Timeline note (optional)"
            className="h-9 bg-background"
            maxLength={300}
          />
          <div className="flex gap-2">
            {next.map((n) => (
              <Button
                key={n.s}
                size="sm"
                variant={n.v}
                className="h-9"
                disabled={busy}
                onClick={() => {
                  onUpdate(n.s, note);
                  setNote("");
                }}
              >
                {n.label}
              </Button>
            ))}
            <Button asChild size="icon" variant="ghost" className="h-9 w-9" aria-label="Open">
              <Link to="/hazards/$id" params={{ id: h.id }}>
                <ExternalLink />
              </Link>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-destructive hover:bg-destructive/10"
              aria-label="Delete"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
