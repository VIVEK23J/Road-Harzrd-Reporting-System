import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Camera, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { HazardRow } from "@/components/HazardRow";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/my-reports")({
  head: () => ({
    meta: [
      { title: "My Reports — RoadWatch Tool" },
      { name: "description", content: "Track the status of hazards you've reported in MongoDB." },
      { property: "og:title", content: "My Reports — RoadWatch Tool" },
      { property: "og:description", content: "Track the status of hazards you've reported in MongoDB." },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ["my-hazards"],
    queryFn: async () => {
      return api.getMyHazards();
    },
  });

  const fixed = data.filter((h) => h.status === "resolved").length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-foreground pb-4">
        <div>
          <p className="eyebrow">Citizen Activity</p>
          <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">My Reported Hazards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.length} total reported · {fixed} resolved
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-3.5 mr-1" /> Refresh
          </Button>
          <Button asChild variant="signal">
            <Link to="/report">
              <Camera className="size-4 mr-1.5" /> New Report
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-10 text-muted-foreground">Loading your reports from MongoDB…</p>
      ) : data.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-lg font-medium text-muted-foreground">You haven't reported any road hazards yet.</p>
          <Button asChild variant="signal" className="mt-4">
            <Link to="/report">Report your first hazard</Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {data.map((h) => (
            <HazardRow key={h.id} hazard={h} />
          ))}
        </div>
      )}
    </div>
  );
}
