"use server";

import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ManualPaymentFormValues } from "@/lib/validations/payment.schema";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import DuesReceipt from "../../../emails/DuesReceipt";
import { parseMoneyAmount } from "@/lib/utils/money";
import * as React from "react";
import { createNotification } from "@/lib/actions/notification.actions";
import { getLevelOrdinal, deriveSessionLabel, CURRENT_SESSION } from "@/lib/utils/fees";

/** Fetch a single payment by reference — uses adminClient to bypass RLS join issues in checkout */
export async function getPaymentByReference(reference: string) {
  try {
    // Verify the caller is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required", payment: null };

    const { data: payment, error } = await adminClient
      .from("payments")
      .select("id, payment_reference, dues_type, payment_period, amount, status, profile_id, gateway, opay_cashier_url")
      .eq("payment_reference", reference)
      .single();

    if (error || !payment) {
      return { error: "Payment transaction not found.", payment: null };
    }

    // Security: ensure the payment belongs to the requesting user
    if (payment.profile_id !== user.id) {
      return { error: "Unauthorized.", payment: null };
    }

    // Fetch full_name from profiles
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    return {
      payment: {
        ...payment,
        full_name: profile?.full_name ?? null,
        mock_checkout_enabled: process.env.OPAY_ENABLE_MOCK_CHECKOUT === "true",
      },
      error: null,
    };
  } catch (err: any) {
    return { error: err?.message || "Failed to load payment.", payment: null };
  }
}

export async function initiatePayment(values: {
  amount: number;
  dues_type: any;
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

  // ── Duplicate payment guard ──────────────────────────────────────────────
  // Prevent initiating a new payment if a confirmed or pending payment already
  // exists for the same dues_type + payment_period for this member.
  // (Failed / reversed payments are allowed to be re-initiated.)
  const { data: existingPayments } = await adminClient
    .from("payments")
    .select("id, status, payment_reference")
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
      return {
        error: "You already have a pending payment for this session. Resuming your checkout...",
        reference: null,
        pendingReference: pending.payment_reference,
      };
    }
  }
  // ────────────────────────────────────────────────────────────────────────

  const payment_reference = `NFCS-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

  try {
    const { data: payment, error } = await adminClient
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
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    // In-app notification for the initiating student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Initiated ⏳",
        body: `Your payment of ₦${Number(payment.amount).toLocaleString()} for ${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""}) has been initiated. Status: Pending. Ref: ${payment_reference}.`,
        type: "payment_pending",
        metadata: { reference: payment_reference, amount: payment.amount, dues_type: payment.dues_type, status: "pending" },
      });
    }

    return { success: true, reference: payment_reference };
  } catch (err: any) {
    return { error: err?.message || "Failed to initiate payment" };
  }
}

export async function confirmMockPayment(reference: string) {
  try {
    const { data: payment, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .eq("payment_reference", reference)
      .single();

    if (findError || !payment) {
      return { error: "Payment record not found" };
    }

    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        status: "confirmed",
        payment_date: new Date().toISOString().split("T")[0],
      })
      .eq("payment_reference", reference);

    if (updateError) {
      return { error: updateError.message };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: payment.profile_id || payment.recorded_by,
      action: "payment_confirmed",
      target_type: "payment",
      target_id: payment.id,
      metadata: {
        reference,
        amount: payment.amount,
      },
    });

    // Send DuesReceipt email
    try {
      let email = "";
      let fullName = "";
      if (payment.profile_id) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("email, full_name")
          .eq("id", payment.profile_id)
          .single();
        if (profile) {
          email = profile.email;
          fullName = profile.full_name;
        }
      } else if (payment.legacy_member_id) {
        const { data: legacy } = await adminClient
          .from("legacy_members")
          .select("email, full_name")
          .eq("id", payment.legacy_member_id)
          .single();
        if (legacy) {
          email = legacy.email || "";
          fullName = legacy.full_name;
        }
      }

      if (email) {
        await sendEmail({
          to: email,
          subject: `NFCS Payment Receipt: ${reference}`,
          react: (
            <DuesReceipt
              fullName={fullName}
              reference={reference}
              amount={payment.amount}
              duesType={payment.dues_type}
              period={payment.payment_period || ""}
              datePaid={new Date().toLocaleDateString()}
            />
          ),
        });
      }
    } catch (emailErr) {
      console.error("Failed to send dues receipt email:", emailErr);
    }


    // In-app notification for the paying student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Confirmed ✓",
        body: `Your payment of ₦${Number(payment.amount).toLocaleString()} for ${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""}) has been confirmed. Ref: ${reference}.`,
        type: "payment_confirmed",
        metadata: { reference, amount: payment.amount, dues_type: payment.dues_type },
      });
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to confirm payment" };
  }
}

export async function failMockPayment(reference: string) {
  try {
    const { data: payment, error } = await adminClient
      .from("payments")
      .update({
        status: "failed",
      })
      .eq("payment_reference", reference)
      .select()
      .single();

    if (error || !payment) {
      return { error: error?.message || "Payment record not found" };
    }

    // In-app notification for the student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Failed ✗",
        body: `Your payment of ₦${Number(payment.amount).toLocaleString()} for ${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""}) has failed. Ref: ${reference}.`,
        type: "payment_failed",
        metadata: { reference, amount: payment.amount, dues_type: payment.dues_type, status: "failed" },
      });
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to fail payment" };
  }
}

export async function recordManualPayment(values: ManualPaymentFormValues, excoId: string) {
  try {
    // Check if target is a legacy member or profile
    const supabase = await createClient();
    
    // Check in profiles first
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("id", values.member_id)
      .single();

    let profile_id = null;
    let legacy_member_id = null;
    let email = "";
    let fullName = "";

    if (profile) {
      profile_id = values.member_id;
      email = profile.email;
      fullName = profile.full_name;
    } else {
      const { data: legacy } = await adminClient
        .from("legacy_members")
        .select("id, email, full_name")
        .eq("id", values.member_id)
        .single();
      if (legacy) {
        legacy_member_id = values.member_id;
        email = legacy.email || "";
        fullName = legacy.full_name;
      }
    }

    const amount = parseMoneyAmount(values.amount);

    const { data: payment, error } = await adminClient
      .from("payments")
      .insert({
        profile_id,
        legacy_member_id,
        amount,
        dues_type: values.dues_type,
        channel: "manual",
        status: "confirmed",
        payment_period: values.payment_period,
        payment_reference: `MAN-${crypto.randomUUID().substring(0, 8).toUpperCase()}`,
        recorded_by: excoId,
        receipt_number: values.receipt_number,
        payment_date: values.payment_date,
        notes: values.notes || null,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "record_manual_payment",
      target_type: "payment",
      target_id: payment.id,
      metadata: {
        member_id: values.member_id,
        amount,
      },
    });

    // Send DuesReceipt email
    try {
      if (email) {
        await sendEmail({
          to: email,
          subject: `NFCS Payment Receipt: ${payment.payment_reference}`,
          react: (
            <DuesReceipt
              fullName={fullName}
              reference={payment.payment_reference || ""}
              amount={payment.amount}
              duesType={payment.dues_type}
              period={payment.payment_period || ""}
              datePaid={payment.payment_date || new Date().toLocaleDateString()}
            />
          ),
        });
      }
    } catch (emailErr) {
      console.error("Failed to send dues receipt email:", emailErr);
    }

    // Dual in-app notifications for manual payments
    if (profile_id) {
      // Fetch exco name
      const { data: excoProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("id", excoId)
        .single();
      const excoName = excoProfile?.full_name ?? "an Exco member";
      const amountFormatted = `₦${Number(payment.amount).toLocaleString()}`;
      const duesLabel = (payment.dues_type as string)?.replace("_", " ") ?? "dues";
      const period = payment.payment_period ?? "";

      // Student notification (names the exco who recorded it)
      await createNotification({
        profile_id,
        title: "Payment Recorded ✓",
        body: `Your ${duesLabel} payment of ${amountFormatted}${period ? ` for ${period}` : ""} was successfully recorded by ${excoName}.`,
        type: "payment_recorded_by_exco",
        metadata: { payment_id: payment.id, recorded_by: excoId, exco_name: excoName, amount: payment.amount },
      });

      // Exco notification (names the student)
      await createNotification({
        profile_id: excoId,
        title: "Payment Successfully Recorded",
        body: `You successfully recorded a ${duesLabel} payment of ${amountFormatted}${period ? ` for ${period}` : ""} on behalf of ${fullName}.`,
        type: "payment_recorded_by_exco",
        metadata: { payment_id: payment.id, student_name: fullName, student_id: profile_id, amount: payment.amount },
      });
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to record manual payment" };
  }
}

/** Fetch all payments for the currently authenticated user (for client-side use) */
export async function getMyPayments() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Authentication required", payments: [] };
  }

  const { data: payments, error } = await supabase
    .from("payments")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: error.message, payments: [] };
  }

  return { payments: payments || [] };
}

export async function confirmPayment(paymentId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "super_admin" && profile.role !== "exco")) {
      return { error: "Unauthorized. Exco/Admin privileges required." };
    }

    const { data: payment, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (findError || !payment) {
      return { error: "Payment record not found" };
    }

    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        status: "confirmed",
        payment_date: new Date().toISOString().split("T")[0],
      })
      .eq("id", paymentId);

    if (updateError) {
      return { error: updateError.message };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: user.id,
      action: "payment_confirmed",
      target_type: "payment",
      target_id: paymentId,
      metadata: {
        reference: payment.payment_reference,
        amount: payment.amount,
      },
    });

    // Send DuesReceipt email
    try {
      let email = "";
      let fullName = "";
      if (payment.profile_id) {
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("email, full_name")
          .eq("id", payment.profile_id)
          .single();
        if (targetProfile) {
          email = targetProfile.email;
          fullName = targetProfile.full_name;
        }
      } else if (payment.legacy_member_id) {
        const { data: legacy } = await adminClient
          .from("legacy_members")
          .select("email, full_name")
          .eq("id", payment.legacy_member_id)
          .single();
        if (legacy) {
          email = legacy.email || "";
          fullName = legacy.full_name;
        }
      }

      if (email) {
        await sendEmail({
          to: email,
          subject: `NFCS Payment Receipt: ${payment.payment_reference}`,
          react: (
            <DuesReceipt
              fullName={fullName}
              reference={payment.payment_reference ?? ""}
              amount={payment.amount}
              duesType={payment.dues_type}
              period={payment.payment_period || ""}
              datePaid={new Date().toLocaleDateString()}
            />
          ),
        });
      }
    } catch (emailErr) {
      console.error("Failed to send dues receipt email:", emailErr);
    }

    // In-app notification for the student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Confirmed ✓",
        body: `Your payment of ₦${Number(payment.amount).toLocaleString()} for ${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""}) has been confirmed. Ref: ${payment.payment_reference}.`,
        type: "payment_confirmed",
        metadata: { reference: payment.payment_reference, amount: payment.amount, dues_type: payment.dues_type, status: "confirmed" },
      });
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to confirm payment" };
  }
}

export async function reversePayment(paymentId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.role !== "super_admin" && profile.role !== "exco")) {
      return { error: "Unauthorized. Exco/Admin privileges required." };
    }

    const { data: payment, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (findError || !payment) {
      return { error: "Payment record not found" };
    }

    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        status: "reversed",
      })
      .eq("id", paymentId);

    if (updateError) {
      return { error: updateError.message };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: user.id,
      action: "payment_reversed",
      target_type: "payment",
      target_id: paymentId,
      metadata: {
        reference: payment.payment_reference,
        amount: payment.amount,
      },
    });

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to reverse payment" };
  }
}

export async function deletePayment(paymentId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return { error: "Unauthorized. Only Super Admins can delete payment records." };
    }

    const { data: payment, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .eq("id", paymentId)
      .single();

    if (findError || !payment) {
      return { error: "Payment record not found" };
    }

    const { error: deleteError } = await adminClient
      .from("payments")
      .delete()
      .eq("id", paymentId);

    if (deleteError) {
      return { error: deleteError.message };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: user.id,
      action: "payment_deleted",
      target_type: "payment",
      target_id: paymentId,
      metadata: {
        reference: payment.payment_reference,
        amount: payment.amount,
      },
    });

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to delete payment" };
  }
}

export async function confirmOnlinePayment(reference: string, gatewayResponse: any) {
  try {
    const { data: payment, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .eq("payment_reference", reference)
      .single();

    if (findError || !payment) {
      return { error: "Payment record not found" };
    }

    if (payment.status === "confirmed") {
      return { success: true, message: "Payment already confirmed" };
    }

    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        status: "confirmed",
        payment_date: new Date().toISOString().split("T")[0],
        gateway_response: gatewayResponse,
      })
      .eq("payment_reference", reference);

    if (updateError) {
      return { error: updateError.message };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: payment.profile_id || payment.recorded_by,
      action: "payment_confirmed",
      target_type: "payment",
      target_id: payment.id,
      metadata: {
        reference,
        amount: payment.amount,
        gateway: payment.gateway,
      },
    });

    // Send DuesReceipt email
    try {
      let email = "";
      let fullName = "";
      if (payment.profile_id) {
        const { data: profile } = await adminClient
          .from("profiles")
          .select("email, full_name")
          .eq("id", payment.profile_id)
          .single();
        if (profile) {
          email = profile.email;
          fullName = profile.full_name;
        }
      } else if (payment.legacy_member_id) {
        const { data: legacy } = await adminClient
          .from("legacy_members")
          .select("email, full_name")
          .eq("id", payment.legacy_member_id)
          .single();
        if (legacy) {
          email = legacy.email || "";
          fullName = legacy.full_name;
        }
      }

      if (email) {
        await sendEmail({
          to: email,
          subject: `NFCS Payment Receipt: ${reference}`,
          react: (
            <DuesReceipt
              fullName={fullName}
              reference={reference}
              amount={payment.amount}
              duesType={payment.dues_type}
              period={payment.payment_period || ""}
              datePaid={new Date().toLocaleDateString()}
            />
          ),
        });
      }
    } catch (emailErr) {
      console.error("Failed to send dues receipt email:", emailErr);
    }

    // In-app notification for the student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Confirmed ✓",
        body: `Your online payment of ₦${Number(payment.amount).toLocaleString()} for ${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""}) has been confirmed. Ref: ${reference}.`,
        type: "payment_confirmed",
        metadata: { reference, amount: payment.amount, dues_type: payment.dues_type, status: "confirmed" },
      });
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to confirm payment" };
  }
}

export async function failOnlinePayment(reference: string, gatewayResponse: any) {
  try {
    const { data: payment, error } = await adminClient
      .from("payments")
      .update({
        status: "failed",
        gateway_response: gatewayResponse,
      })
      .eq("payment_reference", reference)
      .select()
      .single();

    if (error || !payment) {
      return { error: error?.message || "Payment record not found" };
    }

    // In-app notification for the student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Failed ✗",
        body: `Your online payment of ₦${Number(payment.amount).toLocaleString()} for ${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""}) has failed. Ref: ${reference}.`,
        type: "payment_failed",
        metadata: { reference, amount: payment.amount, dues_type: payment.dues_type, status: "failed" },
      });
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to mark payment as failed" };
  }
}

export async function fixHistoricalManualPayments() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "super_admin") {
      return { error: "Unauthorized. Super Admin role required." };
    }

    // 1. Fetch all confirmed payments
    const { data: payments, error: paymentsErr } = await adminClient
      .from("payments")
      .select("id, profile_id, dues_type, payment_period, status, created_at")
      .eq("status", "confirmed")
      .not("profile_id", "is", null)
      .order("created_at", { ascending: true });

    if (paymentsErr || !payments) {
      return { error: paymentsErr?.message || "Failed to fetch payments" };
    }

    // 2. Fetch all profiles to know their academic level
    const { data: profiles, error: profilesErr } = await adminClient
      .from("profiles")
      .select("id, academic_level");

    if (profilesErr || !profiles) {
      return { error: profilesErr?.message || "Failed to fetch profiles" };
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p.academic_level]));
    let updateCount = 0;

    // Group confirmed payments by profile_id
    const paymentsByProfile: Record<string, typeof payments> = {};
    for (const p of payments) {
      if (!paymentsByProfile[p.profile_id!]) {
        paymentsByProfile[p.profile_id!] = [];
      }
      paymentsByProfile[p.profile_id!].push(p);
    }

    // Loop through each profile's payments
    for (const [profileId, profilePayments] of Object.entries(paymentsByProfile)) {
      const academicLevel = profileMap.get(profileId);
      const currentLevelOrdinal = getLevelOrdinal(academicLevel);

      if (currentLevelOrdinal === 0) continue;

      // Group payments by type
      const levyPayments = profilePayments.filter((p) => p.dues_type === "membership_levy");
      const annualDuesPayments = profilePayments.filter((p) => p.dues_type === "annual_dues");

      // For Year 1 (membership_levy)
      const expectedLevyPeriod = deriveSessionLabel(currentLevelOrdinal, 1, CURRENT_SESSION);
      for (const p of levyPayments) {
        if (!p.payment_period || !p.payment_period.startsWith(expectedLevyPeriod)) {
          const { error: updateErr } = await adminClient
            .from("payments")
            .update({ payment_period: expectedLevyPeriod })
            .eq("id", p.id);
          if (!updateErr) updateCount++;
        }
      }

      // For Year 2, 3, 4, etc. (annual_dues)
      for (let i = 0; i < annualDuesPayments.length; i++) {
        const targetYearOrdinal = i + 2; // annual dues start from Year 2
        if (targetYearOrdinal > currentLevelOrdinal) break; // ignore excess payments

        const expectedPeriod = deriveSessionLabel(currentLevelOrdinal, targetYearOrdinal, CURRENT_SESSION);
        const p = annualDuesPayments[i];

        if (!p.payment_period || !p.payment_period.startsWith(expectedPeriod)) {
          const { error: updateErr } = await adminClient
            .from("payments")
            .update({ payment_period: expectedPeriod })
            .eq("id", p.id);
          if (!updateErr) updateCount++;
        }
      }
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true, updatedCount: updateCount };
  } catch (err: any) {
    return { error: err?.message || "Failed to fix historical manual payments" };
  }
}
