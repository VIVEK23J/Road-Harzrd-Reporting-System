import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin, ThumbsUp, Send, Navigation, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import { MapView } from "@/components/MapView";
import { StatusBadge, SeverityMark } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { typeMeta, shortId, timeAgo, STATUS_LABEL, type HazardStatus } from "@/lib/hazards";

export const Route = createFileRoute("/hazards/$id")({
  head: () => ({
    meta: [
      { title: "Hazard Report — RoadWatch Tool" },
      { name: "description", content: "Photo, location and repair timeline for a reported road hazard." },
      { property: "og:title", content: "Hazard Report — RoadWatch Tool" },
      { property: "og:description", content: "Photo, location and repair timeline for a reported road hazard." },
    ],
  }),
  component: HazardPage,
});

function HazardPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");

  const hz = useQuery({
    queryKey: ["hazard", id],
    queryFn: async () => {
      return api.getHazard(id);
    },
  });

  const events = useQuery({
    queryKey: ["events", id],
    queryFn: async () => {
      return api.getHazardEvents(id);
    },
  });

  const comments = useQuery({
    queryKey: ["comments", id],
    queryFn: async () => {
      return api.getHazardComments(id);
    },
  });

  const myVote = useQuery({
    queryKey: ["vote", id, user?.id],
    enabled: !!user,
    queryFn: async () => {
      return api.getMyVote(id);
    },
  });

  const vote = useMutation({
    mutationFn: async () => {
      return api.toggleVote(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vote", id] });
      qc.invalidateQueries({ queryKey: ["hazard", id] });
      qc.invalidateQueries({ queryKey: ["hazards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      return api.addComment(id, comment.trim());
    },
    onSuccess: () => {
      setComment("");
      qc.invalidateQueries({ queryKey: ["comments", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const navigate = useNavigate();
  const [adminStatus, setAdminStatus] = useState<HazardStatus>("pending");
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    if (hz.data?.status) {
      setAdminStatus(hz.data.status);
    }
  }, [hz.data?.status]);

  const updateStatus = useMutation({
    mutationFn: async () => {
      return api.updateHazardStatus(id, adminStatus, adminNote.trim() || undefined);
    },
    onSuccess: (updated) => {
      toast.success(`Hazard status changed to: ${STATUS_LABEL[updated.status]}`);
      setAdminNote("");
      qc.invalidateQueries({ queryKey: ["hazard", id] });
      qc.invalidateQueries({ queryKey: ["events", id] });
      qc.invalidateQueries({ queryKey: ["hazards"] });
      qc.invalidateQueries({ queryKey: ["admin-hazards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteReport = useMutation({
    mutationFn: async () => {
      return api.deleteHazard(id);
    },
    onSuccess: () => {
      toast.success("Hazard report permanently removed from MongoDB");
      qc.invalidateQueries({ queryKey: ["hazards"] });
      qc.invalidateQueries({ queryKey: ["admin-hazards"] });
      navigate({ to: "/admin" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (hz.isLoading) {
    return <div className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground flex items-center gap-2"><Loader2 className="animate-spin size-5" /> Loading hazard report from MongoDB…</div>;
  }

  const h = hz.data;
  if (!h) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold">Hazard not found</h1>
        <Link to="/" className="mt-4 inline-block underline">
          Back to tool map
        </Link>
      </div>
    );
  }

  const meta = typeMeta(h.type);
  const Icon = meta.icon;
  const photoUrl = h.photo_url || h.photo_path;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-4" /> Back to Tool Dashboard
      </Link>
      <div className="mt-2 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="relative aspect-[4/3] bg-asphalt rounded-sm overflow-hidden">
            {photoUrl ? (
              <img src={photoUrl} alt={meta.label} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-muted-foreground">No image available</div>
            )}
            <div className="absolute left-0 top-0">
              <StatusBadge status={h.status} className="px-3 py-1.5" />
            </div>
          </div>
          <div className={`sev-${h.severity} mt-6 border-l-[6px] pl-4`} style={{ borderColor: "var(--sev)" }}>
            <p className="eyebrow">{shortId(h.id)} · reported {timeAgo(h.created_at)}</p>
            <h1 className="mt-1 flex items-center gap-3 text-3xl sm:text-4xl font-extrabold">
              <Icon className="size-8" />
              {meta.label}
            </h1>
            <div className="mt-3">
              <SeverityMark severity={h.severity} />
            </div>
          </div>
          {h.description && <p className="mt-5 text-lg leading-relaxed">{h.description}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            {user ? (
              <Button
                variant={myVote.data?.voted ? "ink" : "signal"}
                onClick={() => vote.mutate()}
                disabled={vote.isPending}
              >
                <ThumbsUp className="size-4 mr-1.5" /> {myVote.data?.voted ? "Confirmed by you" : "Confirm this hazard"} · {h.vote_count}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/auth" search={{ next: `/hazards/${id}` }}>
                  <ThumbsUp className="size-4 mr-1.5" /> Sign in to confirm · {h.vote_count}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${h.latitude},${h.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                <Navigation className="size-4 mr-1.5" /> Directions
              </a>
            </Button>
          </div>

          {user?.role === "admin" && (
            <div className="mt-8 rounded-lg border-2 border-primary bg-primary/5 p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                  <ShieldAlert className="size-4" /> Admin Controls · Update Report Status
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-muted-foreground">Current:</span>
                  <StatusBadge status={h.status} />
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground block mb-1.5">
                    Select New Status
                  </label>
                  <Select
                    value={adminStatus}
                    onValueChange={(val) => setAdminStatus(val as HazardStatus)}
                  >
                    <SelectTrigger className="w-full bg-background font-semibold">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending (Needs Review / Reopened)</SelectItem>
                      <SelectItem value="verified">Verified (Confirmed by Authority)</SelectItem>
                      <SelectItem value="in_progress">In Progress (Repair Scheduled / Underway)</SelectItem>
                      <SelectItem value="resolved">Resolved (Hazard Repaired)</SelectItem>
                      <SelectItem value="rejected">Rejected (Invalid / Duplicate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase text-muted-foreground block mb-1.5">
                    Timeline Action Note (Optional)
                  </label>
                  <Input
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="e.g. Work order issued; road crew assigned"
                    className="bg-background"
                    maxLength={300}
                  />
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="signal"
                    disabled={updateStatus.isPending || (adminStatus === h.status && !adminNote.trim())}
                    onClick={() => updateStatus.mutate()}
                    className="font-bold gap-2"
                  >
                    {updateStatus.isPending ? (
                      <>
                        <Loader2 className="animate-spin size-4" /> Updating…
                      </>
                    ) : (
                      `Apply Status: ${STATUS_LABEL[adminStatus]}`
                    )}
                  </Button>
                  {adminStatus !== h.status && (
                    <span className="text-xs font-mono text-primary font-semibold hidden sm:inline">
                      ({STATUS_LABEL[h.status]} → {STATUS_LABEL[adminStatus]})
                    </span>
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
                  disabled={deleteReport.isPending}
                  onClick={() => {
                    if (confirm("Are you sure you want to permanently delete this hazard report from MongoDB?")) {
                      deleteReport.mutate();
                    }
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete Report
                </Button>
              </div>
            </div>
          )}

          <section className="mt-12">
            <h2 className="border-b-4 border-foreground pb-2 text-2xl font-bold">Community Discussion</h2>
            {(comments.data ?? []).length === 0 && (
              <p className="py-6 text-sm text-muted-foreground">No updates or comments yet. Add the first one below.</p>
            )}
            {(comments.data ?? []).map((c) => (
              <div key={c.id} className="border-b border-border py-4">
                <p className="text-sm font-semibold">
                  {c.name}{" "}
                  <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
                    {timeAgo(c.created_at)}
                  </span>
                </p>
                <p className="mt-1 text-sm">{c.body}</p>
              </div>
            ))}
            {user ? (
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comment.trim()) addComment.mutate();
                }}
              >
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add an update or detail about this hazard…"
                  maxLength={1000}
                  className="min-h-11 bg-background"
                />
                <Button
                  type="submit"
                  variant="ink"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Post comment"
                  disabled={addComment.isPending}
                >
                  <Send />
                </Button>
              </form>
            ) : (
              <Link to="/auth" search={{ next: `/hazards/${id}` }} className="mt-4 inline-block text-sm underline">
                Sign in to post a comment
              </Link>
            )}
          </section>
        </div>

        <aside className="space-y-8">
          <div>
            <p className="eyebrow mb-2 flex items-center gap-1">
              <MapPin className="size-3" /> Location Coordinates
            </p>
            <MapView
              hazards={[h]}
              center={[h.latitude, h.longitude]}
              zoom={16}
              className="h-64 w-full border-2 border-foreground"
            />
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
            </p>
            {h.address && <p className="text-sm font-medium">{h.address}</p>}
          </div>

          <div>
            <p className="eyebrow mb-3">Repair Status History</p>
            <ol className="relative border-l-2 border-foreground pl-6">
              {(events.data ?? []).map((e) => (
                <li key={e.id} className="relative pb-6 last:pb-0">
                  <span className="absolute -left-[31px] top-1 size-3.5 border-2 border-foreground bg-primary" />
                  <p className="font-semibold">{STATUS_LABEL[e.status as keyof typeof STATUS_LABEL] || e.status}</p>
                  <p className="font-mono text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                  {e.note && <p className="mt-1 text-sm text-muted-foreground">{e.note}</p>}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
