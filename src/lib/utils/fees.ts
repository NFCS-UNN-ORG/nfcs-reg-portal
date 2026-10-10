/**
 * NFCS UNN Fee Calculation Engine
 *
 * Official Fee Table (Total fees per year):
 * 1st Year: ₦250 dues + ₦150 constitution + ₦100 CGAN = ₦500
 * 2nd Year: ₦250 dues + ₦50 constitution + ₦100 CGAN = ₦400
 * 3rd Year: ₦250 dues + ₦50 constitution + ₦100 CGAN = ₦400
 * 4th Year (finalist):     ₦250 + ₦50 + ₦200 CGAN = ₦500
 * 4th Year (non-finalist): ₦250 + ₦50 + ₦100 CGAN = ₦400
 * 5th Year: ₦250 + ₦50 + ₦100 CGAN = ₦400
 * 6th Year: ₦250 + ₦50 + ₦0 CGAN = ₦300
 *
 * "Finalist" = final year of the student's programme duration.
 * Note: if course year is above four years, 4th year total is ₦400 not ₦500.
 */

export interface NFCSFeeBreakdown {
  annualDues: number;
  constitution: number;
  cgan: number;
  total: number;
  label: string;
  yearOrdinal: number;
  isFinalistYear: boolean;
}

export interface PaymentSession {
  session: string; // e.g. "2024/2025"
  yearOrdinal: number;
  yearLabel: string;
  /** Year 1 uses membership_levy (registration), subsequent years use annual_dues */
  feeType: "membership_levy" | "annual_dues";
  breakdown: NFCSFeeBreakdown;
  isEligible: boolean;
  isFuture: boolean;
  existingPayment?: {
    id: string;
    status: "pending" | "confirmed" | "failed" | "reversed";
    amount: number;
    payment_reference: string | null;
    payment_date: string | null;
    created_at: string | null;
  };
}

export const REQUIRED_DUES_TYPES = ["membership_levy", "annual_dues"] as const;
export type RequiredDuesType = (typeof REQUIRED_DUES_TYPES)[number];

const YEAR_LABELS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "6th Year",
];

/** Calculate the NFCS fee for a given year ordinal within a programme */
export function calculateFee(
  yearOrdinal: number,
  totalCourseYears: number
): NFCSFeeBreakdown {
  const finalist = yearOrdinal === totalCourseYears;
  const label = YEAR_LABELS[yearOrdinal - 1] ?? `Year ${yearOrdinal}`;

  if (yearOrdinal === 1) {
    return {
      annualDues: 250,
      constitution: 150,
      cgan: 100,
      total: 500,
      label,
      yearOrdinal,
      isFinalistYear: totalCourseYears === 1,
    };
  }
  if (yearOrdinal >= 6) {
    return {
      annualDues: 250,
      constitution: 50,
      cgan: 0,
      total: 300,
      label,
      yearOrdinal,
      isFinalistYear: finalist,
    };
  }
  const cgan = finalist ? 200 : 100;
  return {
    annualDues: 250,
    constitution: 50,
    cgan,
    total: 250 + 50 + cgan,
    label,
    yearOrdinal,
    isFinalistYear: finalist,
  };
}

/** Map academic level string to ordinal (1-6, 0 = graduate/alumni) */
export function getLevelOrdinal(academicLevel: string | null | undefined): number {
  switch (academicLevel) {
    case "100 Level": return 1;
    case "200 Level": return 2;
    case "300 Level": return 3;
    case "400 Level": return 4;
    case "500 Level": return 5;
    case "600 Level": return 6;
    default: return 0; // Graduate, Postgraduate, Alumni
  }
}

/** Convert ordinal to a display session label, anchored to currentSession */
export function deriveSessionLabel(
  currentLevelOrdinal: number,
  targetYearOrdinal: number,
  currentSession = "2024/2025"
): string {
  const [startStr] = currentSession.split("/");
  const currentStart = parseInt(startStr, 10);
  if (isNaN(currentStart) || currentLevelOrdinal === 0) return currentSession;
  const enrollmentStart = currentStart - (currentLevelOrdinal - 1);
  const targetStart = enrollmentStart + (targetYearOrdinal - 1);
  return `${targetStart}/${targetStart + 1}`;
}

function paymentStatusPriority(status: string) {
  switch (status) {
    case "confirmed":
      return 0;
    case "pending":
      return 1;
    case "failed":
    case "reversed":
      return 2;
    default:
      return 3;
  }
}

/** Build the full payment tracker for a student */
export function buildPaymentTracker(params: {
  currentLevelOrdinal: number;
  totalCourseYears: number;
  existingPayments: Array<{
    id: string;
    dues_type: string;
    payment_period: string | null;
    status: string;
    amount: number;
    payment_reference: string | null;
    payment_date: string | null;
    created_at: string | null;
  }>;
  currentSession?: string;
}): PaymentSession[] {
  const { currentLevelOrdinal, totalCourseYears, existingPayments, currentSession = "2024/2025" } = params;
  if (currentLevelOrdinal === 0) return [];

  const totalYears = Math.max(currentLevelOrdinal, totalCourseYears || 4);

  return Array.from({ length: totalYears }, (_, i) => {
    const yr = i + 1;
    const sessionLabel = deriveSessionLabel(currentLevelOrdinal, yr, currentSession);
    const breakdown = calculateFee(yr, totalCourseYears);
    const feeType: "membership_levy" | "annual_dues" = yr === 1 ? "membership_levy" : "annual_dues";
    const isEligible = yr <= currentLevelOrdinal;
    const isFuture = yr > currentLevelOrdinal;

    const matchingPayment = existingPayments
      .filter((p) => {
        if (yr === 1 && p.dues_type === "membership_levy") {
          return true;
        }

        return p.payment_period?.startsWith(sessionLabel) && p.dues_type === feeType;
      })
      .sort(
        (a, b) =>
          paymentStatusPriority(a.status) - paymentStatusPriority(b.status)
      )[0];

    return {
      session: sessionLabel,
      yearOrdinal: yr,
      yearLabel: breakdown.label,
      feeType,
      breakdown,
      isEligible,
      isFuture,
      existingPayment: matchingPayment
        ? {
            id: matchingPayment.id,
            status: matchingPayment.status as "pending" | "confirmed" | "failed" | "reversed",
            amount: matchingPayment.amount,
            payment_reference: matchingPayment.payment_reference,
            payment_date: matchingPayment.payment_date,
            created_at: matchingPayment.created_at,
          }
        : undefined,
    } satisfies PaymentSession;
  });
}

/** Find the next session that is not confirmed yet among eligible sessions */
export function getNextOutstanding(tracker: PaymentSession[]): PaymentSession | null {
  return (
    tracker.find(
      (s) => s.isEligible && s.existingPayment?.status !== "confirmed"
    ) ?? null
  );
}

/** All sessions up to current level that are not confirmed yet */
export function getAllPayableOutstanding(tracker: PaymentSession[]): PaymentSession[] {
  return tracker.filter(
    (s) => s.isEligible && s.existingPayment?.status !== "confirmed"
  );
}

/** True if every eligible session has a confirmed payment */
export function isFullyPaid(tracker: PaymentSession[]): boolean {
  const eligibleSessions = tracker.filter((s) => s.isEligible);
  return (
    eligibleSessions.length > 0 &&
    eligibleSessions.every((s) => s.existingPayment?.status === "confirmed")
  );
}

export function hasConfirmedRegistrationPayment(tracker: PaymentSession[]): boolean {
  return tracker.some(
    (session) =>
      session.feeType === "membership_levy" &&
      session.existingPayment?.status === "confirmed"
  );
}

export function getPayableRequiredSession(tracker: PaymentSession[]): PaymentSession | null {
  return getNextOutstanding(tracker);
}

export function findRequiredSession(params: {
  tracker: PaymentSession[];
  duesType: string;
  paymentPeriod: string;
}): PaymentSession | null {
  if (params.duesType === "membership_levy") {
    return params.tracker.find((session) => session.feeType === "membership_levy") ?? null;
  }

  return (
    params.tracker.find(
      (session) =>
        session.feeType === params.duesType &&
        params.paymentPeriod.startsWith(session.session)
    ) ?? null
  );
}

export function isRequiredDuesType(duesType: string): duesType is RequiredDuesType {
  return REQUIRED_DUES_TYPES.includes(duesType as RequiredDuesType);
}

export const CURRENT_SESSION = "2024/2025";
