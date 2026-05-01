import { useLocation } from "wouter";

export function usePortalMode() {
  const [location] = useLocation();
  const isTevrMode = location.startsWith("/tevr/");
  const base = isTevrMode ? "/tevr" : "/admin";
  return { isTevrMode, base };
}
