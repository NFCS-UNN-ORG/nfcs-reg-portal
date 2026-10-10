"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manualPaymentSchema, type ManualPaymentFormValues } from "@/lib/validations/payment.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  recordManualPayment,
  recordBatchManualPayment,
  getMemberPaymentContext,
  type BatchPaymentItem,
} from "@/lib/actions/payment.actions";
import { createClient } from "@/lib/supabase/client";
import {
  AlertCircle,
  CheckCircle,
  Search,
  User,
  RefreshCw,
  Loader2,
  ShieldCheck,
  Layers,
  CheckSquare,
  Square,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useUser } from "@/hooks/useUser";
import { formatAmountInput, formatNaira, parseMoneyAmount } from "@/lib/utils/money";
import { CURRENT_SESSION, type PaymentSession } from "@/lib/utils/fees";

/** Generate a random invoice number in format REC-XXXXXX */
function generateReceiptNumber(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `REC-${digits}`;
}

/** Return current academic session string, e.g. "2024/2025 Session" */
function getCurrentSession(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}/${startYear + 1} Session`;
}

export function ManualPaymentForm() {
  const { toast } = useToast();
  const { profile: currentExco } = useUser();
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Members lists
  const [members, setMembers] = React.useState<any[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedMember, setSelectedMember] = React.useState<any | null>(null);
  const [showMemberDropdown, setShowMemberDropdown] = React.useState(false);

  // Member Payment Context & Multi-session selection
  const [memberContext, setMemberContext] = React.useState<any | null>(null);
  const [isContextLoading, setIsContextLoading] = React.useState(false);
  const [selectedYearOrdinals, setSelectedYearOrdinals] = React.useState<number[]>([]);
  const [paymentMode, setPaymentMode] = React.useState<"dues" | "other">("dues");

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<ManualPaymentFormValues>({
    resolver: zodResolver(manualPaymentSchema),
    defaultValues: {
      member_id: "",
      amount: "",
      dues_type: "annual_dues",
      payment_period: getCurrentSession(),
      receipt_number: generateReceiptNumber(),
      payment_date: new Date().toISOString().split("T")[0],
      notes: "",
    },
  });

  // Auto-generate new receipt number on mount
  React.useEffect(() => {
    setValue("receipt_number", generateReceiptNumber());
    setValue("payment_period", getCurrentSession());
  }, [setValue]);

  // Load members dynamically on search term changes — excludes super_admin
  React.useEffect(() => {
    async function searchMembers() {
      const supabase = createClient();
      try {
        let profilesQuery = supabase
          .from("profiles")
          .select("id, full_name, email, matric_number, role, academic_level, faculty, department")
          .neq("role", "super_admin");

        if (searchTerm) {
          profilesQuery = profilesQuery.or(
            `full_name.ilike.%${searchTerm}%,matric_number.ilike.%${searchTerm}%`
          );
        }
        const { data: profilesData } = await profilesQuery.limit(5);

        let legacyQuery = supabase
          .from("legacy_members")
          .select("id, full_name, matric_number, academic_level")
          .eq("claim_status", "unclaimed");

        if (searchTerm) {
          legacyQuery = legacyQuery.or(
            `full_name.ilike.%${searchTerm}%,matric_number.ilike.%${searchTerm}%`
          );
        }
        const { data: legacyData } = await legacyQuery.limit(5);

        const combined = [
          ...(profilesData || []).map((p) => ({ ...p, isLegacy: false })),
          ...(legacyData || []).map((l) => ({
            ...l,
            isLegacy: true,
            email: "Legacy (Unclaimed)",
            role: "student",
          })),
        ];

        setMembers(combined);
      } catch (err) {
        console.error("Failed to load members:", err);
      }
    }

    const timer = setTimeout(() => {
      searchMembers();
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const selectMember = async (member: any) => {
    setSelectedMember(member);
    setValue("member_id", member.id);
    setSearchTerm("");
    setShowMemberDropdown(false);
    setIsContextLoading(true);
    setError(null);
    setSuccessMessage(null);
    setSelectedYearOrdinals([]);

    try {
      const contextRes = await getMemberPaymentContext(member.id);
      if (contextRes?.success) {
        setMemberContext(contextRes);

        if (!contextRes.userIsAlumnus && contextRes.tracker && contextRes.tracker.length > 0) {
          setPaymentMode("dues");
          // Pre-select first outstanding eligible session
          const firstUnpaid = contextRes.tracker.find(
            (s: PaymentSession) => s.isEligible && s.existingPayment?.status !== "confirmed"
          );
          if (firstUnpaid) {
            setSelectedYearOrdinals([firstUnpaid.yearOrdinal]);
            setValue("amount", formatAmountInput(String(firstUnpaid.breakdown.total)));
            setValue("payment_period", firstUnpaid.session);
            setValue("dues_type", firstUnpaid.feeType);
          } else {
            setSelectedYearOrdinals([]);
            setValue("amount", "");
            setValue("payment_period", CURRENT_SESSION);
          }
        } else {
          setPaymentMode("other");
          setValue("dues_type", "special_levy");
          setValue("payment_period", CURRENT_SESSION);
          setValue("amount", "");
        }
      } else {
        setMemberContext(null);
      }
    } catch {
      setMemberContext(null);
    } finally {
      setIsContextLoading(false);
    }
  };

  // Compute unpaid eligible sessions from tracker
  const tracker: PaymentSession[] = memberContext?.tracker || [];
  const unpaidEligibleSessions = tracker.filter(
    (s) => s.isEligible && s.existingPayment?.status !== "confirmed"
  );

  // Compute selected sessions and totals
  const selectedSessions = tracker.filter((s) => selectedYearOrdinals.includes(s.yearOrdinal));
  const batchTotalAmount = selectedSessions.reduce((sum, s) => sum + s.breakdown.total, 0);

  // Toggle year selection with sequential auto-inclusion / unchecking
  const handleToggleYear = (yearOrdinal: number) => {
    if (selectedYearOrdinals.includes(yearOrdinal)) {
      // Uncheck this year and any subsequent years that depend on it
      const nextSelected = selectedYearOrdinals.filter((ord) => ord < yearOrdinal);
      setSelectedYearOrdinals(nextSelected);

      const remaining = tracker.filter((s) => nextSelected.includes(s.yearOrdinal));
      const total = remaining.reduce((sum, s) => sum + s.breakdown.total, 0);
      setValue("amount", formatAmountInput(String(total)));
      setValue("payment_period", remaining.map((s) => s.session).join(", ") || CURRENT_SESSION);
    } else {
      // Check this year AND any prior unpaid eligible years to guarantee sequential integrity
      const priorUnpaidOrds = unpaidEligibleSessions
        .filter((s) => s.yearOrdinal <= yearOrdinal)
        .map((s) => s.yearOrdinal);

      const nextSelected = Array.from(new Set([...selectedYearOrdinals, ...priorUnpaidOrds])).sort(
        (a, b) => a - b
      );
      setSelectedYearOrdinals(nextSelected);

      const active = tracker.filter((s) => nextSelected.includes(s.yearOrdinal));
      const total = active.reduce((sum, s) => sum + s.breakdown.total, 0);
      setValue("amount", formatAmountInput(String(total)));
      setValue("payment_period", active.map((s) => s.session).join(", "));
      if (active.length > 0) {
        setValue("dues_type", active[0].feeType);
      }
    }
  };

  // Quick Action: Select All Outstanding
  const handleSelectAllOutstanding = () => {
    const allUnpaidOrds = unpaidEligibleSessions.map((s) => s.yearOrdinal);
    setSelectedYearOrdinals(allUnpaidOrds);

    const total = unpaidEligibleSessions.reduce((sum, s) => sum + s.breakdown.total, 0);
    setValue("amount", formatAmountInput(String(total)));
    setValue("payment_period", unpaidEligibleSessions.map((s) => s.session).join(", "));
    if (unpaidEligibleSessions.length > 0) {
      setValue("dues_type", unpaidEligibleSessions[0].feeType);
    }
  };

  // Quick Action: Clear Selection
  const handleClearSelection = () => {
    setSelectedYearOrdinals([]);
    setValue("amount", "");
    setValue("payment_period", CURRENT_SESSION);
  };

  const regenerateReceipt = () => {
    setValue("receipt_number", generateReceiptNumber());
  };

  const onSubmit = async (values: ManualPaymentFormValues) => {
    if (!currentExco) return;
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      if (paymentMode === "dues" && selectedSessions.length > 0) {
        // ── Batch Payment Path ───────────────────────────────────────────────
        const batchItems: BatchPaymentItem[] = selectedSessions.map((s) => ({
          yearOrdinal: s.yearOrdinal,
          session: s.session,
          dues_type: s.feeType,
          amount: s.breakdown.total,
        }));

        const result = await recordBatchManualPayment(
          {
            member_id: values.member_id,
            items: batchItems,
            receipt_number: values.receipt_number,
            payment_date: values.payment_date,
            notes: values.notes || undefined,
          },
          currentExco.id
        );

        if (result?.error) {
          setError(result.error);
          toast({
            title: "Failed to Record Dues",
            description: result.error,
            variant: "error",
          });
        } else {
          const successMsg = `Successfully recorded ${result.count ?? selectedSessions.length} session(s) (${formatNaira(
            result.totalAmount ?? batchTotalAmount
          )}) for ${selectedMember?.full_name}. Ref: ${result.batchReference ?? ""}`;
          setSuccessMessage(successMsg);
          reset({
            member_id: "",
            amount: "",
            dues_type: "annual_dues",
            payment_period: getCurrentSession(),
            receipt_number: generateReceiptNumber(),
            payment_date: new Date().toISOString().split("T")[0],
            notes: "",
          });
          setSelectedMember(null);
          setSelectedYearOrdinals([]);
          setMemberContext(null);
          toast({
            title: "Batch Payment Recorded",
            description: successMsg,
            variant: "success",
          });
        }
      } else {
        // ── Single / Other Payment Path ──────────────────────────────────────
        const result = await recordManualPayment(values, currentExco.id);
        if (result?.error) {
          setError(result.error);
          toast({
            title: "Failed to Record Payment",
            description: result.error,
            variant: "error",
          });
        } else {
          setSuccessMessage("Manual payment logged successfully.");
          reset({
            member_id: "",
            amount: "",
            dues_type: "annual_dues",
            payment_period: getCurrentSession(),
            receipt_number: generateReceiptNumber(),
            payment_date: new Date().toISOString().split("T")[0],
            notes: "",
          });
          setSelectedMember(null);
          setSelectedYearOrdinals([]);
          setMemberContext(null);
          toast({
            title: "Payment Recorded",
            description: "Dues receipt has been logged successfully.",
            variant: "success",
          });
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {successMessage && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-status-successBackground border border-status-successBorder text-status-successText">
          <CheckCircle className="h-5 w-5 shrink-0 text-status-successText" />
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold">Manual Payment Logged ✓</h3>
            <p className="text-[11px] leading-relaxed opacity-95">{successMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-status-errorBackground p-3 text-xs font-semibold text-status-errorText border border-status-errorBorder animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Member Selector Search input */}
        <div className="space-y-1.5 relative">
          <label className="text-xs font-semibold text-text-secondary">Select Member</label>

          {selectedMember ? (
            <div className="space-y-2 select-none">
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-brand-border bg-brand-light text-brand-accent">
                <div className="flex items-center gap-2.5">
                  <User className="h-4 w-4 shrink-0" />
                  <div className="text-xs text-left">
                    <span className="font-bold">{selectedMember.full_name}</span>
                    <span className="text-[11px] text-text-secondary ml-2 font-mono">
                      ({selectedMember.matric_number || "No matric"})
                    </span>
                    {selectedMember.academic_level && (
                      <span className="ml-2 font-semibold text-[10px] text-brand-accent bg-brand/10 px-1.5 py-0.5 rounded">
                        {selectedMember.academic_level}
                      </span>
                    )}
                    {memberContext?.totalCourseYears && (
                      <span className="ml-2 font-semibold text-[10px] text-text-tertiary bg-gray-100 px-1.5 py-0.5 rounded">
                        {memberContext.totalCourseYears} Years Programme
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setSelectedMember(null);
                    setMemberContext(null);
                    setValue("member_id", "");
                    setSelectedYearOrdinals([]);
                    setValue("amount", "");
                  }}
                  className="h-7 text-[11px] px-2"
                >
                  Clear Selection
                </Button>
              </div>

              {/* Live Member Payment Tracker Banner */}
              {isContextLoading ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-subtle text-xs text-text-secondary border border-neutrals-border">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                  <span>Loading student payment history & course data...</span>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-[10px] h-4 w-4 text-text-tertiary" />
                <Input
                  type="text"
                  value={searchTerm}
                  onFocus={() => setShowMemberDropdown(true)}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type name or matric number to search..."
                  className="pl-9 h-10"
                />
              </div>

              {showMemberDropdown && members.length > 0 && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMemberDropdown(false)} />
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-neutrals-border bg-white shadow-dropdown z-20 p-1">
                    {members.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => selectMember(member)}
                        className="w-full flex items-center justify-between px-3 py-2 text-xs text-left text-text-primary rounded-md hover:bg-surface-page transition-colors"
                      >
                        <div className="flex flex-col">
                          <span className="font-semibold">{member.full_name}</span>
                          <span className="text-[10px] text-text-tertiary">{member.email}</span>
                        </div>
                        <span className="font-mono text-[10px] text-text-secondary">
                          {member.matric_number || "—"}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {errors.member_id && (
            <p className="text-[11px] text-danger mt-1 font-medium">{errors.member_id.message}</p>
          )}
        </div>

        {/* ─── BATCH ACADEMIC SESSIONS SELECTOR ─── */}
        {selectedMember && memberContext && !memberContext.userIsAlumnus && tracker.length > 0 && (
          <div className="rounded-xl border border-neutrals-borderLight bg-white shadow-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutrals-borderLight pb-3">
              <div className="space-y-0.5">
                <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-brand-accent" />
                  Select Academic Sessions to Record
                </h3>
                <p className="text-[11px] text-text-tertiary">
                  Select one or multiple outstanding sessions. Years are tracked across their full{" "}
                  <strong>{memberContext.totalCourseYears}-year programme</strong>.
                </p>
              </div>

              {unpaidEligibleSessions.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleSelectAllOutstanding}
                    className="h-7 text-[11px] px-2.5 gap-1.5 text-brand-accent border-brand-border bg-brand-light hover:bg-brand/15"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Select All Outstanding (
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
                      className="h-7 text-[11px] px-2 text-text-secondary"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Checklist of all sessions in degree */}
            <div className="space-y-2.5">
              {tracker.map((session) => {
                const isPaid = session.existingPayment?.status === "confirmed";
                const isFuture = session.isFuture;
                const isSelected = selectedYearOrdinals.includes(session.yearOrdinal);

                return (
                  <div
                    key={session.yearOrdinal}
                    onClick={() => {
                      if (!isPaid && !isFuture) {
                        handleToggleYear(session.yearOrdinal);
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all select-none ${
                      isPaid
                        ? "bg-emerald-50/40 border-emerald-200 cursor-default"
                        : isFuture
                          ? "bg-gray-50/50 border-gray-200/80 opacity-60 cursor-not-allowed"
                          : isSelected
                            ? "bg-brand-light/60 border-brand-accent shadow-xs cursor-pointer"
                            : "bg-surface-page border-neutrals-borderLight hover:border-gray-300 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isPaid || isSelected}
                        disabled={isPaid || isFuture}
                        onChange={() => {
                          if (!isPaid && !isFuture) {
                            handleToggleYear(session.yearOrdinal);
                          }
                        }}
                      />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-bold ${
                              isSelected ? "text-brand-accent" : "text-text-primary"
                            }`}
                          >
                            {session.yearLabel}
                          </span>
                          <span className="text-[10px] font-mono text-text-tertiary bg-white border border-gray-200 px-1.5 py-0.2 rounded">
                            {session.session}
                          </span>
                          {session.yearOrdinal === 1 && (
                            <Badge variant="paid" className="text-[9px] py-0">
                              Registration
                            </Badge>
                          )}
                          {session.breakdown.isFinalistYear && (
                            <Badge variant="pending" className="text-[9px] py-0">
                              Finalist
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-text-tertiary">
                          {session.breakdown.annualDues > 0 &&
                            `Dues ${formatNaira(session.breakdown.annualDues)}`}
                          {session.breakdown.constitution > 0 &&
                            ` + Const ${formatNaira(session.breakdown.constitution)}`}
                          {session.breakdown.cgan > 0 &&
                            ` + CGAN ${formatNaira(session.breakdown.cgan)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-text-primary">
                        {formatNaira(session.breakdown.total)}
                      </span>
                      {isPaid ? (
                        <Badge variant="paid">Paid ✓</Badge>
                      ) : isFuture ? (
                        <Badge variant="inactive">Upcoming Level</Badge>
                      ) : isSelected ? (
                        <Badge variant="pending">Selected</Badge>
                      ) : (
                        <Badge variant="unpaid">Outstanding</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selection Summary Callout */}
            {selectedSessions.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-brand-light border border-brand-border text-xs text-brand-accent">
                <span className="font-semibold">
                  {selectedSessions.length} session(s) selected:{" "}
                  <span className="font-normal">
                    {selectedSessions.map((s) => s.yearLabel).join(", ")}
                  </span>
                </span>
                <span className="font-mono font-bold text-sm">
                  Total: {formatNaira(batchTotalAmount)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Amount & Period Inputs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Total Amount (₦){" "}
              {paymentMode === "dues" && selectedSessions.length > 0 && (
                <span className="text-text-tertiary font-normal">— calculated from sessions</span>
              )}
            </label>
            <Input
              error={!!errors.amount}
              readOnly={paymentMode === "dues" && selectedSessions.length > 0}
              {...register("amount", {
                onChange: (event) => {
                  event.target.value = formatAmountInput(event.target.value);
                },
              })}
              placeholder="e.g. 500"
            />
            {errors.amount && (
              <p className="text-[11px] text-danger mt-1">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Session / Period
            </label>
            <Input
              error={!!errors.payment_period}
              readOnly={paymentMode === "dues" && selectedSessions.length > 0}
              {...register("payment_period")}
              placeholder="e.g. 2024/2025 Session"
            />
            {errors.payment_period && (
              <p className="text-[11px] text-danger mt-1">{errors.payment_period.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Dues Levy Type</label>
            <Select error={!!errors.dues_type} {...register("dues_type")}>
              <option value="annual_dues">Annual Dues</option>
              <option value="membership_levy">Membership Levy</option>
              <option value="special_levy">Special Levy</option>
              <option value="other">Other Levy</option>
            </Select>
            {errors.dues_type && (
              <p className="text-[11px] text-danger mt-1">{errors.dues_type.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Receipt Number{" "}
              <span className="text-text-tertiary font-normal">— auto-generated</span>
            </label>
            <div className="relative">
              <Input
                error={!!errors.receipt_number}
                {...register("receipt_number")}
                placeholder="REC-XXXXXX"
                className="pr-10"
              />
              <button
                type="button"
                onClick={regenerateReceipt}
                title="Regenerate receipt number"
                className="absolute right-2.5 top-[9px] text-text-tertiary hover:text-brand-accent transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {errors.receipt_number && (
              <p className="text-[11px] text-danger mt-1">{errors.receipt_number.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Payment Date</label>
            <Input error={!!errors.payment_date} type="date" {...register("payment_date")} />
            {errors.payment_date && (
              <p className="text-[11px] text-danger mt-1">{errors.payment_date.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary">Additional Notes</label>
          <Input {...register("notes")} placeholder="e.g. Paid in cash to Chapter Treasurer" />
        </div>

        <div className="flex justify-end pt-4 border-t border-neutrals-borderLight">
          <Button
            type="submit"
            variant="primary"
            className="px-6 h-10 text-xs font-semibold"
            isLoading={isLoading}
            disabled={!selectedMember || (paymentMode === "dues" && selectedSessions.length === 0)}
          >
            {paymentMode === "dues" && selectedSessions.length > 1
              ? `Record Batch Payment for ${selectedSessions.length} Sessions (${formatNaira(
                  batchTotalAmount
                )})`
              : "Record Dues Payment"}
          </Button>
        </div>
      </form>
    </div>
  );
}
