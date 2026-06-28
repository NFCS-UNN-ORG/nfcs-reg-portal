import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  Receipt,
  Gift,
  AlertTriangle,
  Printer,
  Eye,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getYearsOfStudy, isAlumnus } from "@/lib/utils/unn-data";
import {
  buildPaymentTracker,
  getLevelOrdinal,
  getNextOutstanding,
  isFullyPaid,
  CURRENT_SESSION,
  getPayableRequiredSession,
  type PaymentSession,
} from "@/lib/utils/fees";
import { formatNaira } from "@/lib/utils/money";

function getPaymentStatusVariant(status: string) {
  switch (status) {
    case "confirmed":
      return "paid";
    case "pending":
      return "pending";
    case "failed":
      return "unpaid";
    case "reversed":
      return "partial";
    default:
      return "inactive";
  }
}

function TrackerStep({
  session,
  index,
  isLast,
  nextPayableYear,
}: {
  session: PaymentSession;
  index: number;
  isLast: boolean;
  nextPayableYear: number | null;
}) {
  const isPaid = session.existingPayment?.status === "confirmed";
  const isPending = session.existingPayment?.status === "pending";
  const isFailed =
    session.existingPayment &&
    ["failed", "reversed"].includes(session.existingPayment.status);
  const canPayRequired = nextPayableYear === session.yearOrdinal;

  return (
    <div className="flex gap-4">
      {/* Timeline Column */}
      <div className="flex flex-col items-center">
        {/* Status Dot */}
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
            isPaid
              ? "bg-emerald-100 border-emerald-500 text-emerald-600"
              : isPending
                ? "bg-amber-100 border-amber-400 text-amber-600 animate-pulse"
                : isFailed
                  ? "bg-red-100 border-red-400 text-red-500"
                  : "bg-gray-100 border-gray-300 text-gray-400"
          }`}
        >
          {isPaid ? (
            <CheckCircle className="h-4 w-4" />
          ) : isPending ? (
            <Clock className="h-4 w-4" />
          ) : isFailed ? (
            <XCircle className="h-4 w-4" />
          ) : (
            <span className="text-[10px] font-bold">{index + 1}</span>
          )}
        </div>
        {/* Connector Line */}
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[32px] ${
              isPaid ? "bg-emerald-300" : "bg-gray-200"
            }`}
          />
        )}
      </div>

      {/* Content Card */}
      <div
        className={`flex-1 mb-4 rounded-xl border p-4 transition-all hover:shadow-md ${
          isPaid
            ? "bg-emerald-50/50 border-emerald-200"
            : isPending
              ? "bg-amber-50/50 border-amber-200"
              : isFailed
                ? "bg-red-50/50 border-red-200"
                : "bg-white border-neutrals-borderLight shadow-card"
        }`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary">
                {session.yearLabel}
              </span>
              <span className="text-[10px] text-text-tertiary font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                {session.session}
              </span>
              {session.yearOrdinal === 1 && (
                <Badge variant="paid" className="text-[9px]">Registration</Badge>
              )}
            </div>

            {/* Fee Breakdown */}
            <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
              <span>Dues: {formatNaira(session.breakdown.annualDues)}</span>
              <span>·</span>
              <span>Constitution: {formatNaira(session.breakdown.constitution)}</span>
              <span>·</span>
              <span>CGAN: {formatNaira(session.breakdown.cgan)}</span>
              {session.breakdown.isFinalistYear && (
                <>
                  <span>·</span>
                  <Badge variant="pending" className="text-[9px] py-0">Finalist</Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-base font-bold text-text-primary font-mono">
              {formatNaira(session.breakdown.total)}
            </span>

            {isPaid ? (
              <div className="flex items-center gap-2">
                <Badge variant="paid">Paid</Badge>
                {session.existingPayment?.id && (
                  <Link
                    href={`/dues/receipt/${session.existingPayment.id}`}
                    className="inline-flex items-center gap-1 text-xs text-brand-accent hover:text-brand transition-colors font-semibold"
                    title="View Receipt"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </Link>
                )}
              </div>
            ) : isPending ? (
              <div className="flex items-center gap-2">
                <Badge variant="pending">Pending</Badge>
                {session.existingPayment?.payment_reference && (
                  <Button asChild variant="secondary" className="h-8 text-xs px-3 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50">
                    <Link href={`/dues/pay/checkout?ref=${session.existingPayment.payment_reference}`}>
                      Resume <ArrowRight className="h-3 w-3" />
                    </Link>
                  </Button>
                )}
              </div>
            ) : isFailed && canPayRequired ? (
              <div className="flex items-center gap-2">
                <Badge variant="unpaid">Failed</Badge>
                <Button asChild variant="secondary" className="h-8 text-xs px-3 gap-1.5">
                  <Link href={`/dues/pay?year=${session.yearOrdinal}&session=${encodeURIComponent(session.session)}&type=${session.feeType}`}>
                    Retry <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              </div>
            ) : isFailed ? (
              <Badge variant="unpaid">Failed</Badge>
            ) : canPayRequired ? (
              <Button asChild variant="primary" className="h-8 text-xs px-3 gap-1.5">
                <Link href={`/dues/pay?year=${session.yearOrdinal}&session=${encodeURIComponent(session.session)}&type=${session.feeType}`}>
                  Pay Now <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            ) : (
              <Badge variant="inactive">Locked</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function MyDuesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  // Fetch member profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("academic_level, faculty, role, department")
    .eq("id", user.id)
    .single();

  if (profile?.role === "super_admin") {
    redirect("/dashboard");
  }

  // Fetch payments
  const { data: payments } = await supabase
    .from("payments")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  const userIsAlumnus = isAlumnus(profile?.role);
  const levelOrdinal = getLevelOrdinal(profile?.academic_level);
  const totalCourseYears = getYearsOfStudy(profile?.faculty, profile?.department);

  // Build payment tracker (students/excos only)
  const tracker = !userIsAlumnus
    ? buildPaymentTracker({
        currentLevelOrdinal: levelOrdinal,
        totalCourseYears,
        existingPayments: (payments || []).map((p) => ({
          id: p.id,
          dues_type: p.dues_type,
          payment_period: p.payment_period,
          status: p.status,
          amount: p.amount,
          payment_reference: p.payment_reference,
          payment_date: p.payment_date,
          created_at: p.created_at,
        })),
        currentSession: CURRENT_SESSION,
      })
    : [];

  const nextOutstanding = getNextOutstanding(tracker);
  const nextPayableRequired = getPayableRequiredSession(tracker);
  const allPaid = isFullyPaid(tracker);
  const paidCount = tracker.filter(
    (s) => s.existingPayment?.status === "confirmed"
  ).length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 select-none">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Dues & Levies
          </h1>
          <p className="text-xs text-text-secondary">
            {userIsAlumnus
              ? "Make donations and special levy payments to support the fellowship."
              : "Track and manage your session dues from enrollment to current level."}
          </p>
        </div>

        <Button asChild variant="primary" className="sm:self-end gap-2">
          <Link
            href={
              !userIsAlumnus && nextPayableRequired
                ? `/dues/pay?year=${nextPayableRequired.yearOrdinal}&session=${encodeURIComponent(nextPayableRequired.session)}&type=${nextPayableRequired.feeType}`
                : "/dues/pay?type=special_levy"
            }
          >
            <CreditCard className="h-4 w-4" /> Pay Dues / Levies
          </Link>
        </Button>
      </div>

      {/* ─── ALUMNI VIEW ─── */}
      {userIsAlumnus ? (
        <div className="space-y-6">
          {/* Alumni Info Card */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-6">
            <div className="flex items-start gap-3">
              <Gift className="h-6 w-6 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-text-primary">
                  Alumni Member
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  As an alumnus, you are not required to pay annual session dues.
                  You can make <strong>special donations</strong> or pay{" "}
                  <strong>clearance levies</strong> to access features like
                  Letter of Recommendation and NFCS Certificate of Membership.
                </p>
              </div>
            </div>
          </div>

          {/* Clearance Alert */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-800">
                Clearance Levy Required
              </p>
              <p className="text-[11px] text-amber-700 leading-relaxed">
                If you haven&apos;t completed your clearance, pay the clearance
                levy to unlock your NFCS Certificate of Membership and Letter of
                Recommendation features.
              </p>
              <Button
                asChild
                variant="secondary"
                className="h-8 text-xs mt-2 gap-1.5 border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                <Link href="/dues/pay?type=special_levy">
                  Pay Clearance Levy <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* ─── STUDENT / EXCO VIEW ─── */
        <div className="space-y-6">
          {/* Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-neutrals-borderLight rounded-xl p-4 shadow-card">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold mb-1">
                Total Sessions
              </p>
              <p className="text-2xl font-bold text-text-primary font-mono">
                {tracker.length}
              </p>
            </div>
            <div className="bg-white border border-neutrals-borderLight rounded-xl p-4 shadow-card">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold mb-1">
                Paid
              </p>
              <p className="text-2xl font-bold text-emerald-600 font-mono">
                {paidCount}/{tracker.length}
              </p>
            </div>
            <div className="bg-white border border-neutrals-borderLight rounded-xl p-4 shadow-card">
              <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold mb-1">
                Status
              </p>
              {allPaid ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <span className="text-sm font-bold text-emerald-600">
                    All Clear
                  </span>
                </div>
              ) : nextOutstanding ? (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm font-bold text-amber-600">
                    {nextOutstanding.yearLabel} Outstanding
                  </span>
                </div>
              ) : (
                <span className="text-sm font-bold text-text-secondary">—</span>
              )}
            </div>
          </div>

          {/* Payment Tracker Timeline */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold text-text-primary select-none">
              Payment Tracker
            </h2>
            <p className="text-[11px] text-text-tertiary select-none mb-4">
              Your dues from enrollment to your current academic level.
            </p>

            {tracker.length === 0 ? (
              <div className="text-center py-12 bg-white border border-neutrals-borderLight rounded-xl shadow-card">
                <CreditCard className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
                <h3 className="text-sm font-bold text-text-primary">
                  No sessions found
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Please complete your profile to see your payment tracker.
                </p>
              </div>
            ) : (
              <div className="pl-1">
                {tracker.map((session, i) => (
                  <TrackerStep
                    key={session.session}
                    session={session}
                    index={i}
                    isLast={i === tracker.length - 1}
                    nextPayableYear={nextPayableRequired?.yearOrdinal ?? null}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── PAYMENT HISTORY TABLE ─── */}
      <div className="space-y-4">
        <div className="space-y-0.5 select-none">
          <h3 className="text-sm font-bold text-text-primary">
            Payment History
          </h3>
          <p className="text-xs text-text-tertiary">
            All online and manual dues logged in the portal.
          </p>
        </div>

        {!payments || payments.length === 0 ? (
          <div className="text-center py-12 bg-white border border-neutrals-borderLight rounded-[12px] shadow-card">
            <Receipt className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
            <h3 className="text-sm font-bold text-text-primary">
              No payments found
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              You haven&apos;t completed any dues payments yet. Click &quot;Pay
              Dues / Levies&quot; above to start.
            </p>
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference ID</TableHead>
                  <TableHead>Dues / Levy Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Session Period</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date Paid</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell variant="mono">
                      {p.payment_reference || "—"}
                    </TableCell>

                    <TableCell className="capitalize">
                      {p.dues_type.replace(/_/g, " ")}
                    </TableCell>

                    <TableCell
                      variant="mono"
                      className="font-semibold text-text-primary"
                    >
                      {formatNaira(p.amount)}
                    </TableCell>

                    <TableCell variant="secondary">
                      {p.payment_period || "—"}
                    </TableCell>

                    <TableCell variant="secondary">
                      <Badge
                        variant="inactive"
                        className="capitalize px-2 py-0.5 rounded-[4px] border-none select-none"
                      >
                        {p.channel}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <Badge variant={getPaymentStatusVariant(p.status)}>
                        {p.status}
                      </Badge>
                    </TableCell>

                    <TableCell variant="secondary">
                      {p.payment_date || p.created_at?.split("T")[0] || "—"}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {/* View button — always shown */}
                        <Link
                          href={`/dues/receipt/${p.id}`}
                          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-brand-accent transition-colors font-semibold"
                          title="View Payment"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>

                        {/* Print — confirmed only */}
                        {p.status === "confirmed" && (
                          <Link
                            href={`/dues/receipt/${p.id}`}
                            className="inline-flex items-center gap-1 text-xs text-brand-accent hover:text-brand transition-colors font-semibold"
                            title="Print Receipt"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Print
                          </Link>
                        )}

                        {/* Complete — pending online payments only */}
                        {p.status === "pending" && p.channel === "online" && p.payment_reference && (
                          <Link
                            href={`/dues/pay/checkout?ref=${p.payment_reference}`}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 transition-colors font-semibold"
                            title="Complete Pending Payment"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Complete
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
      </div>
    </div>
  );
}
