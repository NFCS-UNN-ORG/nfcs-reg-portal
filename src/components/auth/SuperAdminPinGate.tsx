"use client";

import * as React from "react";
import { useUser } from "@/hooks/useUser";
import { usePathname, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ShieldAlert, Lock, ArrowLeft, KeyRound, CheckCircle } from "lucide-react";

const DEFAULT_SUPER_ADMIN_PIN = "779911";

export function SuperAdminPinGate({ children }: { children: React.ReactNode }) {
  const { profile, isLoading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const [isVerified, setIsVerified] = React.useState(false);
  const [isCheckingSession, setIsCheckingSession] = React.useState(true);
  const [pinInput, setPinInput] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Is current user Super Admin?
  const isSuperAdmin =
    profile &&
    (profile.role === "super_admin" || profile.email?.toLowerCase() === "info.nfcsunn@gmail.com");

  // Check if session is already PIN-verified
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const verified = sessionStorage.getItem("super_admin_pin_verified") === "true";
      setIsVerified(verified);
      setIsCheckingSession(false);
    }
  }, []);

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const savedPin =
      process.env.NEXT_PUBLIC_SUPER_ADMIN_PIN ||
      localStorage.getItem("settings_super_admin_pin") ||
      DEFAULT_SUPER_ADMIN_PIN;

    if (pinInput.trim() === savedPin.trim()) {
      sessionStorage.setItem("super_admin_pin_verified", "true");
      setIsVerified(true);
      toast({
        title: "Access Granted",
        description: "Super Admin security PIN verified successfully.",
        variant: "success",
      });
    } else {
      setErrorMsg("Incorrect Security PIN. Please try again.");
      toast({
        title: "Authorization Failed",
        description: "Incorrect Super Admin Security PIN.",
        variant: "error",
      });
      setPinInput("");
    }
  };

  if (isLoading || isCheckingSession) {
    return null;
  }

  // If user is not super admin or if already verified, render children normally
  if (!isSuperAdmin || isVerified) {
    return <>{children}</>;
  }

  return (
    <Dialog open modal>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-[440px]"
      >
        <DialogHeader showClose={false}>
          <DialogTitle className="flex items-center gap-2 text-brand">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Super Admin Security Challenge
          </DialogTitle>
          <DialogDescription className="text-xs text-text-secondary">
            Authorized Super Admin account detected (<strong className="text-text-primary">info.nfcsunn@gmail.com</strong>). Please enter your 6-digit Security PIN to unlock administrative controls.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleVerifyPin}>
          <DialogBody className="space-y-4 py-2">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                <span>Security PIN Passcode</span>
                <span className="text-[10px] text-text-tertiary">Default: 779911</span>
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                <Input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••••"
                  className="pl-9 tracking-widest text-center text-base font-bold h-11"
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              <span className="font-bold">Security Protection:</span> This PIN challenge prevents unauthorized access even if Google account access is shared.
            </div>
          </DialogBody>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push("/dashboard")}
              className="w-full sm:w-auto text-xs font-semibold gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Return to Dashboard
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={pinInput.length < 6}
              className="w-full sm:w-auto text-xs font-semibold gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" /> Unlock Admin Access
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
