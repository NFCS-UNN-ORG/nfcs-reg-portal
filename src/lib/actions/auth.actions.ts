"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAppUrl } from "@/lib/utils/app-url";

export async function login(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      return { error: "Email and password are required" };
    }

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        return { error: "Email not confirmed. Please check your inbox and confirm your email address before logging in." };
      }
      return { error: error.message };
    }

    if (data?.user && !data.user.email_confirmed_at && !data.user.confirmed_at) {
      await supabase.auth.signOut();
      return {
        error: "Email not confirmed. Please check your inbox and confirm your email address before logging in.",
      };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err: any) {
    console.error("[login action error]:", err);
    if (err?.message?.includes("fetch failed")) {
      return { error: "Network connection error. Please check your internet connection and try again." };
    }
    return { error: err?.message || "Failed to sign in. Please try again." };
  }
}

export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/", "layout");
  return { success: true };
}

export async function requestPasswordReset(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    return { error: "Email is required" };
  }

  try {
    const supabase = await createClient();
    const appUrl = getAppUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
    });

    if (error) {
      console.warn("[requestPasswordReset] Supabase resetPasswordForEmail error:", error.message);
      // For security rate limit errors, pass error message along, otherwise return generic success
      if (error.status === 429) {
        return { error: error.message };
      }
    }

    // Always return success to prevent email enumeration
    return { success: true };
  } catch (err: any) {
    console.error("[requestPasswordReset] Unexpected error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function resendConfirmationEmail(email: string) {
  if (!email) {
    return { error: "Email address is required" };
  }

  try {
    const supabase = await createClient();
    const appUrl = getAppUrl();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/login`,
      },
    });

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to resend confirmation email" };
  }
}

export async function updatePassword(password: string) {
  if (!password || password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
