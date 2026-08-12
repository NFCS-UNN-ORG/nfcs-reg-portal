"use server";

import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Fetch current dues config from DB, or return defaults if not set.
 * The dues_config table should have rows: { key: string, amount: number, label: string }
 */
export async function getDuesConfig() {
  const { data, error } = await adminClient
    .from("dues_config" as any)
    .select("*")
    .order("year_ordinal", { ascending: true });

  if (error || !data || data.length === 0) {
    // Return hardcoded defaults (matches fees.ts)
    return [
      { id: null, year_ordinal: 1, label: "1st Year (Membership Levy)", annual_dues: 250, constitution: 150, cgan: 100, total: 500 },
      { id: null, year_ordinal: 2, label: "2nd Year", annual_dues: 250, constitution: 50, cgan: 100, total: 400 },
      { id: null, year_ordinal: 3, label: "3rd Year", annual_dues: 250, constitution: 50, cgan: 100, total: 400 },
      { id: null, year_ordinal: 4, label: "4th Year (Non-Finalist)", annual_dues: 250, constitution: 50, cgan: 100, total: 400 },
      { id: null, year_ordinal: 5, label: "5th Year", annual_dues: 250, constitution: 50, cgan: 100, total: 400 },
      { id: null, year_ordinal: 6, label: "6th Year (Finalist)", annual_dues: 250, constitution: 50, cgan: 0, total: 300 },
    ];
  }

  return data;
}

export async function saveDuesConfig(
  formData: FormData,
  adminId: string
) {
  const rows: any[] = [];
  
  // Extract year_ordinal entries from form
  const ordinals = [1, 2, 3, 4, 5, 6];
  for (const ord of ordinals) {
    const annual_dues = parseInt(formData.get(`annual_dues_${ord}`) as string || "0", 10);
    const constitution = parseInt(formData.get(`constitution_${ord}`) as string || "0", 10);
    const cgan = parseInt(formData.get(`cgan_${ord}`) as string || "0", 10);
    const label = formData.get(`label_${ord}`) as string;
    rows.push({
      year_ordinal: ord,
      label,
      annual_dues,
      constitution,
      cgan,
      total: annual_dues + constitution + cgan,
    });
  }

  // Upsert by year_ordinal
  const { error } = await adminClient
    .from("dues_config" as any)
    .upsert(rows, { onConflict: "year_ordinal" });

  if (error) {
    return { error: error.message };
  }

  await adminClient.from("audit_log").insert({
    actor_id: adminId,
    action: "update_dues_config",
    target_type: "dues_config",
    metadata: { rows },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/dues");
  return { success: true };
}

export async function getPaymentSettings() {
  try {
    const { data } = await adminClient
      .from("audit_log")
      .select("metadata")
      .eq("action", "update_payment_methods")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.metadata && typeof data.metadata === "object") {
      const meta = data.metadata as Record<string, any>;
      return {
        onlineEnabled: meta.onlineEnabled ?? true,
        activeGateway: (meta.activeGateway as "paystack" | "flutterwave") ||
          (process.env.NEXT_PUBLIC_ACTIVE_PAYMENT_GATEWAY as "paystack" | "flutterwave") ||
          "paystack",
        bankName: meta.bankName || "Access Bank",
        accountName: meta.accountName || "NFCS UNN Chapter",
        accountNumber: meta.accountNumber || "1234567890",
        receiptChannels: meta.receiptChannels || "WhatsApp, Physical Card",
      };
    }
  } catch {
    // Fallback
  }

  return {
    onlineEnabled: true,
    activeGateway: (process.env.NEXT_PUBLIC_ACTIVE_PAYMENT_GATEWAY as "paystack" | "flutterwave") || "paystack",
    bankName: "Access Bank",
    accountName: "NFCS UNN Chapter",
    accountNumber: "1234567890",
    receiptChannels: "WhatsApp, Physical Card",
  };
}

export async function savePaymentMethods(values: any, adminId: string) {
  try {
    await adminClient.from("audit_log").insert({
      actor_id: adminId,
      action: "update_payment_methods",
      target_type: "settings",
      metadata: values,
    });
    revalidatePath("/admin/settings");
    revalidatePath("/dues/pay");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to save payment methods" };
  }
}

export async function saveSecuritySettings(values: any, adminId: string) {
  try {
    await adminClient.from("audit_log").insert({
      actor_id: adminId,
      action: "update_security_settings",
      target_type: "settings",
      metadata: values,
    });
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to save security settings" };
  }
}

export async function saveNotificationSettings(values: any, adminId: string) {
  try {
    await adminClient.from("audit_log").insert({
      actor_id: adminId,
      action: "update_notification_settings",
      target_type: "settings",
      metadata: values,
    });
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to save notification settings" };
  }
}
