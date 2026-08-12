/**
 * Resolves the public base URL of the application.
 * Prioritizes NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_VERCEL_URL, or defaults to the production domain.
 */
export function getAppUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "") ||
    "https://portal.nfcsunn.org";

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url.replace(/\/$/, "");
}
