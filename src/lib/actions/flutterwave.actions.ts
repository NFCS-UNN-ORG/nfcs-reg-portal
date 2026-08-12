"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/utils/app-url";
import { FlutterwaveService } from "@/lib/services/flutterwave.service";
import {
  confirmOnlinePayment,
  failOnlinePayment,
} from "@/lib/actions/payment.actions";
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
import type { Json } from "@/types/database.types";
import * as crypto from "crypto";

function getErrorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

function readEnv(name: string) {
  return process.env[name]?.trim();
}

function isUsableSecret(key?: string) {
  return (
    Boolean(key) &&
    !key?.toLowerCase().includes("placeholder") &&
    !key?.toLowerCase().includes("your-")
  );
}

export async function initiateFlutterwavePayment(values: {
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

  // Fetch student's profile info
  const { data: profile } = await adminClient
    .from("profiles")
    .select(
      "full_name, email, phone, academic_level, faculty, role, department",
    )
    .eq("id", user.id)
    .single();

  const isMockCheckoutEnabled = process.env.OPAY_ENABLE_MOCK_CHECKOUT === "true";
  const hasFlutterwaveCredentials = isUsableSecret(readEnv("FLUTTERWAVE_SECRET_KEY"));

  // Check required dues business logic
  if (
    profile &&
    !isAlumnus(profile.role) &&
    isRequiredDuesType(values.dues_type)
  ) {
    const levelOrdinal = getLevelOrdinal(profile.academic_level);
    const totalCourseYears = getYearsOfStudy(
      profile.faculty,
      profile.department,
    );

    const { data: allPayments } = await adminClient
      .from("payments")
      .select(
        "id, dues_type, payment_period, status, amount, payment_reference, payment_date, created_at",
      )
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
      return {
        error:
          "This required dues payment is not available for your current academic profile.",
      };
    }

    if (isFullyPaid(tracker)) {
      return {
        error:
          "You have completed all required dues for your current academic sessions.",
      };
    }

    if (
      !nextRequiredSession ||
      requestedSession.yearOrdinal !== nextRequiredSession.yearOrdinal
    ) {
      return {
        error: `Please complete ${nextRequiredSession?.yearLabel || "the previous session"} dues before paying this one.`,
      };
    }

    if (requestedSession.existingPayment?.status === "confirmed") {
      return { error: "You have already completed this dues payment." };
    }

    if (values.amount !== requestedSession.breakdown.total) {
      return {
        error:
          "The required dues amount does not match the approved fee for this session.",
      };
    }
  }

  // Duplicate payment guard
  const { data: existingPayments } = await adminClient
    .from("payments")
    .select("id, status, payment_reference, gateway, checkout_url, created_at")
    .eq("profile_id", user.id)
    .eq("dues_type", values.dues_type)
    .eq("payment_period", values.payment_period)
    .in("status", ["confirmed", "pending"]);

  if (existingPayments && existingPayments.length > 0) {
    const pending = existingPayments.find((p) => p.status === "pending");
    const confirmed = existingPayments.find((p) => p.status === "confirmed");
    if (confirmed) {
      return {
        error:
          "You have already paid dues for this session. Check your payment history.",
      };
    }
    if (pending) {
      if (pending.gateway === "flutterwave" && pending.checkout_url) {
        return {
          error:
            "You already have a pending payment for this session. Resuming checkout...",
          reference: pending.payment_reference,
          checkoutUrl: pending.checkout_url,
        };
      }
      // Supersede older pending record
      await adminClient
        .from("payments")
        .update({
          status: "failed",
          gateway_response: {
            reason: "Superseded by a new Flutterwave payment attempt",
            superseded_at: new Date().toISOString(),
          },
        })
        .eq("id", pending.id);
    }
  }

  const txRef = `NFCS-FLW-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
  const appUrl = getAppUrl();
  const redirectUrl = `${appUrl}/api/payments/flutterwave/verify/callback?tx_ref=${txRef}`;

  if (!hasFlutterwaveCredentials && isMockCheckoutEnabled) {
    try {
      const { error: dbError } = await adminClient.from("payments").insert({
        profile_id: user.id,
        amount: values.amount,
        dues_type: values.dues_type,
        channel: "online",
        status: "pending",
        payment_reference: txRef,
        gateway_reference: txRef,
        gateway: "mock_gateway",
        payment_period: values.payment_period,
        notes: values.notes || null,
        checkout_url: `${appUrl}/dues/pay/checkout?ref=${txRef}`,
      });

      if (dbError) {
        return { error: dbError.message };
      }

      return {
        success: true,
        reference: txRef,
        checkoutUrl: `${appUrl}/dues/pay/checkout?ref=${txRef}`,
        isMock: true,
      };
    } catch (err) {
      return { error: getErrorMessage(err, "Failed to initiate mock checkout") };
    }
  }

  if (!hasFlutterwaveCredentials) {
    return {
      error:
        "Flutterwave credentials are not configured. Please set FLUTTERWAVE_SECRET_KEY in settings or environment.",
    };
  }

  try {
    // Insert pending payment record
    const { error: dbError } = await adminClient.from("payments").insert({
      profile_id: user.id,
      amount: values.amount,
      dues_type: values.dues_type,
      channel: "online",
      status: "pending",
      payment_reference: txRef,
      gateway_reference: txRef,
      gateway: "flutterwave",
      payment_period: values.payment_period,
      notes: values.notes || null,
    });

    if (dbError) {
      return { error: dbError.message };
    }

    // Call Flutterwave API
    const flutterwave = new FlutterwaveService();
    const initResult = await flutterwave.initializePayment({
      amount: values.amount,
      email: profile?.email || user.email || "student@nfcs-unn.org",
      txRef,
      redirectUrl,
      customerName: profile?.full_name,
      customerPhone: profile?.phone || undefined,
      title: "NFCS Dues Payment",
      description: `${values.dues_type.replace(/_/g, " ")} (${values.payment_period})`,
    });

    if (!initResult.success) {
      // Mark as failed in DB
      await adminClient
        .from("payments")
        .update({ status: "failed", gateway_response: { error: initResult.error } })
        .eq("payment_reference", txRef);

      return { error: initResult.error };
    }

    // Update payment record with Flutterwave checkout link
    await adminClient
      .from("payments")
      .update({
        checkout_url: initResult.checkoutUrl,
        gateway_response: initResult.raw as unknown as Json,
      })
      .eq("payment_reference", txRef);

    return {
      success: true,
      reference: txRef,
      checkoutUrl: initResult.checkoutUrl,
      isMock: false,
    };
  } catch (err) {
    return { error: getErrorMessage(err, "Failed to initiate Flutterwave payment") };
  }
}

export async function verifyFlutterwavePayment(transactionIdOrRef: string) {
  try {
    const flutterwave = new FlutterwaveService();
    const verifyResult = await flutterwave.verifyTransaction(transactionIdOrRef);

    const lookupRef = verifyResult.success && verifyResult.txRef ? verifyResult.txRef : transactionIdOrRef;

    // Find payment record by tx_ref or payment_reference / gateway_reference
    const { data: payment, error: findError } = await adminClient
      .from("payments")
      .select("id, profile_id, status, gateway, payment_reference, gateway_reference")
      .or(`payment_reference.eq.${lookupRef},gateway_reference.eq.${lookupRef},payment_reference.eq.${transactionIdOrRef}`)
      .single();

    if (findError || !payment) {
      return { error: "Payment transaction record not found" };
    }

    if (payment.status === "confirmed") {
      return { success: true, status: "confirmed", paymentId: payment.id };
    }

    if (payment.gateway === "mock_gateway") {
      return { success: true, status: payment.status, paymentId: payment.id };
    }

    if (!verifyResult.success) {
      return { error: verifyResult.error };
    }

    const reference = payment.payment_reference || lookupRef;

    if (verifyResult.status === "successful") {
      const confirmResult = await confirmOnlinePayment(reference, verifyResult.raw as unknown as Json);
      if (confirmResult.error) {
        return { error: confirmResult.error };
      }
      return { success: true, status: "confirmed", paymentId: payment.id };
    } else if (verifyResult.status === "failed") {
      const failResult = await failOnlinePayment(reference, verifyResult.raw as unknown as Json);
      if (failResult.error) {
        return { error: failResult.error };
      }
      return { success: true, status: "failed", paymentId: payment.id };
    }

    return { success: true, status: "pending", paymentId: payment.id };
  } catch (err) {
    return { error: getErrorMessage(err, "Failed to verify Flutterwave payment") };
  }
}
