"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  label?: string;
  className?: string;
}

export function GoogleSignInButton({
  label = "Continue with Google",
  className = "",
}: GoogleSignInButtonProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isGsiReady, setIsGsiReady] = React.useState(false);
  const googleBtnRef = React.useRef<HTMLDivElement>(null);

  const handleCredentialResponse = async (response: any) => {
    const idToken = response?.credential;
    if (!idToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        console.error("Supabase signInWithIdToken error:", error);
        toast({
          title: "Google Sign-In Failed",
          description: error.message || "Could not authenticate with Google.",
          variant: "error",
        });
        setIsLoading(false);
      } else {
        toast({
          title: "Signed In",
          description: "Welcome to NFCS UNN Portal!",
          variant: "success",
        });
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Google sign in exception:", err);
      toast({
        title: "Sign In Error",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
      setIsLoading(false);
    }
  };

  const handleOAuthFallback = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=/dashboard`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        toast({
          title: "Google Sign-In Error",
          description: error.message?.includes("not enabled")
            ? "Google provider is not enabled in Supabase. Please turn on Google under Supabase Dashboard > Authentication > Providers."
            : error.message,
          variant: "error",
        });
        setIsLoading(false);
      }
    } catch (err: any) {
      toast({
        title: "Sign In Error",
        description: err?.message || "An error occurred during Google sign in.",
        variant: "error",
      });
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initGsi = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          // Clear previous children
          googleBtnRef.current.innerHTML = "";

          // Render official GIS standard button inside container
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            type: "standard",
            theme: "outline",
            size: "large",
            width: 350,
            text: "continue_with",
            shape: "rectangular",
            logo_alignment: "left",
          });

          setIsGsiReady(true);
        } catch (e) {
          console.error("GIS initialization error:", e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 150);
      return () => clearInterval(interval);
    }
  }, []);

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {/* Official Native GIS Google Button (Rendered directly) */}
      <div
        ref={googleBtnRef}
        className="w-full flex justify-center min-h-[40px] select-none"
      />

      {/* Fallback button if GIS script is loading or blocked by adblockers */}
      {!isGsiReady && (
        <Button
          type="button"
          variant="secondary"
          onClick={handleOAuthFallback}
          disabled={isLoading}
          className={`w-full h-10 gap-2.5 bg-surface-subtle hover:bg-surface-page border border-neutrals-borderLight text-text-primary text-xs font-semibold rounded-lg transition-all shadow-sm ${className}`}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
          ) : (
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          )}
          <span>{label}</span>
        </Button>
      )}
    </div>
  );
}
