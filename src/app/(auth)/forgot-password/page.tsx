"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validations/auth.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { requestPasswordReset } from "@/lib/actions/auth.actions";
import { AlertCircle, CheckCircle2, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append("email", values.email);

    try {
      const response = await requestPasswordReset(formData);
      if (response?.error) {
        setError(response.error);
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-surface-page px-4">
      <div className="w-full max-w-[400px] flex flex-col gap-6">
        {/* Brand Header */}
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

        {/* Card */}
        <Card className="border border-neutrals-borderLight shadow-card bg-white overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col gap-1 mb-6">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-accent mb-2 select-none"
              >
                <ChevronLeft className="h-3 w-3" /> Back to Sign In
              </Link>
              <h2 className="text-base font-semibold text-text-primary">
                Reset Password
              </h2>
              <p className="text-xs text-text-tertiary">
                Enter your email address and we will send you a reset link.
              </p>
            </div>

            {success ? (
              <div className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-status-successBackground border border-status-successBorder text-status-successText">
                <CheckCircle2 className="h-8 w-8 text-status-successText" />
                <div className="space-y-1">
                  <h3 className="text-xs font-bold">Request Processed</h3>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    If an account exists for this email, a password reset link has been sent. Check your inbox (and spam folder).
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg bg-status-errorBackground p-3 text-xs font-semibold text-status-errorText border border-status-errorBorder animate-in fade-in-50 duration-150">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-semibold text-text-secondary">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    error={!!errors.email}
                    disabled={isLoading}
                    {...register("email")}
                  />
                  {errors.email && (
                    <p className="text-[11px] text-danger flex items-center gap-1 mt-1 font-medium">
                      <AlertCircle className="h-3 w-3" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <Button type="submit" variant="primary" className="w-full mt-2" isLoading={isLoading}>
                  Send Reset Link
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="text-center text-[10px] text-text-tertiary">
          &copy; {new Date().getFullYear()} NFCS UNN. All rights reserved.
        </p>
      </div>
    </main>
  );
}
