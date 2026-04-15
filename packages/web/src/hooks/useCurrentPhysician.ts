import { useEffect, useState } from "react";
import { useApi } from "@/lib/api";
import type { Physician } from "@/lib/types";

/**
 * Resolves the Physician record for the logged-in Clerk user.
 * Returns `null` while loading or if the lookup fails.
 *
 * Used for ownership comparisons — e.g. deciding whether the
 * Active Visit page should render in read-only mode.
 */
export function useCurrentPhysician(): Physician | null {
  const { get } = useApi();
  const [physician, setPhysician] = useState<Physician | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<Physician>("/auth/me")
      .then((p) => {
        if (!cancelled) setPhysician(p);
      })
      .catch(() => {
        if (!cancelled) setPhysician(null);
      });
    return () => {
      cancelled = true;
    };
  }, [get]);

  return physician;
}
