import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";

  // Prevent open redirects: only allow relative paths starting with "/"
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/reset-password";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Redirect user to specified destination with session cookie established
      return NextResponse.redirect(new URL(safeNext, request.url));
    } else {
      console.error("[auth/confirm] verifyOtp error:", error.message);
    }
  }

  // If missing params or verifyOtp fails
  return NextResponse.redirect(new URL("/reset-password?error=invalid_link", request.url));
}
