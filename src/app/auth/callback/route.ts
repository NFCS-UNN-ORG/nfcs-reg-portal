import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/app-url";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const appUrl = getAppUrl();

  const getRedirectBase = () => {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";

    if (forwardedHost && !isLocalEnv) {
      return `https://${forwardedHost}`;
    }
    if (isLocalEnv) {
      return origin;
    }
    return appUrl;
  };

  const redirectBase = getRedirectBase();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${redirectBase}${next}`);
    } else {
      console.error("[auth/callback] exchangeCodeForSession error:", error);
    }
  }

  // Return user to login page if code exchange fails or code is missing
  return NextResponse.redirect(`${redirectBase}/login?error=Authentication%20failed`);
}

