import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Loader2, TriangleAlert, Send } from "lucide-react";
import { api } from "@/lib/api";
import { CameraCapture } from "@/components/CameraCapture";
import { MapView } from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { HAZARD_TYPES, SEVERITIES, hazardsQuery, findNearbyDuplicates, type HazardType, type HazardSeverity } from "@/lib/hazards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/report")({
  head: () => ({
    meta: [
      { title: "Report a Hazard — RoadWatch Tool" },
      { name: "description", content: "Take a photo of a road hazard and submit it to the road authorities." },
      { property: "og:title", content: "Report a Hazard — RoadWatch Tool" },
      { property: "og:description", content: "Take a photo of a road hazard and submit it to the road authorities." },
    ],
  }),
  component: ReportPage,
});

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ReportPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: all = [] } = useQuery(hazardsQuery);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [center, setCenter] = useState<[number, number] | undefined>();
  const [locating, setLocating] = useState(false);
  const [type, setType] = useState<HazardType>("pothole");
  const [severity, setSeverity] = useState<HazardSeverity>("medium");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const locate = () => {
    if (!navigator.geolocation) {
      toast.error("Location not supported on this device");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pt = { lat: p.coords.latitude, lng: p.coords.longitude };
        setPoint(pt);
        setCenter([pt.lat, pt.lng]);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Couldn't get your location — tap the map to place the pin.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    locate();
  }, []);

  const dupes = useMemo(() => (point ? findNearbyDuplicates(all, point, type) : []), [all, point, type]);

  const submit = async () => {
    if (!photo) {
      toast.error("Add a photo first");
      return;
    }
    if (!point) {
      toast.error("Set the hazard location on the map");
      return;
    }

    setBusy(true);
    try {
      const base64Photo = await blobToBase64(photo);

      const created = await api.createHazard({
        type,
        severity,
        description: description.trim() || undefined,
        address: address.trim() || undefined,
        photo_url: base64Photo,
        latitude: point.lat,
        longitude: point.lng,
      });

      qc.invalidateQueries({ queryKey: ["hazards"] });
      qc.invalidateQueries({ queryKey: ["my-hazards"] });
      toast.success("Hazard successfully reported! Saved in MongoDB.");
      navigate({ to: "/hazards/$id", params: { id: created.id } });
    } catch (e: any) {
      toast.error(e.message || "Failed to submit hazard report");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
      <p className="eyebrow">Tool · New Hazard Report</p>
      <h1 className="mt-1 text-3xl font-extrabold md:text-5xl">Report Road Hazard</h1>

      <div className="mt-8 grid gap-10 md:grid-cols-2">
        <Step n={1} title="Photo">
          <CameraCapture value={photo} onChange={setPhoto} />
        </Step>

        <Step
          n={2}
          title="Location"
          action={
            <Button size="sm" variant="outline" onClick={locate} disabled={locating}>
              {locating ? <Loader2 className="animate-spin" /> : <Crosshair />} Use my location
            </Button>
          }
        >
          <MapView
            picked={point}
            center={center}
            zoom={17}
            onPick={setPoint}
            hazards={all}
            className="aspect-[4/3] w-full border-2 border-foreground"
          />
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {point
              ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · tap or drag to adjust`
              : "Tap the map to place the pin"}
          </p>
          <Input
            className="mt-3 bg-background"
            placeholder="Street / landmark (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={200}
          />
        </Step>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-2">
        <Step n={3} title="What is it?">
          <div className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-3">
            {HAZARD_TYPES.map((t) => {
              const I = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={cn(
                    "flex flex-col items-start gap-2 p-3 text-left text-sm font-medium transition-colors",
                    type === t.value ? "bg-foreground text-background" : "bg-background hover:bg-accent"
                  )}
                >
                  <I className="size-5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <p className="eyebrow mb-2 mt-6">How dangerous?</p>
          <div className="grid grid-cols-4 border-2 border-foreground">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setSeverity(s.value)}
                className={cn(
                  `sev-${s.value} border-r border-foreground py-2.5 text-sm font-semibold last:border-r-0`,
                  severity === s.value ? "text-foreground" : "bg-background"
                )}
                style={severity === s.value ? { background: "var(--sev)" } : undefined}
              >
                {s.label}
              </button>
            ))}
          </div>
        </Step>

        <Step n={4} title="Details">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="E.g. Deep pothole in left lane, near the bus stop. Two-wheelers swerving."
            className="min-h-32 bg-background"
          />
          {dupes.length > 0 && (
            <div className="mt-4 border-l-4 border-primary bg-accent p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                <TriangleAlert className="size-4" /> Possibly already reported
              </p>
              <p className="mt-1 text-muted-foreground">
                {dupes.length} similar hazard{dupes.length > 1 ? "s" : ""} within 50 m. Confirming an existing report helps it get fixed faster.
              </p>
              <Link to="/hazards/$id" params={{ id: dupes[0]!.id }} className="mt-2 inline-block font-semibold underline">
                View existing report
              </Link>
            </div>
          )}
          <Button variant="signal" size="lg" className="mt-6 w-full" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Send />} Submit Report to MongoDB
          </Button>
        </Step>
      </div>
    </div>
  );
}

function Step({ n, title, action, children }: { n: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3 border-b-2 border-foreground pb-2">
        <span className="grid size-7 place-items-center bg-primary font-mono text-sm font-medium text-primary-foreground">{n}</span>
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}
