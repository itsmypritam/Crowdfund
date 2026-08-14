import mixpanel from "mixpanel-browser";
import { track } from "@vercel/analytics";

type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: EventProps }) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

const MIXPANEL_TOKEN = "560c26136404b4fb51a1ff625d556ecc";

let mixpanelInitialized = false;

function initMixpanel() {
  if (mixpanelInitialized) return;
  mixpanel.init(MIXPANEL_TOKEN, {
    autocapture: true,
    record_sessions_percent: 100,
  });
  mixpanel.track("page_view");
  mixpanelInitialized = true;
}

if (typeof window !== "undefined") {
  initMixpanel();
}

export function trackEvent(name: string, props?: EventProps) {
  if (typeof window === "undefined") return;

  window.plausible?.(name, props ? { props } : undefined);
  window.gtag?.("event", name, props);
  track(name, props ? { data: props } : undefined);
  try {
    initMixpanel();
    mixpanel.track(name, props ?? {});
  } catch {}
}
