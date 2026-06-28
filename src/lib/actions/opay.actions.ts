"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createOPayOrder, queryOPayStatus } from "@/lib/opay";
import { confirmOnlinePayment, failOnlinePayment } from "@/lib/actions/payment.actions";
import type { PaymentFormValues } from "@/lib/validations/payment.schema";
import { getYearsOfStudy, isAlumnus } from "@/lib/utils/unn-data";
import {
  buildPaymentTracker,
  CURRENT_SESSION,
  findRequiredSession,
  getLevelOrdinal,
  getPayableRequiredSession,
  isFullyPaid,
  isRequiredDuesType,
} from "@/lib/utils/fees";
import { revalidatePath } from "next/cache";
import * as crypto from "crypto";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function normalizeOPayStatus(status: unknown) {
  return String(status || "").trim().toUpperCase();
}

function isPaidOPayStatus(status: unknown) {
  return ["SUCCESS", "PAID", "COMPLETED"].includes(normalizeOPayStatus(status));
}

function isFailedOPayStatus(status: unknown) {
  return ["FAIL", "FAILED", "CLOSE", "CLOSED", "CANCELLED", "CANCELED"].includes(
    normalizeOPayStatus(status),
  );
}

function isOPayTimeoutError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || "");

  return (
    message.includes("02001") ||
    message.toLowerCase().includes("payment session timeout") ||
    message.toLowerCase().includes("session timeout")
  );
}

function readEnv(name: string) {
  return process.env[name]?.trim();
}

function isPlaceholderValue(value?: string) {
  return (
    !value ||
    value.toLowerCase().includes("placeholder") ||
    value.toLowerCase().includes("your-") ||
    value.startsWith("OPAYxxx")
  );
}

function getOPayCheckoutTtlMs() {
  const configuredMinutes = Number(readEnv("OPAY_CHECKOUT_TTL_MINUTES") || 30);
  const minutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
    ? configuredMinutes
    : 30;

  return minutes * 60 * 1000;
}

function isExpiredCheckout(createdAt: string | null) {
  if (!createdAt) {
    return false;
  }

  return Date.now() - new Date(createdAt).getTime() > getOPayCheckoutTtlMs();
}

async function markOPayPaymentExpired(paymentId: string, reference: string | null) {
  const { error } = await adminClient
    .from("payments")
    .update({
      status: "failed",
      gateway_response: {
        code: "OPAY_SESSION_TIMEOUT",
        message: "OPay checkout session expired before completion.",
        reference,
        expired_at: new Date().toISOString(),
      },
    })
    .eq("id", paymentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dues");
  revalidatePath("/admin/dues");
  return { success: true };
}

export async function initiateOPayPayment(values: {
  amount: number;
  dues_type: PaymentFormValues["dues_type"];
  payment_period: string;
  notes?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required" };
  }

  // Fetch student's profile info for OPay request
  const { data: profile } = await adminClient
    .from("profiles")
    .select("full_name, email, phone, academic_level, faculty, role, department")
    .eq("id", user.id)
    .single();

  const isMockCheckoutEnabled = process.env.OPAY_ENABLE_MOCK_CHECKOUT === "true";
  const hasOPayCredentials =
    !isPlaceholderValue(readEnv("OPAY_PUBLIC_KEY")) &&
    !isPlaceholderValue(readEnv("OPAY_MERCHANT_ID"));

  if (profile && !isAlumnus(profile.role) && isRequiredDuesType(values.dues_type)) {
    const levelOrdinal = getLevelOrdinal(profile.academic_level);
    const totalCourseYears = getYearsOfStudy(profile.faculty, profile.department);

    const { data: allPayments } = await adminClient
      .from("payments")
      .select("id, dues_type, payment_period, status, amount, payment_reference, payment_date, created_at")
      .eq("profile_id", user.id);

    const tracker = buildPaymentTracker({
      currentLevelOrdinal: levelOrdinal,
      totalCourseYears,
      existingPayments: (allPayments || []).map((payment) => ({
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
    });

    const requestedSession = findRequiredSession({
      tracker,
      duesType: values.dues_type,
      paymentPeriod: values.payment_period,
    });
    const nextRequiredSession = getPayableRequiredSession(tracker);

    if (!requestedSession) {
      return { error: "This required dues payment is not available for your current academic profile." };
    }

    if (isFullyPaid(tracker)) {
      return { error: "You have completed all required dues for your current academic sessions." };
    }

    if (!nextRequiredSession || requestedSession.yearOrdinal !== nextRequiredSession.yearOrdinal) {
      return {
        error: `Please complete ${nextRequiredSession?.yearLabel || "the previous session"} dues before paying this one.`,
      };
    }

    if (requestedSession.existingPayment?.status === "confirmed") {
      return { error: "You have already completed this dues payment." };
    }

    if (values.amount !== requestedSession.breakdown.total) {
      return { error: "The required dues amount does not match the approved fee for this session." };
    }
  }

  // Duplicate payment guard
  // Prevent initiating a new payment if a confirmed or pending payment already
  // exists for the same dues_type + payment_period for this student.
  const { data: existingPayments } = await adminClient
    .from("payments")
    .select("id, status, payment_reference, gateway, opay_cashier_url, created_at")
    .eq("profile_id", user.id)
    .eq("dues_type", values.dues_type)
    .eq("payment_period", values.payment_period)
    .in("status", ["confirmed", "pending"]);

  if (existingPayments && existingPayments.length > 0) {
    const pending = existingPayments.find((p) => p.status === "pending");
    const confirmed = existingPayments.find((p) => p.status === "confirmed");
    if (confirmed) {
      return { error: "You have already paid dues for this session. Check your payment history." };
    }
    if (pending) {
      if (pending.gateway === "opay" && isExpiredCheckout(pending.created_at)) {
        await markOPayPaymentExpired(pending.id, pending.payment_reference);
      } else if (pending.gateway === "opay" && pending.opay_cashier_url) {
        return {
          error: "You already have a pending payment for this session. Resuming your checkout...",
          reference: null,
          pendingReference: pending.payment_reference,
          cashierUrl: pending.opay_cashier_url,
        };
      } else if (pending.gateway === "mock_gateway" && isMockCheckoutEnabled) {
        return {
          error: "You already have a pending payment for this session. Resuming your checkout...",
          reference: null,
          pendingReference: pending.payment_reference,
          cashierUrl: null,
        };
      } else {
        // Older mock or incomplete Opay records should not trap users in fake checkout.
        await adminClient
          .from("payments")
          .update({
            status: "failed",
            gateway_response: {
              reason: "Superseded by a new OPay checkout attempt",
              superseded_at: new Date().toISOString(),
            },
          })
          .eq("id", pending.id);
      }
    }
  }

  const payment_reference = `NFCS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

  if (!hasOPayCredentials && !isMockCheckoutEnabled) {
    return {
      error:
        "OPay checkout is not configured. Please add valid OPay merchant credentials before taking live payments.",
    };
  }

  if (!hasOPayCredentials && isMockCheckoutEnabled) {
    // Record payment as using the mock gateway
    try {
      const { error } = await adminClient
        .from("payments")
        .insert({
          profile_id: user.id,
          amount: values.amount,
          dues_type: values.dues_type,
          channel: "online",
          status: "pending",
          payment_reference,
          gateway: "mock_gateway",
          payment_period: values.payment_period,
          notes: values.notes || null,
        });

      if (error) {
        return { error: error.message };
      }

      return { success: true, reference: payment_reference, isMock: true };
    } catch (err: unknown) {
      return { error: getErrorMessage(err, "Failed to initiate mock checkout") };
    }
  }

  // Live or Sandbox OPay Express Checkout flow
  try {
    // 1. Create a pending payment record in the database
    const { error: dbError } = await adminClient
      .from("payments")
      .insert({
        profile_id: user.id,
        amount: values.amount,
        dues_type: values.dues_type,
        channel: "online",
        status: "pending",
        payment_reference,
        gateway: "opay",
        payment_period: values.payment_period,
        notes: values.notes || null,
      });

    if (dbError) {
      return { error: dbError.message };
    }

    // 2. Call OPay cashier create API
    const cashierData = await createOPayOrder({
      reference: payment_reference,
      amount: values.amount,
      customerName: profile?.full_name,
      customerEmail: profile?.email,
      customerPhone: profile?.phone || undefined,
      notes: values.notes || `${values.dues_type.replace(/_/g, " ")} (${values.payment_period})`,
    });

    // 3. Update database record with OPay's order details
    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        opay_cashier_url: cashierData.cashierUrl,
        opay_order_no: cashierData.orderNo,
      })
      .eq("payment_reference", payment_reference);

    if (updateError) {
      console.error("Failed to update database with OPay details:", updateError.message);
    }

    return {
      success: true,
      reference: payment_reference,
      cashierUrl: cashierData.cashierUrl,
      isMock: false,
    };
  } catch (err: unknown) {
    return { error: getErrorMessage(err, "Failed to initiate OPay transaction") };
  }
}

export async function resumeOPayCheckout(reference: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required" };
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select(
        "id, profile_id, amount, dues_type, payment_period, payment_reference, status, gateway, notes, opay_cashier_url"
      )
      .eq("payment_reference", reference)
      .single();

    if (paymentError || !payment) {
      return { error: "Payment transaction not found." };
    }

    if (payment.profile_id !== user.id) {
      return { error: "Unauthorized." };
    }

    if (payment.status !== "pending" || payment.gateway !== "opay") {
      return { error: "This transaction is not an active OPay checkout." };
    }

    if (payment.opay_cashier_url) {
      return { success: true, cashierUrl: payment.opay_cashier_url };
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .single();

    const cashierData = await createOPayOrder({
      reference,
      amount: Number(payment.amount),
      customerName: profile?.full_name,
      customerEmail: profile?.email,
      customerPhone: profile?.phone || undefined,
      notes:
        payment.notes ||
        `${payment.dues_type.replace(/_/g, " ")} (${payment.payment_period || "Dues payment"})`,
    });

    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        opay_cashier_url: cashierData.cashierUrl,
        opay_order_no: cashierData.orderNo,
      })
      .eq("id", payment.id);

    if (updateError) {
      return { error: updateError.message };
    }

    return { success: true, cashierUrl: cashierData.cashierUrl };
  } catch (err: unknown) {
    return { error: getErrorMessage(err, "Failed to resume OPay checkout") };
  }
}

export async function expireStaleOPayCheckout(reference: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required" };
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, profile_id, payment_reference, status, gateway, created_at")
      .eq("payment_reference", reference)
      .single();

    if (paymentError || !payment) {
      return { error: "Payment transaction not found." };
    }

    if (payment.profile_id !== user.id) {
      return { error: "Unauthorized." };
    }

    if (payment.status !== "pending" || payment.gateway !== "opay") {
      return { expired: false };
    }

    if (!isExpiredCheckout(payment.created_at)) {
      return { expired: false };
    }

    const expireResult = await markOPayPaymentExpired(payment.id, payment.payment_reference);
    if (expireResult.error) {
      return { error: expireResult.error };
    }

    return { expired: true };
  } catch (err: unknown) {
    return { error: getErrorMessage(err, "Failed to expire stale OPay checkout") };
  }
}

export async function syncOPayPaymentStatus(reference: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required" };
    }

    const { data: payment, error: paymentError } = await adminClient
      .from("payments")
      .select("id, profile_id, status, gateway")
      .eq("payment_reference", reference)
      .single();

    if (paymentError || !payment) {
      return { error: "Payment transaction not found." };
    }

    if (payment.profile_id !== user.id) {
      return { error: "Unauthorized." };
    }

    if (payment.status === "confirmed") {
      return { success: true, status: "confirmed", paymentId: payment.id };
    }

    if (payment.gateway !== "opay") {
      return { error: "This transaction is not an OPay payment." };
    }

    let opayStatus: Awaited<ReturnType<typeof queryOPayStatus>>;
    try {
      opayStatus = await queryOPayStatus(reference);
    } catch (err: unknown) {
      if (isOPayTimeoutError(err)) {
        const expireResult = await markOPayPaymentExpired(payment.id, reference);
        if (expireResult.error) {
          return { error: expireResult.error };
        }

        return { success: true, status: "failed", paymentId: payment.id };
      }

      throw err;
    }
    const status =
      opayStatus?.status ||
      opayStatus?.orderStatus ||
      opayStatus?.transactionStatus ||
      opayStatus?.paymentStatus;

    if (isPaidOPayStatus(status)) {
      const confirmResult = await confirmOnlinePayment(reference, opayStatus);
      if (confirmResult.error) {
        return { error: confirmResult.error };
      }

      return { success: true, status: "confirmed", paymentId: payment.id };
    }

    if (isFailedOPayStatus(status)) {
      const failResult = await failOnlinePayment(reference, opayStatus);
      if (failResult.error) {
        return { error: failResult.error };
      }

      return { success: true, status: "failed", paymentId: payment.id };
    }

    return {
      success: true,
      status: "pending",
      paymentId: payment.id,
      gatewayStatus: normalizeOPayStatus(status) || "UNKNOWN",
    };
  } catch (err: unknown) {
    return { error: getErrorMessage(err, "Failed to verify OPay payment status") };
  }
}
