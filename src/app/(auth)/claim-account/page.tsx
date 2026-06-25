"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginFormValues } from "@/lib/validations/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { claimLegacyAccount } from "@/lib/actions/migration.actions";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle2, ShieldCheck, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

function ClaimAccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const token = searchParams.get("token");

  const [isLoadingRecord, setIsLoadingRecord] = React.useState(true);
  const [legacyMember, setLegacyMember] = React.useState<any>(null);
  const [recordError, setRecordError] = React.useState<string | null>(null);

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [showPassword, setShowPassword] = React.useState(false);
  const [minPasswordLength, setMinPasswordLength] = React.useState(6);
  const [requireNumbers, setRequireNumbers] = React.useState(false);
  const [requireSymbols, setRequireSymbols] = React.useState(false);

  React.useEffect(() => {
    const savedLength = localStorage.getItem("settings_sec_min_length");
    const savedNum = localStorage.getItem("settings_sec_req_num");
    const savedSym = localStorage.getItem("settings_sec_req_sym");

    if (savedLength) setMinPasswordLength(parseInt(savedLength, 10));
    if (savedNum !== null) setRequireNumbers(savedNum === "true");
    if (savedSym !== null) setRequireSymbols(savedSym === "true");
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const watchedValues = watch();
  const passwordVal = watchedValues.password || "";

  const passwordRules = {
    lowercase: /[a-z]/.test(passwordVal),
    uppercase: /[A-Z]/.test(passwordVal),
    numbers: /[0-9]/.test(passwordVal),
    special: /[^a-zA-Z0-9]/.test(passwordVal),
    length: passwordVal.length >= minPasswordLength,
  };

  // Verify token on mount
  React.useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setRecordError("Missing account claiming token. Please check your invitation link.");
        setIsLoadingRecord(false);
        return;
      }

      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from("legacy_members")
          .select("*")
          .eq("claim_token", token)
          .single();

        if (error || !data) {
          setRecordError("Invalid claim token. Record could not be found.");
        } else {
          // Check expiry
          const expiry = new Date(data.claim_token_expires || "");
          if (expiry < new Date()) {
            setRecordError("Claim token has expired. Please contact an Exco to issue a new invite link.");
          } else {
            setLegacyMember(data);
            if (data.email) {
              setValue("email", data.email);
            }
          }
        }
      } catch (err) {
        setRecordError("Failed to verify invitation token.");
      } finally {
        setIsLoadingRecord(false);
      }
    }
    verifyToken();
  }, [token, setValue]);

  const onSubmit = async (values: LoginFormValues) => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    if (values.password.length < minPasswordLength) {
      setError(`Password must be at least ${minPasswordLength} characters.`);
      setIsSubmitting(false);
      return;
    }
    if (requireNumbers && !/[0-9]/.test(values.password)) {
      setError("Password must contain at least one numeric digit.");
      setIsSubmitting(false);
      return;
    }
    if (requireSymbols && !/[^a-zA-Z0-9]/.test(values.password)) {
      setError("Password must contain at least one special character.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await claimLegacyAccount(token, values.email, values.password);
      if (response?.error) {
        setError(response.error);
        toast({
          title: "Claim Failed",
          description: response.error,
          variant: "error",
        });
      } else {
        setSuccess(true);
        toast({
          title: "Account Activated",
          description: "Your portal profile is active! You can now log in.",
          variant: "success",
        });
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-surface-page px-4 select-none">
      <div className="w-full max-w-[420px] flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="h-12 w-12 rounded-[10px] overflow-hidden select-none">
            <img src="/nfcs-unn-logo.png" alt="NFCS UNN Logo" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-text-primary">
              NFCS UNN Portal
            </h1>
            <p className="text-xs text-text-secondary">
              Catholic Student & Alumni Member Portal
            </p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="border border-neutrals-borderLight shadow-card bg-white overflow-hidden animate-in fade-in duration-200">
          <CardContent className="p-8">
            <div className="flex flex-col gap-1 mb-6">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-accent mb-2 select-none"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
              <h2 className="text-base font-semibold text-text-primary">
                Claim Portal Account
              </h2>
              <p className="text-xs text-text-tertiary">
                Activate your imported profile by setting a password.
              </p>
            </div>

            {isLoadingRecord ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <div className="h-6 w-6 border-2 border-brand border-t-transparent animate-spin rounded-full" />
                <span className="text-xs text-text-secondary">Verifying token...</span>
              </div>
            ) : recordError ? (
              <div className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-status-errorBackground border border-status-errorBorder text-status-errorText">
                <AlertCircle className="h-8 w-8 text-status-errorText" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold">Verification Failed</h3>
                  <p className="text-[11px] leading-relaxed opacity-95">{recordError}</p>
                </div>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-status-successBackground border border-status-successBorder text-status-successText animate-in zoom-in-95">
                <CheckCircle2 className="h-8 w-8 text-status-successText" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold">Account Claimed!</h3>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    Welcome to the portal! Your historical payments have been successfully transferred. Redirecting you to login...
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Legacy Profile Box */}
                <div className="p-3.5 rounded-xl border border-[#BBF7D0] bg-brand-light flex items-center gap-3 text-brand-accent">
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  <div className="text-left text-xs leading-normal">
                    <p className="font-bold">Record Found</p>
                    <p className="font-semibold text-text-primary mt-0.5">{legacyMember?.full_name}</p>
                    <p className="text-[11px] text-text-secondary">{legacyMember?.matric_number || "No matric number"}</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 rounded-lg bg-status-errorBackground p-3 text-xs font-semibold text-status-errorText border border-status-errorBorder">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="email" className="text-xs font-semibold text-text-secondary">
                      Verify Email Address
                    </label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      error={!!errors.email}
                      disabled={isSubmitting}
                      {...register("email")}
                    />
                    {errors.email && (
                      <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        {errors.email.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="password" className="text-xs font-semibold text-text-secondary">
                      Set New Password
                    </label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={`Minimum ${minPasswordLength} characters`}
                        error={!!errors.password}
                        disabled={isSubmitting}
                        className="pr-10"
                        {...register("password")}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-medium">
                        <AlertCircle className="h-3 w-3" />
                        {errors.password.message}
                      </p>
                    )}

                    {/* Dynamic complexity checklist card */}
                    <div className="mt-2.5 p-3 bg-surface-subtle rounded-lg border border-border space-y-1.5 text-left">
                      <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Password must contain:</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.lowercase ? "bg-emerald-500" : "bg-text-muted")} />
                          <span>lower-case</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.numbers ? "bg-emerald-500" : "bg-text-muted")} />
                          <span>numbers {requireNumbers && <span className="text-danger">*</span>}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.uppercase ? "bg-emerald-500" : "bg-text-muted")} />
                          <span>upper-case</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-text-secondary">
                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.length ? "bg-emerald-500" : "bg-text-muted")} />
                          <span>{minPasswordLength}+ characters</span>
                        </div>
                        {requireSymbols && (
                          <div className="flex items-center gap-1.5 text-[10px] text-text-secondary col-span-2">
                            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", passwordRules.special ? "bg-emerald-500" : "bg-text-muted")} />
                            <span>special character (e.g. !@#$) <span className="text-danger">*</span></span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isSubmitting}>
                    Activate Account
                  </Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ClaimAccountPage() {
  return (
    <React.Suspense fallback={
      <main className="min-h-screen w-full flex items-center justify-center bg-surface-page px-4 select-none">
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <div className="h-6 w-6 border-2 border-brand border-t-transparent animate-spin rounded-full" />
          <span className="text-xs text-text-secondary">Loading account claim...</span>
        </div>
      </main>
    }>
      <ClaimAccountContent />
    </React.Suspense>
  );
}
