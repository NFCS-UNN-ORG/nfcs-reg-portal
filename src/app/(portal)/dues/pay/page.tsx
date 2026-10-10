"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentSchema, type PaymentFormValues } from "@/lib/validations/payment.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { getMyPayments } from "@/lib/actions/payment.actions";
import { initiatePaystackPayment } from "@/lib/actions/paystack.actions";
import { initiateFlutterwavePayment } from "@/lib/actions/flutterwave.actions";
import { getPaymentSettings } from "@/lib/actions/dues-config.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, CreditCard, ChevronLeft, Info, ShieldCheck, Layers, CheckSquare } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { getYearsOfStudy, isAlumnus } from "@/lib/utils/unn-data";
import {
  buildPaymentTracker,
  calculateFee,
  getLevelOrdinal,
  deriveSessionLabel,
  CURRENT_SESSION,
  getPayableRequiredSession,
  isFullyPaid,
  isRequiredDuesType,
  type PaymentSession,
} from "@/lib/utils/fees";
import { formatAmountInput, formatNaira, parseMoneyAmount } from "@/lib/utils/money";

type PaymentRecord = {
  id: string;
  dues_type: string;
  payment_period: string | null;
  status: string;
  amount: number;
  payment_reference: string | null;
  payment_date: string | null;
  created_at: string | null;
};

function PayDuesFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { profile } = useUser();
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [payments, setPayments] = React.useState<PaymentRecord[]>([]);
  const [isPaymentsLoading, setIsPaymentsLoading] = React.useState(true);
  const [activeGateway, setActiveGateway] = React.useState<"paystack" | "flutterwave">("paystack");

  // Selected years for batch payment
  const [selectedYearOrdinals, setSelectedYearOrdinals] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (profile?.role === "super_admin") {
      router.push("/dashboard");
    }
  }, [profile, router]);

  React.useEffect(() => {
    async function loadActiveGateway() {
      const settings = await getPaymentSettings();
      if (settings?.activeGateway) {
        setActiveGateway(settings.activeGateway);
      }
    }
    loadActiveGateway();
  }, []);

  const activeGatewayName = activeGateway === "flutterwave" ? "Flutterwave" : "Paystack";

  // Pre-fill from URL params
  const prefilledYear = searchParams.get("year");
  const prefilledSession = searchParams.get("session");
  const prefilledType = searchParams.get("type");

  const userIsAlumnus = isAlumnus(profile?.role);
  const levelOrdinal = getLevelOrdinal(profile?.academic_level);
  const totalCourseYears = getYearsOfStudy(profile?.faculty, profile?.department);

  React.useEffect(() => {
    let mounted = true;

    async function loadPayments() {
      const result = await getMyPayments();
      if (!mounted) return;

      setPayments(result.payments || []);
      setIsPaymentsLoading(false);
    }

    loadPayments();
    return () => {
      mounted = false;
    };
  }, []);

  const tracker = React.useMemo(
    () =>
      !userIsAlumnus
        ? buildPaymentTracker({
            currentLevelOrdinal: levelOrdinal,
            totalCourseYears,
            existingPayments: payments.map((payment) => ({
              id: payment.id,
              dues_type: payment.dues_type,
              payment_period: payment.payment_period,
              status: payment.status,
              amount: payment.amount,
              payment_reference: payment.payment_reference,
              payment_date: payment.payment_date,
              created_at: payment.created_at,
            })),
            currentSession: CURRENT_SESSION,
          })
        : [],
    [levelOrdinal, payments, totalCourseYears, userIsAlumnus],
  );

  const nextRequiredSession = getPayableRequiredSession(tracker);
  const allRequiredPaid = isFullyPaid(tracker);

  // Unpaid eligible sessions
  const unpaidEligibleSessions = React.useMemo(
    () => tracker.filter((s) => s.isEligible && s.existingPayment?.status !== "confirmed"),
    [tracker]
  );

  // Initialize selected year ordinals once tracker loads
  React.useEffect(() => {
    if (unpaidEligibleSessions.length > 0 && selectedYearOrdinals.length === 0) {
      if (prefilledYear) {
        const targetOrd = parseInt(prefilledYear, 10);
        // Include target ord and any prior unpaid eligible years
        const requiredOrds = unpaidEligibleSessions
          .filter((s) => s.yearOrdinal <= targetOrd)
          .map((s) => s.yearOrdinal);
        setSelectedYearOrdinals(requiredOrds.length > 0 ? requiredOrds : [targetOrd]);
      } else if (nextRequiredSession) {
        setSelectedYearOrdinals([nextRequiredSession.yearOrdinal]);
      }
    }
  }, [unpaidEligibleSessions, prefilledYear, nextRequiredSession, selectedYearOrdinals.length]);

  // Selected sessions based on selection
  const selectedSessions = React.useMemo(
    () => tracker.filter((s) => selectedYearOrdinals.includes(s.yearOrdinal)),
    [tracker, selectedYearOrdinals]
  );

  const batchTotalAmount = selectedSessions.reduce((sum, s) => sum + s.breakdown.total, 0);

  // Determine default dues type
  const defaultDuesType = prefilledType
    ? prefilledType
    : userIsAlumnus
      ? "special_levy"
      : selectedSessions.length > 0
        ? selectedSessions[0].feeType
        : nextRequiredSession
          ? nextRequiredSession.feeType
          : "special_levy";

  const sessionLabel = selectedSessions.length > 0
    ? selectedSessions.map((s) => s.session).join(", ")
    : prefilledSession
      ? decodeURIComponent(prefilledSession)
      : CURRENT_SESSION;

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
      amount: batchTotalAmount > 0 ? formatAmountInput(String(batchTotalAmount)) : "",
      dues_type: defaultDuesType as PaymentFormValues["dues_type"],
      payment_period: sessionLabel,
      notes: "",
    },
  });

  const watchedDuesType = watch("dues_type");
  const selectedIsRequired = !userIsAlumnus && isRequiredDuesType(watchedDuesType);

  // Sync amount and period when selected sessions change
  React.useEffect(() => {
    if (selectedIsRequired && selectedSessions.length > 0) {
      setValue("amount", formatAmountInput(String(batchTotalAmount)));
      setValue("payment_period", selectedSessions.map((s) => s.session).join(", "));
    }
  }, [selectedIsRequired, selectedSessions, batchTotalAmount, setValue]);

  // Toggle year selection with auto-continuity
  const handleToggleYear = (yearOrdinal: number) => {
    if (selectedYearOrdinals.includes(yearOrdinal)) {
      // Uncheck this and any subsequent
      const nextSelected = selectedYearOrdinals.filter((ord) => ord < yearOrdinal);
      setSelectedYearOrdinals(nextSelected);
    } else {
      // Check this and all preceding unpaid eligible years
      const priorUnpaidOrds = unpaidEligibleSessions
        .filter((s) => s.yearOrdinal <= yearOrdinal)
        .map((s) => s.yearOrdinal);

      const nextSelected = Array.from(new Set([...selectedYearOrdinals, ...priorUnpaidOrds])).sort(
        (a, b) => a - b
      );
      setSelectedYearOrdinals(nextSelected);
    }
  };

  const handleSelectAllOutstanding = () => {
    setSelectedYearOrdinals(unpaidEligibleSessions.map((s) => s.yearOrdinal));
  };

  const handleClearSelection = () => {
    setSelectedYearOrdinals([]);
    setValue("amount", "");
  };

  const onSubmit = async (values: PaymentFormValues) => {
    setIsLoading(true);
    setError(null);

    try {
      const settings = await getPaymentSettings();
      const gatewayToUse = settings?.activeGateway || activeGateway;

      let payload: any;

      if (selectedIsRequired && selectedSessions.length > 0) {
        payload = {
          amount: batchTotalAmount,
          dues_type: selectedSessions[0].feeType,
          payment_period: selectedSessions.map((s) => s.session).join(", "),
          notes: values.notes,
          items: selectedSessions.map((s) => ({
            yearOrdinal: s.yearOrdinal,
            session: s.session,
            dues_type: s.feeType,
            amount: s.breakdown.total,
          })),
        };
      } else {
        payload = {
          amount: parseMoneyAmount(values.amount),
          dues_type: values.dues_type,
          payment_period: values.payment_period,
          notes: values.notes,
        };
      }

      const response = gatewayToUse === "flutterwave"
        ? await initiateFlutterwavePayment(payload)
        : await initiatePaystackPayment(payload);

      if (response?.error) {
        setError(response.error);
        toast({
          title: "Payment Error",
          description: response.error,
          variant: "error",
        });
      } else if (response?.checkoutUrl) {
        toast({
          title: "Order Initiated",
          description: `Forwarding to secure ${activeGatewayName} checkout...`,
          variant: "info",
        });

        if (response.isMock) {
          router.push(`/dues/pay/checkout?ref=${response.reference}`);
        } else {
          window.location.href = response.checkoutUrl;
        }
      } else if (response?.reference) {
        router.push(`/dues/pay/checkout?ref=${response.reference}`);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Available payment types based on role
  const requiredOption = !userIsAlumnus && unpaidEligibleSessions.length > 0
    ? [
        {
          value: unpaidEligibleSessions[0].feeType,
          label: `Academic Session Dues (${unpaidEligibleSessions.length} session${
            unpaidEligibleSessions.length > 1 ? "s" : ""
          } outstanding)`,
        },
      ]
    : [];

  const paymentTypeOptions = [
    ...requiredOption,
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
          Initiate secure online card / bank transfer dues payments via {activeGatewayName}.
        </p>
      </div>

      {/* Card Wrapper */}
      <Card className="max-w-[620px] mx-auto border border-neutrals-borderLight shadow-card bg-white">
        <CardContent className="p-8">
          {/* Active Gateway Badge */}
          <div className="mb-4 flex items-center justify-between p-2.5 rounded-lg bg-surface-subtle border border-neutrals-border text-xs">
            <span className="text-text-secondary font-medium flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-brand" /> Secured by
            </span>
            <Badge variant="active" className="font-semibold">
              {activeGatewayName}
            </Badge>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-status-errorBackground p-3 text-xs font-semibold text-status-errorText border border-status-errorBorder animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Payment Category</label>
              <Select error={!!errors.dues_type} {...register("dues_type")} disabled={isLoading}>
                {paymentTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              {errors.dues_type && <p className="text-[11px] text-danger mt-1">{errors.dues_type.message}</p>}
            </div>

            {/* ─── MULTI-SESSION BATCH CHECKLIST FOR STUDENTS ─── */}
            {selectedIsRequired && unpaidEligibleSessions.length > 0 && (
              <div className="rounded-xl border border-neutrals-borderLight bg-surface-page p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutrals-borderLight pb-2.5">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-brand-accent" />
                      Select Academic Sessions to Pay
                    </h3>
                    <p className="text-[10px] text-text-tertiary">
                      You can pay for all outstanding sessions in one checkout.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSelectAllOutstanding}
                      className="h-7 text-[10px] px-2.5 gap-1.5 text-brand-accent border-brand-border bg-white hover:bg-brand-light"
                    >
                      <CheckSquare className="h-3 w-3" />
                      Pay All (
                      {formatNaira(
                        unpaidEligibleSessions.reduce((sum, s) => sum + s.breakdown.total, 0)
                      )}
                      )
                    </Button>
                    {selectedYearOrdinals.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSelection}
                        className="h-7 text-[10px] px-2 text-text-secondary"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {tracker
                    .filter((s) => s.isEligible)
                    .map((session) => {
                      const isPaid = session.existingPayment?.status === "confirmed";
                      const isSelected = selectedYearOrdinals.includes(session.yearOrdinal);

                      return (
                        <div
                          key={session.yearOrdinal}
                          onClick={() => {
                            if (!isPaid) handleToggleYear(session.yearOrdinal);
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-lg border transition-all select-none ${
                            isPaid
                              ? "bg-emerald-50/40 border-emerald-200 cursor-default"
                              : isSelected
                                ? "bg-white border-brand-accent shadow-xs cursor-pointer"
                                : "bg-white/70 border-neutrals-borderLight hover:border-gray-300 cursor-pointer"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={isPaid || isSelected}
                              disabled={isPaid}
                              onChange={() => {
                                if (!isPaid) handleToggleYear(session.yearOrdinal);
                              }}
                            />
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-text-primary">
                                  {session.yearLabel}
                                </span>
                                <span className="text-[10px] font-mono text-text-tertiary bg-gray-100 px-1.5 py-0.2 rounded">
                                  {session.session}
                                </span>
                                {session.yearOrdinal === 1 && (
                                  <Badge variant="paid" className="text-[8px] py-0">
                                    Registration
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[10px] text-text-tertiary">
                                Dues {formatNaira(session.breakdown.annualDues)} + Const{" "}
                                {formatNaira(session.breakdown.constitution)} + CGAN{" "}
                                {formatNaira(session.breakdown.cgan)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-text-primary">
                              {formatNaira(session.breakdown.total)}
                            </span>
                            {isPaid ? (
                              <Badge variant="paid" className="text-[9px]">Paid ✓</Badge>
                            ) : isSelected ? (
                              <Badge variant="pending" className="text-[9px]">Selected</Badge>
                            ) : (
                              <Badge variant="unpaid" className="text-[9px]">Unpaid</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Amount to Pay (₦)
                {selectedIsRequired && selectedSessions.length > 0 && (
                  <span className="text-text-tertiary font-normal"> — sum of selected sessions</span>
                )}
              </label>
              <Input
                error={!!errors.amount}
                {...register("amount", {
                  onChange: (event) => {
                    event.target.value = formatAmountInput(event.target.value);
                  },
                })}
                placeholder="5000"
                disabled={isLoading}
                readOnly={selectedIsRequired && selectedSessions.length > 0}
                className={selectedIsRequired && selectedSessions.length > 0 ? "bg-gray-50 cursor-not-allowed font-mono font-bold" : ""}
              />
              {errors.amount && <p className="text-[11px] text-danger mt-1">{errors.amount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Academic Session / Period</label>
              <Input
                error={!!errors.payment_period}
                {...register("payment_period")}
                placeholder="2024/2025"
                disabled={isLoading}
                readOnly={selectedIsRequired && selectedSessions.length > 0}
                className={selectedIsRequired && selectedSessions.length > 0 ? "bg-gray-50 cursor-not-allowed" : ""}
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
                placeholder="e.g. Session dues payment"
                disabled={isLoading}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full gap-2 font-semibold h-11"
              isLoading={isLoading}
              disabled={selectedIsRequired && selectedSessions.length === 0}
            >
              <CreditCard className="h-4 w-4" />
              {selectedIsRequired && selectedSessions.length > 1
                ? `Pay ${formatNaira(batchTotalAmount)} for ${selectedSessions.length} Sessions via ${activeGatewayName}`
                : `Proceed to ${activeGatewayName} Checkout`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PayDuesPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-[400px] items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutrals-borderLight border-t-brand" />
            <p className="text-xs text-text-secondary">Loading payment details...</p>
          </div>
        </div>
      }
    >
      <PayDuesFormContent />
    </React.Suspense>
  );
}
