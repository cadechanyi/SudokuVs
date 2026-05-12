/**
 * Central place for deployment URLs (Azure App Service, Docker, etc.).
 *
 * - NEXT_PUBLIC_* variables are inlined at build time for client bundles.
 *   Pass them as Docker build args (see Dockerfile) so production images match your host.
 * - At runtime, the Node server still reads process.env for server components / metadata.
 */

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** Canonical public origin of this app (metadata, absolute links). */
export function getPublicAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return stripTrailingSlash(fromEnv);
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Base URL for future HTTP APIs (empty if unset). */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL?.trim();
  return url ? stripTrailingSlash(url) : "";
}

/** WebSocket URL for multiplayer (`NEXT_PUBLIC_WS_URL`). Empty if unset (browser client defaults on localhost). */
export function getWsUrl(): string {
  const url = process.env.NEXT_PUBLIC_WS_URL?.trim();
  return url ? stripTrailingSlash(url) : "";
}
