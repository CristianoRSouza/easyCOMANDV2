import { RoutePendingFallback } from "@/shared/layout/route-pending";

/** O `defaultPendingComponent` do roteador de hoje (`easyCONTROL/src/router.tsx`). */
export default function Loading() {
  return <RoutePendingFallback />;
}
