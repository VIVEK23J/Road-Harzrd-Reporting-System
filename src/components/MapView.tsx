import { lazy, Suspense, type ComponentProps } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type HazardMapType from "./HazardMap";

const HazardMap = lazy(() => import("./HazardMap"));

export function MapView(props: ComponentProps<typeof HazardMapType>) {
  const fallback = <div className={`${props.className ?? ""} grid-paper animate-pulse bg-muted`} />;
  return (
    <ClientOnly fallback={fallback}>
      <Suspense fallback={fallback}>
        <HazardMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
