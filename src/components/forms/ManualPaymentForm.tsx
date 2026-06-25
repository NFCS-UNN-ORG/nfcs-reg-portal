"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { manualPaymentSchema, type ManualPaymentFormValues } from "@/lib/validations/payment.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { recordManualPayment } from "@/lib/actions/payment.actions";
import { createClient } from "@/lib/supabase/client";
import { AlertCircle, CheckCircle, Search, User, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useUser } from "@/hooks/useUser";

// Year fee breakdown (matching the fee engine)
const DUES_YEARS: { label: string; value: string; total: number; breakdown: string; type: "membership_levy" | "annual_dues" | "special_levy" | "other" }[] = [
  { label: "1st Year (Membership Levy)", value: "year_1", total: 500, breakdown: "₦250 dues + ₦150 const + ₦100 CGAN", type: "membership_levy" },
  { label: "2nd Year", value: "year_2", total: 400, breakdown: "₦250 dues + ₦50 const + ₦100 CGAN", type: "annual_dues" },
  { label: "3rd Year", value: "year_3", total: 400, breakdown: "₦250 dues + ₦50 const + ₦100 CGAN", type: "annual_dues" },
  { label: "4th Year (Non-finalist)", value: "year_4", total: 400, breakdown: "₦250 dues + ₦50 const + ₦100 CGAN", type: "annual_dues" },
  { label: "4th Year (Finalist)", value: "year_4f", total: 500, breakdown: "₦250 dues + ₦50 const + ₦200 CGAN", type: "annual_dues" },
  { label: "5th Year", value: "year_5", total: 400, breakdown: "₦250 dues + ₦50 const + ₦100 CGAN", type: "annual_dues" },
  { label: "6th Year (Finalist)", value: "year_6", total: 300, breakdown: "₦250 dues + ₦50 const + ₦0 CGAN", type: "annual_dues" },
];

/** Generate a random invoice number in format REC-XXXXXX */
function generateReceiptNumber(): string {
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `REC-${digits}`;
}

/** Return current academic session string, e.g. "2024/2025 Session" */
function getCurrentSession(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  // Academic year runs from ~October to September
  const startYear = month >= 10 ? year : year - 1;
  return `${startYear}/${startYear + 1} Session`;
}

export function ManualPaymentForm() {
  const { toast } = useToast();
  const { profile: currentExco } = useUser();
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Members lists
  const [members, setMembers] = React.useState<any[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedMember, setSelectedMember] = React.useState<any | null>(null);
  const [showMemberDropdown, setShowMemberDropdown] = React.useState(false);

  // Dues year selection
  const [selectedDuesYear, setSelectedDuesYear] = React.useState("");
  const selectedDuesInfo = DUES_YEARS.find((d) => d.value === selectedDuesYear);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
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
        // Search profiles — exclude super_admin role
        let profilesQuery = supabase
          .from("profiles")
          .select("id, full_name, email, matric_number, role")
          .neq("role", "super_admin");

        if (searchTerm) {
          profilesQuery = profilesQuery.or(
            `full_name.ilike.%${searchTerm}%,matric_number.ilike.%${searchTerm}%`
          );
        }
        const { data: profilesData } = await profilesQuery.limit(5);

        // Search legacy members
        let legacyQuery = supabase
          .from("legacy_members")
          .select("id, full_name, matric_number")
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

  const selectMember = (member: any) => {
    setSelectedMember(member);
    setValue("member_id", member.id);
    setSearchTerm("");
    setShowMemberDropdown(false);
  };

  const handleDuesYearChange = (yearVal: string) => {
    setSelectedDuesYear(yearVal);
    const info = DUES_YEARS.find((d) => d.value === yearVal);
    if (info) {
      setValue("amount", String(info.total));
      setValue("dues_type", info.type);
    }
  };

  const regenerateReceipt = () => {
    setValue("receipt_number", generateReceiptNumber());
  };

  const onSubmit = async (values: ManualPaymentFormValues) => {
    if (!currentExco) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await recordManualPayment(values, currentExco.id);
      if (result?.error) {
        setError(result.error);
        toast({
          title: "Failed to Record Dues",
          description: result.error,
          variant: "error",
        });
      } else {
        setSuccess(true);
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
        setSelectedDuesYear("");
        toast({
          title: "Payment Recorded",
          description: "Dues receipt has been logged successfully.",
          variant: "success",
        });
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {success && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-status-successBackground border border-status-successBorder text-status-successText">
          <CheckCircle className="h-5 w-5 shrink-0 text-status-successText" />
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold">Manual Payment Logged</h3>
            <p className="text-[11px] leading-relaxed opacity-95">
              The dues record has been saved. The member&apos;s dashboard and directory statement will automatically reflect this payment.
              {currentExco && (
                <span className="block mt-1 font-semibold text-[10px] opacity-90">
                  Recorded by: {currentExco.full_name} ({currentExco.role === "super_admin" ? "Super Admin" : "Exco"})
                </span>
              )}
            </p>
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
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-brand-border bg-brand-light text-brand-accent select-none">
              <div className="flex items-center gap-2.5">
                <User className="h-4 w-4 shrink-0" />
                <div className="text-xs text-left">
                  <span className="font-bold">{selectedMember.full_name}</span>
                  <span className="text-[11px] text-text-secondary ml-2 font-mono">
                    ({selectedMember.matric_number || "No matric"})
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedMember(null);
                  setValue("member_id", "");
                }}
                className="h-7 text-[11px] px-2"
              >
                Clear Selection
              </Button>
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

        {/* Dues Details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Year select — auto-fills amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Year Paid For</label>
            <select
              value={selectedDuesYear}
              onChange={(e) => handleDuesYearChange(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white dark:bg-prussian-blue-2 px-3 py-1.5 text-[13px] text-text-primary focus:border-brand-accent focus:outline-none"
            >
              <option value="">Select academic year...</option>
              {DUES_YEARS.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label} — ₦{y.total}
                </option>
              ))}
            </select>
            {selectedDuesInfo && (
              <p className="text-[11px] text-text-tertiary mt-1">
                {selectedDuesInfo.breakdown} = <span className="font-bold text-text-primary">₦{selectedDuesInfo.total}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Amount (₦) <span className="text-text-tertiary font-normal">— auto-filled</span></label>
            <Input error={!!errors.amount} {...register("amount")} placeholder="auto-filled from year selection" />
            {errors.amount && <p className="text-[11px] text-danger mt-1">{errors.amount.message}</p>}
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
            {errors.dues_type && <p className="text-[11px] text-danger mt-1">{errors.dues_type.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Session / Period <span className="text-text-tertiary font-normal">— auto-filled</span></label>
            <Input error={!!errors.payment_period} {...register("payment_period")} placeholder="2024/2025 Session" />
            {errors.payment_period && <p className="text-[11px] text-danger mt-1">{errors.payment_period.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Receipt Number <span className="text-text-tertiary font-normal">— auto-generated</span>
            </label>
            <div className="relative">
              <Input error={!!errors.receipt_number} {...register("receipt_number")} placeholder="REC-XXXXXX" className="pr-10" />
              <button
                type="button"
                onClick={regenerateReceipt}
                title="Regenerate receipt number"
                className="absolute right-2.5 top-[9px] text-text-tertiary hover:text-brand-accent transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            {errors.receipt_number && <p className="text-[11px] text-danger mt-1">{errors.receipt_number.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Payment Date</label>
            <Input error={!!errors.payment_date} type="date" {...register("payment_date")} />
            {errors.payment_date && <p className="text-[11px] text-danger mt-1">{errors.payment_date.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-secondary">Additional Notes</label>
          <Input {...register("notes")} placeholder="e.g. Paid in cash to Chapter Treasurer" />
        </div>

        <div className="flex justify-end pt-4 border-t border-neutrals-borderLight">
          <Button type="submit" variant="primary" className="px-6 h-10 text-xs font-semibold" isLoading={isLoading}>
            Record Dues Payment
          </Button>
        </div>
      </form>
    </div>
  );
}
