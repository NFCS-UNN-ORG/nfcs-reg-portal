"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentFormValues } from "@/lib/validations/payment.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { initiatePayment } from "@/lib/actions/payment.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CreditCard, ChevronLeft, Info } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { getYearsOfStudy, isAlumnus } from "@/lib/utils/unn-data";
import {
  calculateFee,
  getLevelOrdinal,
  deriveSessionLabel,
  CURRENT_SESSION,
} from "@/lib/utils/fees";

function PayDuesFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { profile, isLoading: isUserLoading } = useUser();
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (profile?.role === "super_admin") {
      router.push("/dashboard");
    }
  }, [profile, router]);

  // Pre-fill from URL params (from tracker "Pay Now" button)
  const prefilledYear = searchParams.get("year");
  const prefilledSession = searchParams.get("session");
  const prefilledType = searchParams.get("type");

  const userIsAlumnus = isAlumnus(profile?.role);
  const levelOrdinal = getLevelOrdinal(profile?.academic_level);
  const totalCourseYears = getYearsOfStudy(profile?.faculty);

  // Determine the target year ordinal: from URL or default to current level
  const targetYearOrdinal = prefilledYear
    ? parseInt(prefilledYear, 10)
    : levelOrdinal;

  // Calculate fee breakdown for the target year
  const feeBreakdown = targetYearOrdinal > 0
    ? calculateFee(targetYearOrdinal, totalCourseYears)
    : null;

  // Derive session label
  const sessionLabel = prefilledSession
    ? decodeURIComponent(prefilledSession)
    : targetYearOrdinal > 0
      ? deriveSessionLabel(levelOrdinal, targetYearOrdinal, CURRENT_SESSION)
      : CURRENT_SESSION;

  // Determine default dues type
  const defaultDuesType = prefilledType
    ? prefilledType
    : userIsAlumnus
      ? "special_levy"
      : targetYearOrdinal === 1
        ? "membership_levy"
        : "annual_dues";

  // Default amount
  const defaultAmount = userIsAlumnus
    ? "500"
    : feeBreakdown
      ? feeBreakdown.total.toString()
      : "400";

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: defaultAmount,
      dues_type: defaultDuesType as any,
      payment_period: sessionLabel,
      notes: "",
    },
  });

  const watchedDuesType = watch("dues_type");

  // Recalculate amount when dues type changes (for students)
  React.useEffect(() => {
    if (!userIsAlumnus && feeBreakdown) {
      if (watchedDuesType === "membership_levy" || watchedDuesType === "annual_dues") {
        setValue("amount", feeBreakdown.total.toString());
      }
    }
  }, [watchedDuesType, feeBreakdown, userIsAlumnus, setValue]);

  // Prefill when profile loads
  React.useEffect(() => {
    if (profile && !prefilledYear) {
      const newAmount = userIsAlumnus
        ? "500"
        : feeBreakdown
          ? feeBreakdown.total.toString()
          : "400";

      reset({
        amount: newAmount,
        dues_type: defaultDuesType as any,
        payment_period: sessionLabel,
        notes: "",
      });
    }
  }, [profile]);

  const onSubmit = async (values: PaymentFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await initiatePayment({
        amount: parseFloat(values.amount),
        dues_type: values.dues_type,
        payment_period: values.payment_period,
        notes: values.notes,
      });

      if (response?.error) {
        setError(response.error);
        toast({
          title: "Payment Error",
          description: response.error,
          variant: "error",
        });
      } else if (response?.reference) {
        toast({
          title: "Order Initiated",
          description: "Forwarding you to the secure checkout sandbox...",
          variant: "info",
        });
        router.push(`/dues/pay/checkout?ref=${response.reference}`);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Available payment types based on role
  const paymentTypeOptions = userIsAlumnus
    ? [
        { value: "special_levy", label: "Special Levy / Donation" },
        { value: "other", label: "Other Payments" },
      ]
    : [
        { value: "annual_dues", label: "Annual Session Dues" },
        { value: "membership_levy", label: "Registration Levy (1st Year)" },
        { value: "special_levy", label: "Special Levy / Donation" },
        { value: "other", label: "Other Payments" },
      ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1 select-none">
        <Link
          href="/dues"
          className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-accent mb-2 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to My Dues
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Pay Levies & Dues
        </h1>
        <p className="text-xs text-text-secondary">
          Initiate secure online card/bank transfer dues payments.
        </p>
      </div>

      {/* Card Wrapper */}
      <Card className="max-w-[560px] mx-auto border border-neutrals-borderLight shadow-card bg-white">
        <CardContent className="p-8">
          {/* Fee Breakdown Info Box (students only) */}
          {!userIsAlumnus && feeBreakdown && (
            <div className="mb-6 rounded-lg bg-brand-light border border-brand-border p-4">
              <div className="flex items-start gap-2 mb-3">
                <Info className="h-4 w-4 text-brand-accent shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-text-primary">
                    {feeBreakdown.label} Fee Breakdown
                  </p>
                  <p className="text-[10px] text-text-tertiary">
                    Session: {sessionLabel}
                    {feeBreakdown.isFinalistYear && " (Finalist Year)"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/60 rounded-md p-2">
                  <p className="text-[10px] text-text-tertiary">Annual Dues</p>
                  <p className="text-sm font-bold text-text-primary font-mono">₦{feeBreakdown.annualDues}</p>
                </div>
                <div className="bg-white/60 rounded-md p-2">
                  <p className="text-[10px] text-text-tertiary">Constitution</p>
                  <p className="text-sm font-bold text-text-primary font-mono">₦{feeBreakdown.constitution}</p>
                </div>
                <div className="bg-white/60 rounded-md p-2">
                  <p className="text-[10px] text-text-tertiary">CGAN</p>
                  <p className="text-sm font-bold text-text-primary font-mono">
                    ₦{feeBreakdown.cgan}
                    {feeBreakdown.isFinalistYear && (
                      <Badge variant="pending" className="ml-1.5 text-[8px] py-0">Finalist</Badge>
                    )}
                  </p>
                </div>
                <div className="bg-brand/5 rounded-md p-2 border border-brand-border">
                  <p className="text-[10px] text-brand-accent font-semibold">Total</p>
                  <p className="text-sm font-bold text-brand font-mono">₦{feeBreakdown.total}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-status-errorBackground p-3 text-xs font-semibold text-status-errorText border border-status-errorBorder animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Dues Levy Type</label>
              <Select error={!!errors.dues_type} {...register("dues_type")} disabled={isLoading}>
                {paymentTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              {errors.dues_type && <p className="text-[11px] text-danger mt-1">{errors.dues_type.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Amount to Pay (₦)</label>
              <Input
                error={!!errors.amount}
                {...register("amount")}
                placeholder="5000"
                disabled={isLoading}
                readOnly={
                  !userIsAlumnus &&
                  (watchedDuesType === "annual_dues" || watchedDuesType === "membership_levy")
                }
                className={
                  !userIsAlumnus &&
                  (watchedDuesType === "annual_dues" || watchedDuesType === "membership_levy")
                    ? "bg-gray-50 cursor-not-allowed"
                    : ""
                }
              />
              {!userIsAlumnus &&
                (watchedDuesType === "annual_dues" || watchedDuesType === "membership_levy") && (
                  <p className="text-[10px] text-text-tertiary">
                    Amount is auto-calculated based on your academic level and programme.
                  </p>
                )}
              {errors.amount && <p className="text-[11px] text-danger mt-1">{errors.amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Academic Session / Period</label>
              <Input
                error={!!errors.payment_period}
                {...register("payment_period")}
                placeholder="2024/2025"
                disabled={isLoading}
              />
              {errors.payment_period && (
                <p className="text-[11px] text-danger mt-1">{errors.payment_period.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Payment Description Notes (Optional)
              </label>
              <Input
                {...register("notes")}
                placeholder="e.g. Annual dues payment for 2024/2025 academic session"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full gap-2 font-semibold h-11"
              isLoading={isLoading}
            >
              <CreditCard className="h-4 w-4" /> Proceed to Secure Checkout
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PayDuesPage() {
  return (
    <React.Suspense fallback={
      <div className="flex h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutrals-borderLight border-t-brand" />
          <p className="text-xs text-text-secondary">Loading payment details...</p>
        </div>
      </div>
    }>
      <PayDuesFormContent />
    </React.Suspense>
  );
}
