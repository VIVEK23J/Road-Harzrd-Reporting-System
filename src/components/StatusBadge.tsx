import { cn } from "@/lib/utils";
import { STATUS_LABEL, type HazardStatus, type HazardSeverity } from "@/lib/hazards";

const statusCls: Record<HazardStatus, string> = {
  pending: "bg-muted text-foreground",
  verified: "bg-info text-background",
  in_progress: "bg-primary text-primary-foreground",
  resolved: "bg-success text-background",
  rejected: "bg-destructive text-destructive-foreground",
};

export function StatusBadge({ status, className }: { status: HazardStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider", statusCls[status], className)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SeverityMark({ severity }: { severity: HazardSeverity }) {
  const n = { low: 1, medium: 2, high: 3, critical: 4 }[severity];
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider", `sev-${severity}`)}>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className="h-3 w-1" style={{ background: i <= n ? "var(--sev)" : "var(--border)" }} />
        ))}
      </span>
      {severity}
    </span>
  );
}
