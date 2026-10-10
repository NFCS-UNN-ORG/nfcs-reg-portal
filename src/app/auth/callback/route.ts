import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/utils/app-url";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
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

  // If Supabase returned an explicit error parameter
  if (error || errorDescription) {
    console.error("[auth/callback] Supabase auth error param:", error, errorDescription);
    if (next.startsWith("/reset-password")) {
      return NextResponse.redirect(
        `${redirectBase}/reset-password?error=${encodeURIComponent(errorDescription || error || "Reset link expired")}`
      );
    }
    return NextResponse.redirect(
      `${redirectBase}/login?error=${encodeURIComponent(errorDescription || error || "Authentication failed")}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return NextResponse.redirect(`${redirectBase}${next}`);
    } else {
      console.error("[auth/callback] exchangeCodeForSession error:", exchangeError);
      if (next.startsWith("/reset-password")) {
        return NextResponse.redirect(
          `${redirectBase}/reset-password?error=${encodeURIComponent(exchangeError.message)}`
        );
      }
    }
  }

  // If next is /reset-password (e.g. implicit hash-based redirect #access_token=... or #error=...)
  if (next.startsWith("/reset-password")) {
    return NextResponse.redirect(`${redirectBase}/reset-password`);
  }

  // Return user to login page if code exchange fails or code is missing
  return NextResponse.redirect(`${redirectBase}/login?error=Authentication%20failed`);
}


