import { Link } from "@tanstack/react-router";
import { MapPin, ThumbsUp, ChevronRight } from "lucide-react";
import { typeMeta, shortId, timeAgo, usePhotoUrl, type Hazard } from "@/lib/hazards";
import { StatusBadge, SeverityMark } from "./StatusBadge";

export function HazardThumb({ path, className = "" }: { path?: string | null; className?: string }) {
  const { data } = usePhotoUrl(path);
  return (
    <div className={`overflow-hidden bg-muted ${className}`}>
      {data && <img src={data} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </div>
  );
}

export function HazardRow({ hazard }: { hazard: Hazard }) {
  const meta = typeMeta(hazard.type);
  const Icon = meta.icon;
  const photo = hazard.photo_url || hazard.photo_path;

  return (
    <Link
      to="/hazards/$id"
      params={{ id: hazard.id }}
      className={`group sev-${hazard.severity} flex items-stretch gap-4 border-b border-border py-4 pl-4 pr-2 transition-colors hover:bg-accent`}
      style={{ boxShadow: "inset 5px 0 0 var(--sev)" }}
    >
      <HazardThumb path={photo} className="size-20 shrink-0 sm:size-24" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="eyebrow">{shortId(hazard.id)}</span>
          <span className="eyebrow">{timeAgo(hazard.created_at)}</span>
        </div>
        <h3 className="mt-1 flex items-center gap-2 text-lg font-bold">
          <Icon className="size-4.5" /> {meta.label}
        </h3>
        {hazard.description && <p className="line-clamp-1 text-sm text-muted-foreground">{hazard.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <StatusBadge status={hazard.status} />
          <SeverityMark severity={hazard.severity} />
          <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <ThumbsUp className="size-3.5" />
            {hazard.vote_count}
          </span>
          {hazard.address && (
            <span className="hidden items-center gap-1 truncate text-xs text-muted-foreground sm:inline-flex">
              <MapPin className="size-3.5" />
              {hazard.address}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="my-auto size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
