"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { saveSecuritySettings } from "@/lib/actions/dues-config.actions";
import { ShieldCheck, Loader2 } from "lucide-react";

export function SecuritySettingsEditor({ adminId }: { adminId: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [minPasswordLength, setMinPasswordLength] = React.useState(6);
  const [requireNumbers, setRequireNumbers] = React.useState(false);
  const [requireSymbols, setRequireSymbols] = React.useState(false);
  const [sessionExpiry, setSessionExpiry] = React.useState(7); // days
  const [mfaRequired, setMfaRequired] = React.useState(false);
  const [superAdminPin, setSuperAdminPin] = React.useState("779911");

  // Load from localStorage on mount
  React.useEffect(() => {
    const savedLength = localStorage.getItem("settings_sec_min_length");
    const savedNum = localStorage.getItem("settings_sec_req_num");
    const savedSym = localStorage.getItem("settings_sec_req_sym");
    const savedExp = localStorage.getItem("settings_sec_session_exp");
    const savedMfa = localStorage.getItem("settings_sec_mfa_req");
    const savedPin = localStorage.getItem("settings_super_admin_pin");

    if (savedLength) setMinPasswordLength(parseInt(savedLength, 10));
    if (savedNum !== null) setRequireNumbers(savedNum === "true");
    if (savedSym !== null) setRequireSymbols(savedSym === "true");
    if (savedExp) setSessionExpiry(parseInt(savedExp, 10));
    if (savedMfa !== null) setMfaRequired(savedMfa === "true");
    if (savedPin) setSuperAdminPin(savedPin);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const values = {
      minPasswordLength,
      requireNumbers,
      requireSymbols,
      sessionExpiry,
      mfaRequired,
    };

    try {
      const res = await saveSecuritySettings(values, adminId);
      if (res.error) {
        toast({
          title: "Save Failed",
          description: res.error,
          variant: "error",
        });
      } else {
        // Save to localStorage
        localStorage.setItem("settings_sec_min_length", String(minPasswordLength));
        localStorage.setItem("settings_sec_req_num", String(requireNumbers));
        localStorage.setItem("settings_sec_req_sym", String(requireSymbols));
        localStorage.setItem("settings_sec_session_exp", String(sessionExpiry));
        localStorage.setItem("settings_sec_mfa_req", String(mfaRequired));
        localStorage.setItem("settings_super_admin_pin", superAdminPin);


        toast({
          title: "Settings Saved",
          description: "Security credentials policy updated.",
          variant: "success",
        });
      }
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err?.message || "An unexpected error occurred.",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-brand" /> Portal Security Policies
        </CardTitle>
        <CardDescription>
          Configure authentication limits, password requirements, and administration token policies.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          {/* Password Policy */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-text-primary border-b border-neutrals-borderLight pb-1.5">User Password Strength Requirements</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-text-secondary">Min Password Length</label>
                <Input
                  type="number"
                  min={6}
                  max={20}
                  value={minPasswordLength}
                  onChange={(e) => setMinPasswordLength(parseInt(e.target.value, 10))}
                  required
                />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-neutrals-borderLight bg-surface-page select-none sm:col-span-2">
                <div className="space-y-0.5">
                  <h5 className="text-[11px] font-semibold text-text-primary">Require Numeric Digits</h5>
                  <p className="text-[9px] text-text-tertiary">Force users to include at least one number (0-9) in their passwords.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireNumbers(!requireNumbers)}
                  className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    requireNumbers ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                      requireNumbers ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Session Token Settings */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Auth Session Expiry (Days)</label>
              <Input
                type="number"
                min={1}
                max={30}
                value={sessionExpiry}
                onChange={(e) => setSessionExpiry(parseInt(e.target.value, 10))}
                required
              />
              <p className="text-[9px] text-text-tertiary">Number of days before an inactive user session is forced to log in again.</p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-neutrals-borderLight bg-surface-page select-none">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-text-primary">Admin MFA Policy</h4>
                <p className="text-[9px] text-text-tertiary">Force Multi-Factor Authentication for Exco and Super Admin access.</p>
              </div>
              <button
                type="button"
                onClick={() => setMfaRequired(!mfaRequired)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  mfaRequired ? "bg-brand" : "bg-neutral-300 dark:bg-neutral-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                    mfaRequired ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Super Admin Security PIN */}
          <div className="space-y-2 pt-2 border-t border-neutrals-borderLight">
            <h4 className="text-xs font-bold text-text-primary">Super Admin Security Challenge PIN</h4>
            <p className="text-[10px] text-text-tertiary">6-digit PIN required to unlock administrative controls when signing in as info.nfcsunn@gmail.com.</p>
            <div className="max-w-xs space-y-1">
              <Input
                type="password"
                maxLength={6}
                value={superAdminPin}
                onChange={(e) => setSuperAdminPin(e.target.value)}
                placeholder="779911"
                className="text-xs font-mono tracking-widest h-9"
              />
            </div>
          </div>


          {/* Submit Button */}
          <div className="flex justify-end pt-3 border-t border-neutrals-borderLight">
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="px-6 h-9 text-xs font-semibold"
            >
              Save Security Policies
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
