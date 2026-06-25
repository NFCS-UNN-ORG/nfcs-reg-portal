"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { updatePassword } from "@/lib/actions/auth.actions";
import { AlertCircle, CheckCircle2, ChevronLeft, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

const resetPasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Confirm password must be at least 6 characters"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const { toast } = useToast();

  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

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
    watch,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
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

  const onSubmit = async (values: ResetPasswordValues) => {
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
      const response = await updatePassword(values.password);
      if (response?.error) {
        setError(response.error);
        toast({
          title: "Reset Failed",
          description: response.error,
          variant: "error",
        });
      } else {
        setSuccess(true);
        toast({
          title: "Password Updated",
          description: "Your password has been successfully reset. Redirecting to login...",
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
    <main className="min-h-screen w-full flex items-center justify-center bg-surface-page px-4 select-none animate-in fade-in duration-200">
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
        <Card className="border border-neutrals-borderLight shadow-card bg-white overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col gap-1 mb-6">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-accent mb-2 select-none"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Back to Sign In
              </Link>
              <h2 className="text-base font-semibold text-text-primary">
                Reset Password
              </h2>
              <p className="text-xs text-text-tertiary">
                Enter your new password below to update your credentials.
              </p>
            </div>

            {success ? (
              <div className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-status-successBackground border border-status-successBorder text-status-successText animate-in zoom-in-95">
                <CheckCircle2 className="h-8 w-8 text-status-successText" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold">Password Reset Successful!</h3>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    Your password has been successfully updated. Redirecting you to login...
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-status-errorBackground p-3 text-xs font-semibold text-status-errorText border border-status-errorBorder">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-left">
                  <label htmlFor="password" className="text-xs font-semibold text-text-secondary">
                    New Password
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
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="confirmPassword" className="text-xs font-semibold text-text-secondary">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      error={!!errors.confirmPassword}
                      disabled={isSubmitting}
                      className="pr-10"
                      {...register("confirmPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-medium">
                      <AlertCircle className="h-3 w-3" />
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* Complexity checklist card */}
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

                <Button type="submit" variant="primary" className="w-full mt-4" isLoading={isSubmitting}>
                  Update Password
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={
      <main className="min-h-screen w-full flex items-center justify-center bg-surface-page px-4 select-none">
        <div className="flex flex-col items-center justify-center py-10 gap-2">
          <div className="h-6 w-6 border-2 border-brand border-t-transparent animate-spin rounded-full" />
          <span className="text-xs text-text-secondary">Loading reset password...</span>
        </div>
      </main>
    }>
      <ResetPasswordContent />
    </React.Suspense>
  );
}
