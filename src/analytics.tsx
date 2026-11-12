import { Analytics } from "@vercel/analytics/react";

/** Page views only, and only in a production build. Keystrokes are not passed in. */
export function ProdAnalytics() {
  if (!import.meta.env.PROD) return null;
  return <Analytics />;
}
