import { track } from "@vercel/analytics";

type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: EventProps }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, props?: EventProps) {
  if (typeof window === "undefined") return;

  window.plausible?.(name, props ? { props } : undefined);
  window.gtag?.("event", name, props);
  track(name, props ? { data: props } : undefined);
}
