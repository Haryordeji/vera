import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";

interface Props {
  children: React.ReactNode;
}

/**
 * Calls POST /api/auth/sync once after the user signs in.
 * This ensures a Physician record exists in the database for the current user.
 */
export function AuthSync({ children }: Props) {
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const synced = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || synced.current) return;

    synced.current = true;
    getToken()
      .then((token) =>
        fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
      )
      .catch((err) => console.error("Auth sync failed:", err));
  }, [isLoaded, isSignedIn, getToken]);

  return <>{children}</>;
}
