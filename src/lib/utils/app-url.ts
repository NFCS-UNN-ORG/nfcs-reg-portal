/**
 * Resolves the public base URL of the application.
 * Prioritizes NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_VERCEL_URL, or defaults to the production domain portal.nfcsunn.org.
 */
export function getAppUrl(): string {
  let url =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "") ||
    "https://portal.nfcsunn.org";

  // Prevent accidental localhost redirects in production
  if (process.env.NODE_ENV === "production" && url.includes("localhost")) {
    url = "https://portal.nfcsunn.org";
  }

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url.replace(/\/$/, "");
}

