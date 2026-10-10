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
import { getLevelOrdinal, deriveSessionLabel, CURRENT_SESSION, buildPaymentTracker, isRequiredDuesType } from "@/lib/utils/fees";
import { getYearsOfStudy, isAlumnus } from "@/lib/utils/unn-data";

/** Fetch payment by reference (single or batch) — uses adminClient to bypass RLS join issues in checkout */
export async function getPaymentByReference(reference: string) {
  try {
    // Verify the caller is authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Authentication required", payment: null };

    const { data: payments, error } = await adminClient
      .from("payments")
      .select("id, payment_reference, dues_type, payment_period, amount, status, profile_id, gateway, opay_cashier_url, gateway_reference, checkout_url")
      .or(`payment_reference.eq.${reference},gateway_reference.eq.${reference}`);

    if (error || !payments || payments.length === 0) {
      return { error: "Payment transaction not found.", payment: null };
    }

    // Security: ensure the payments belong to the requesting user
    if (payments.some((p) => p.profile_id !== user.id)) {
      return { error: "Unauthorized.", payment: null };
    }

    // Fetch full_name from profiles
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const combinedPeriods = Array.from(new Set(payments.map((p) => p.payment_period).filter(Boolean))).join(", ");
    const primary = payments[0];

    return {
      payment: {
        ...primary,
        amount: totalAmount,
        payment_period: combinedPeriods || primary.payment_period,
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
    const { data: payments, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .or(`payment_reference.eq.${reference},gateway_reference.eq.${reference}`);

    if (findError || !payments || payments.length === 0) {
      return { error: "Payment record not found" };
    }

    const allConfirmed = payments.every((p) => p.status === "confirmed");
    if (allConfirmed) {
      return { success: true, message: "Payment already confirmed" };
    }

    const paymentIds = payments.map((p) => p.id);
    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        status: "confirmed",
        payment_date: new Date().toISOString().split("T")[0],
      })
      .in("id", paymentIds);

    if (updateError) {
      return { error: updateError.message };
    }

    const payment = payments[0];
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const combinedPeriods = Array.from(new Set(payments.map((p) => p.payment_period).filter(Boolean))).join(", ");

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: payment.profile_id || payment.recorded_by,
      action: "payment_confirmed",
      target_type: "payment",
      target_id: payment.id,
      metadata: {
        reference,
        amount: totalAmount,
        count: payments.length,
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
              amount={totalAmount}
              duesType={payment.dues_type}
              period={combinedPeriods || payment.payment_period || ""}
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
        body: `Your payment of ₦${totalAmount.toLocaleString()} (${payments.length > 1 ? `${payments.length} sessions: ${combinedPeriods}` : `${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""})`}) has been confirmed. Ref: ${reference}.`,
        type: "payment_confirmed",
        metadata: { reference, amount: totalAmount, dues_type: payment.dues_type },
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
    const { data: payments, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .or(`payment_reference.eq.${reference},gateway_reference.eq.${reference}`);

    if (findError || !payments || payments.length === 0) {
      return { error: "Payment record not found" };
    }

    const paymentIds = payments.map((p) => p.id);
    const { error } = await adminClient
      .from("payments")
      .update({
        status: "failed",
      })
      .in("id", paymentIds);

    if (error) {
      return { error: error.message };
    }

    const payment = payments[0];
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // In-app notification for the student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Failed ✗",
        body: `Your payment of ₦${totalAmount.toLocaleString()} has failed. Ref: ${reference}.`,
        type: "payment_failed",
        metadata: { reference, amount: totalAmount, dues_type: payment.dues_type, status: "failed" },
      });
    }

    revalidatePath("/dues");
    revalidatePath("/admin/dues");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to mark payment as failed" };
  }
}

export async function getMemberPaymentContext(memberId: string) {
  try {
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, full_name, email, role, academic_level, faculty, department, matric_number")
      .eq("id", memberId)
      .maybeSingle();

    let existingPayments: any[] = [];
    let memberDetails: any = profile;

    if (profile) {
      const { data: payments } = await adminClient
        .from("payments")
        .select("id, dues_type, payment_period, status, amount, payment_reference, payment_date, created_at")
        .eq("profile_id", memberId);
      existingPayments = payments || [];
    } else {
      const { data: legacy } = await adminClient
        .from("legacy_members")
        .select("id, full_name, email, academic_level, matric_number")
        .eq("id", memberId)
        .maybeSingle();
      if (legacy) {
        memberDetails = { ...legacy, role: "student" };
        const { data: payments } = await adminClient
          .from("payments")
          .select("id, dues_type, payment_period, status, amount, payment_reference, payment_date, created_at")
          .eq("legacy_member_id", memberId);
        existingPayments = payments || [];
      }
    }

    if (!memberDetails) {
      return { error: "Member record not found" };
    }

    const currentLevelOrdinal = getLevelOrdinal(memberDetails.academic_level);
    const totalCourseYears = getYearsOfStudy(memberDetails.faculty, memberDetails.department);
    const userIsAlumnus = isAlumnus(memberDetails.role);

    const tracker = !userIsAlumnus
      ? buildPaymentTracker({
          currentLevelOrdinal,
          totalCourseYears,
          existingPayments: existingPayments.map((p) => ({
            id: p.id,
            dues_type: p.dues_type,
            payment_period: p.payment_period,
            status: p.status,
            amount: Number(p.amount),
            payment_reference: p.payment_reference,
            payment_date: p.payment_date,
            created_at: p.created_at,
          })),
          currentSession: CURRENT_SESSION,
        })
      : [];

    return {
      success: true,
      member: memberDetails,
      currentLevelOrdinal,
      totalCourseYears,
      userIsAlumnus,
      tracker,
      existingPayments,
    };
  } catch (err: any) {
    return { error: err?.message || "Failed to fetch member payment details" };
  }
}

export async function recordManualPayment(values: ManualPaymentFormValues, excoId: string) {
  try {
    // Perform strict validation rules for required dues (annual_dues & membership_levy)
    if (isRequiredDuesType(values.dues_type)) {
      const memberContext = await getMemberPaymentContext(values.member_id);
      if (memberContext.error || !memberContext.member || !memberContext.tracker) {
        return { error: memberContext.error || "Member context not found." };
      }

      const { currentLevelOrdinal = 0, userIsAlumnus = false, tracker = [] } = memberContext;

      if (!userIsAlumnus && currentLevelOrdinal > 0) {
        // Determine target year ordinal
        let targetYearOrdinal = 1;
        if (values.dues_type === "membership_levy") {
          targetYearOrdinal = 1;
        } else {
          const matchedSession = tracker.find(
            (s) => (values.payment_period && values.payment_period.startsWith(s.session)) || s.feeType === values.dues_type
          );
          if (matchedSession) {
            targetYearOrdinal = matchedSession.yearOrdinal;
          }
        }

        // Rule 3: Academic level bound check
        if (targetYearOrdinal > currentLevelOrdinal) {
          return {
            error: `Cannot record payment for Year ${targetYearOrdinal}. Student is currently in ${memberContext.member.academic_level || "a lower level"} and has not entered this year yet.`,
          };
        }

        // Find target session in tracker
        const targetSession = tracker.find((s) => s.yearOrdinal === targetYearOrdinal);

        // Rule 1: Already paid check
        if (targetSession?.existingPayment?.status === "confirmed") {
          return {
            error: `Payment for ${targetSession.yearLabel} (${targetSession.session}) has already been paid and confirmed for this student.`,
          };
        }

        // Rule 2: Sequential payment check
        if (targetYearOrdinal > 1) {
          const previousSession = tracker.find((s) => s.yearOrdinal === targetYearOrdinal - 1);
          if (previousSession && previousSession.existingPayment?.status !== "confirmed") {
            return {
              error: `Sequential payment rule: Cannot record payment for ${targetSession?.yearLabel || `Year ${targetYearOrdinal}`} (${targetSession?.session || ""}) because Year ${targetYearOrdinal - 1} (${previousSession.session}) has not been paid yet.`,
            };
          }
        }
      }
    }

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
    revalidatePath("/dashboard");
    revalidatePath("/admin/dues");
    revalidatePath("/admin/members");
    revalidatePath("/dues/history");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to record manual payment" };
  }
}

export interface BatchPaymentItem {
  yearOrdinal: number;
  session: string;
  dues_type: "membership_levy" | "annual_dues" | "special_levy" | "other";
  amount: number;
}

export interface BatchManualPaymentValues {
  member_id: string;
  items: BatchPaymentItem[];
  receipt_number: string;
  payment_date: string;
  notes?: string;
}

/** Record manual payments for multiple academic sessions in a single transaction */
export async function recordBatchManualPayment(
  values: BatchManualPaymentValues,
  excoId: string
) {
  try {
    const supabase = await createClient();
    const { data: excoProfile } = await supabase
      .from("profiles")
      .select("id, role, full_name")
      .eq("id", excoId)
      .single();

    if (!excoProfile || (excoProfile.role !== "super_admin" && excoProfile.role !== "exco")) {
      return { error: "Unauthorized. Exco or Super Admin privileges required." };
    }

    if (!values.items || values.items.length === 0) {
      return { error: "Please select at least one session to record payment." };
    }

    const memberContext = await getMemberPaymentContext(values.member_id);
    if (memberContext.error || !memberContext.member || !memberContext.tracker) {
      return { error: memberContext.error || "Member context not found." };
    }

    const { currentLevelOrdinal = 0, userIsAlumnus = false, tracker = [] } = memberContext;

    if (!userIsAlumnus && currentLevelOrdinal > 0) {
      const sortedItems = [...values.items].sort((a, b) => a.yearOrdinal - b.yearOrdinal);

      for (const item of sortedItems) {
        if (item.yearOrdinal > currentLevelOrdinal) {
          return {
            error: `Cannot record payment for Year ${item.yearOrdinal}. Student is currently in ${memberContext.member.academic_level || "a lower level"} and has not reached this year.`,
          };
        }
        const targetSession = tracker.find((s: any) => s.yearOrdinal === item.yearOrdinal);
        if (targetSession?.existingPayment?.status === "confirmed") {
          return {
            error: `Payment for ${targetSession.yearLabel} (${targetSession.session}) has already been paid and confirmed.`,
          };
        }
      }

      // Sequential continuity check: all years up to max selected year must be confirmed or included
      const maxYear = Math.max(...sortedItems.map((i) => i.yearOrdinal));
      for (let yr = 1; yr <= maxYear; yr++) {
        const alreadyConfirmed = tracker.find((s: any) => s.yearOrdinal === yr)?.existingPayment?.status === "confirmed";
        const includedInBatch = sortedItems.some((i) => i.yearOrdinal === yr);
        if (!alreadyConfirmed && !includedInBatch) {
          return {
            error: `Sequential payment rule: Cannot pay Year ${maxYear} without paying Year ${yr}. Please select all preceding unpaid years.`,
          };
        }
      }
    }

    // Determine target member
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

    const masterBatchRef = `MAN-BATCH-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;
    const baseReceipt = values.receipt_number || `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const insertedPayments: any[] = [];

    for (let idx = 0; idx < values.items.length; idx++) {
      const item = values.items[idx];
      const childRef = `${masterBatchRef}-Y${item.yearOrdinal}`;
      const childReceipt = values.items.length > 1 ? `${baseReceipt}-${idx + 1}` : baseReceipt;

      const { data: payment, error } = await adminClient
        .from("payments")
        .insert({
          profile_id,
          legacy_member_id,
          amount: item.amount,
          dues_type: item.dues_type,
          channel: "manual",
          status: "confirmed",
          payment_period: item.session,
          payment_reference: childRef,
          gateway_reference: masterBatchRef,
          recorded_by: excoId,
          receipt_number: childReceipt,
          payment_date: values.payment_date,
          notes: values.notes || null,
        })
        .select()
        .single();

      if (error) {
        return { error: `Failed to record payment for Year ${item.yearOrdinal}: ${error.message}` };
      }
      insertedPayments.push(payment);
    }

    const totalAmount = values.items.reduce((sum, i) => sum + i.amount, 0);
    const sessionLabels = values.items.map((i) => i.session).join(", ");
    const excoName = excoProfile?.full_name ?? "an Exco member";

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "record_batch_manual_payment",
      target_type: "payment",
      target_id: insertedPayments[0]?.id,
      metadata: {
        member_id: values.member_id,
        total_amount: totalAmount,
        sessions_count: values.items.length,
        batch_reference: masterBatchRef,
      },
    });

    // Dual notifications
    if (profile_id) {
      await createNotification({
        profile_id,
        title: "Batch Dues Payment Recorded ✓",
        body: `Your dues payment of ₦${totalAmount.toLocaleString()} for ${values.items.length} session(s) (${sessionLabels}) was successfully recorded by ${excoName}.`,
        type: "payment_recorded_by_exco",
        metadata: { batch_reference: masterBatchRef, count: values.items.length, amount: totalAmount },
      });

      await createNotification({
        profile_id: excoId,
        title: "Batch Payment Successfully Recorded",
        body: `You successfully recorded dues payment of ₦${totalAmount.toLocaleString()} (${values.items.length} sessions) on behalf of ${fullName}.`,
        type: "payment_recorded_by_exco",
        metadata: { batch_reference: masterBatchRef, student_name: fullName, student_id: profile_id, amount: totalAmount },
      });
    }

    // Send consolidated receipt email
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: `NFCS Payment Receipt: ${masterBatchRef}`,
          react: (
            <DuesReceipt
              fullName={fullName}
              reference={masterBatchRef}
              amount={totalAmount}
              duesType="annual_dues"
              period={sessionLabels}
              datePaid={values.payment_date || new Date().toLocaleDateString()}
            />
          ),
        });
      } catch (emailErr) {
        console.error("Failed to send dues receipt email:", emailErr);
      }
    }

    revalidatePath("/dues");
    revalidatePath("/dashboard");
    revalidatePath("/admin/dues");
    revalidatePath("/admin/members");
    revalidatePath("/dues/history");

    return {
      success: true,
      count: values.items.length,
      totalAmount,
      batchReference: masterBatchRef,
    };
  } catch (err: any) {
    return { error: err?.message || "Failed to record batch manual payment" };
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
    const { data: payments, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .or(`payment_reference.eq.${reference},gateway_reference.eq.${reference}`);

    if (findError || !payments || payments.length === 0) {
      return { error: "Payment record not found" };
    }

    const allConfirmed = payments.every((p) => p.status === "confirmed");
    if (allConfirmed) {
      return { success: true, message: "Payment already confirmed" };
    }

    const paymentIds = payments.map((p) => p.id);
    const { error: updateError } = await adminClient
      .from("payments")
      .update({
        status: "confirmed",
        payment_date: new Date().toISOString().split("T")[0],
        gateway_response: gatewayResponse,
      })
      .in("id", paymentIds);

    if (updateError) {
      return { error: updateError.message };
    }

    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const combinedPeriods = Array.from(new Set(payments.map((p) => p.payment_period).filter(Boolean))).join(", ");
    const payment = payments[0];

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: payment.profile_id || payment.recorded_by,
      action: "payment_confirmed",
      target_type: "payment",
      target_id: payment.id,
      metadata: {
        reference,
        amount: totalAmount,
        count: payments.length,
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
              amount={totalAmount}
              duesType={payment.dues_type}
              period={combinedPeriods || payment.payment_period || ""}
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
        body: `Your online payment of ₦${totalAmount.toLocaleString()} (${payments.length > 1 ? `${payments.length} sessions: ${combinedPeriods}` : `${(payment.dues_type as string)?.replace("_", " ")} (${payment.payment_period ?? ""})`}) has been confirmed. Ref: ${reference}.`,
        type: "payment_confirmed",
        metadata: { reference, amount: totalAmount, dues_type: payment.dues_type, status: "confirmed" },
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
    const { data: payments, error: findError } = await adminClient
      .from("payments")
      .select("*")
      .or(`payment_reference.eq.${reference},gateway_reference.eq.${reference}`);

    if (findError || !payments || payments.length === 0) {
      return { error: "Payment record not found" };
    }

    const paymentIds = payments.map((p) => p.id);
    const { error } = await adminClient
      .from("payments")
      .update({
        status: "failed",
        gateway_response: gatewayResponse,
      })
      .in("id", paymentIds);

    if (error) {
      return { error: error.message };
    }

    const payment = payments[0];
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // In-app notification for the student
    if (payment.profile_id) {
      await createNotification({
        profile_id: payment.profile_id,
        title: "Payment Failed ✗",
        body: `Your online payment of ₦${totalAmount.toLocaleString()} has failed. Ref: ${reference}.`,
        type: "payment_failed",
        metadata: { reference, amount: totalAmount, status: "failed" },
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
