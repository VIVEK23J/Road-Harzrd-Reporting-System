import { useQuery } from "@tanstack/react-query";
import { api, type Hazard } from "./api";
import {
  CircleAlert,
  Construction,
  Waves,
  TrafficCone,
  Lightbulb,
  SplitSquareVertical,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

export type { Hazard };
export type HazardType = "pothole" | "debris" | "flooding" | "signal" | "crack" | "lighting" | "other";
export type HazardSeverity = "low" | "medium" | "high" | "critical";
export type HazardStatus = "pending" | "verified" | "in_progress" | "resolved" | "rejected";

export const HAZARD_TYPES: { value: HazardType; label: string; icon: LucideIcon }[] = [
  { value: "pothole", label: "Pothole", icon: CircleAlert },
  { value: "debris", label: "Debris", icon: Construction },
  { value: "flooding", label: "Flooding", icon: Waves },
  { value: "signal", label: "Broken signal", icon: TrafficCone },
  { value: "crack", label: "Road crack", icon: SplitSquareVertical },
  { value: "lighting", label: "No street light", icon: Lightbulb },
  { value: "other", label: "Other", icon: HelpCircle },
];
const OTHER_TYPE = HAZARD_TYPES[HAZARD_TYPES.length - 1]!;
export const typeMeta = (t: HazardType) => HAZARD_TYPES.find((x) => x.value === t) ?? OTHER_TYPE;

export const SEVERITIES: { value: HazardSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export const STATUS_LABEL: Record<HazardStatus, string> = {
  pending: "Pending review",
  verified: "Verified",
  in_progress: "Repair in progress",
  resolved: "Resolved",
  rejected: "Rejected",
};
export const STATUS_FLOW: HazardStatus[] = ["pending", "verified", "in_progress", "resolved"];

export function shortId(id: string) {
  return "RW-" + id.slice(0, 6).toUpperCase();
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

/** Distance in metres between two lat/lng points (haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const DUPLICATE_RADIUS_M = 50;

export function findNearbyDuplicates(hazards: Hazard[], point: { lat: number; lng: number }, type: HazardType) {
  return hazards.filter(
    (h) => h.type === type && h.status !== "resolved" && h.status !== "rejected" &&
      distanceMeters(point, { lat: h.latitude, lng: h.longitude }) <= DUPLICATE_RADIUS_M,
  );
}

export const hazardsQuery = {
  queryKey: ["hazards"],
  queryFn: async () => {
    return api.getHazards();
  },
};

export function usePhotoUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["photo", path],
    enabled: !!path,
    staleTime: Infinity,
    queryFn: async () => {
      if (!path) return null;
      return path;
    },
  });
}
