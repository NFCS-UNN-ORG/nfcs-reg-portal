"use server";

import { adminClient } from "@/lib/supabase/admin";
import type { MigrationFormValues } from "@/lib/validations/migration.schema";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import ClaimAccountInvite from "../../../emails/ClaimAccountInvite";
import { parseMoneyAmount } from "@/lib/utils/money";
import { getAppUrl } from "@/lib/utils/app-url";
import * as React from "react";

// Manual migrate single member
export async function migrateLegacyMember(values: MigrationFormValues, excoId: string) {
  const {
    full_name,
    email,
    phone,
    matric_number,
    faculty,
    department,
    academic_level,
    organ,
    society,
    parish,
    migration_source,
    notes,
    dues_amount_paid,
    dues_period,
  } = values;

  try {
    // 1. Insert into legacy_members
    const { data: legacyData, error: legacyError } = await adminClient
      .from("legacy_members")
      .insert({
        full_name,
        email: email || null,
        phone: phone || null,
        matric_number: matric_number || null,
        faculty: faculty || null,
        department: department || null,
        academic_level: academic_level || null,
        organ: (organ as any) || null,
        society: society || null,
        parish: parish || null,
        migration_source,
        notes: notes || null,
        migrated_by: excoId,
        claim_status: "unclaimed",
        dues_imported: !!dues_amount_paid,
      })
      .select()
      .single();

    if (legacyError) {
      return { error: `Legacy insert failed: ${legacyError.message}` };
    }

    // 2. If dues exist, insert into payments
    if (dues_amount_paid && legacyData) {
      const amount = parseMoneyAmount(dues_amount_paid);
      if (Number.isFinite(amount) && amount > 0) {
        const { error: paymentError } = await adminClient.from("payments").insert({
          legacy_member_id: legacyData.id,
          profile_id: null,
          amount,
          dues_type: "annual_dues",
          channel: "manual",
          status: "confirmed",
          payment_period: dues_period || `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
          payment_reference: `LEGACY-MIG-${legacyData.id.substring(0, 8).toUpperCase()}`,
          recorded_by: excoId,
          notes: "Imported historical dues during manual migration",
          payment_date: new Date().toISOString().split("T")[0],
        });

        if (paymentError) {
          console.error("Dues import failed:", paymentError.message);
        }
      }
    }

    // 3. Audit log
    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "migrate_legacy_member",
      target_type: "legacy_member",
      target_id: legacyData.id,
      metadata: {
        full_name,
        matric_number,
        migration_source,
      },
    });

    revalidatePath("/admin/members");
    return { success: true, id: legacyData.id };
  } catch (err: any) {
    return { error: err?.message || "An error occurred during manual migration" };
  }
}

// Bulk migration
export async function bulkMigrateLegacyMembers(rows: any[], excoId: string) {
  try {
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      const { data: legacyData, error: legacyError } = await adminClient
        .from("legacy_members")
        .insert({
          full_name: row.full_name || "Unknown Member",
          email: row.email || null,
          phone: row.phone || null,
          matric_number: row.matric_number || null,
          faculty: row.faculty || null,
          department: row.department || null,
          academic_level: row.academic_level || null,
          organ: row.organ || null,
          society: row.society || null,
          parish: row.parish || null,
          migration_source: row.migration_source || "csv_import",
          notes: row.notes || null,
          migrated_by: excoId,
          claim_status: "unclaimed",
          dues_imported: !!row.dues_amount_paid,
        })
        .select()
        .single();

      if (legacyError) {
        failCount++;
        errors.push(`Row ${i + 1}: ${legacyError.message}`);
        continue;
      }

      successCount++;

      // Dues record
      if (row.dues_amount_paid && legacyData) {
        const amount = parseMoneyAmount(row.dues_amount_paid);
        if (Number.isFinite(amount) && amount > 0) {
          await adminClient.from("payments").insert({
            legacy_member_id: legacyData.id,
            profile_id: null,
            amount,
            dues_type: "annual_dues",
            channel: "manual",
            status: "confirmed",
            payment_period: row.dues_period || "2024/2025",
            payment_reference: `LEGACY-BULK-${legacyData.id.substring(0, 8).toUpperCase()}-${i}`,
            recorded_by: excoId,
            notes: "Imported historical dues during bulk migration",
            payment_date: new Date().toISOString().split("T")[0],
          });
        }
      }
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "bulk_migrate_members",
      target_type: "legacy_member",
      metadata: {
        total_rows: rows.length,
        success_count: successCount,
        fail_count: failCount,
      },
    });

    revalidatePath("/admin/members");
    return { success: true, successCount, failCount, errors };
  } catch (err: any) {
    return { error: err?.message || "An error occurred during bulk migration" };
  }
}

// Generate token & set claim status to invited
export async function sendClaimInvite(legacyMemberId: string, excoId: string) {
  const claim_token = crypto.randomUUID();
  const claim_token_expires = new Date();
  claim_token_expires.setDate(claim_token_expires.getDate() + 7); // 7 days expiry

  try {
    const { data: legacy, error } = await adminClient
      .from("legacy_members")
      .update({
        claim_token,
        claim_token_expires: claim_token_expires.toISOString(),
        claim_status: "invited",
      })
      .eq("id", legacyMemberId)
      .select()
      .single();

    if (error || !legacy) {
      return { error: error?.message || "Failed to update legacy record" };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "send_claim_invite",
      target_type: "legacy_member",
      target_id: legacyMemberId,
      metadata: {
        email: legacy.email,
        claim_token,
      },
    });

    // Return the claim URL so we can log it or display it (mock email fallback)
    const appUrl = getAppUrl();
    const claimUrl = `${appUrl}/claim-account?token=${claim_token}`;

    // Send ClaimAccountInvite email
    try {
      if (legacy.email) {
        await sendEmail({
          to: legacy.email,
          subject: "Claim Your NFCS UNN Portal Account",
          react: (
            <ClaimAccountInvite
              fullName={legacy.full_name}
              claimUrl={claimUrl}
            />
          ),
        });
      }
    } catch (emailErr) {
      console.error("Failed to send claim invite email:", emailErr);
    }

    return { success: true, claimUrl };
  } catch (err: any) {
    return { error: err?.message || "Failed to create invite token" };
  }
}

// Claim account using token
export async function claimLegacyAccount(token: string, email: string, password: string) {
  try {
    // 1. Find legacy member
    const { data: legacy, error: findError } = await adminClient
      .from("legacy_members")
      .select("*")
      .eq("claim_token", token)
      .single();

    if (findError || !legacy) {
      return { error: "Invalid claim token. Please contact an Exco member." };
    }

    // Check expiry
    const expiry = new Date(legacy.claim_token_expires || "");
    if (expiry < new Date()) {
      return { error: "Claim token has expired. Please request a new invite link." };
    }

    // 2. Create Auth User
    const { data: authData, error: signupError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: legacy.full_name,
      },
    });

    if (signupError) {
      return { error: signupError.message };
    }

    const userId = authData.user?.id;
    if (!userId) {
      return { error: "Failed to retrieve user ID after claim registration" };
    }

    // 3. Update Profiles table (insert values into the trigger-created row)
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name: legacy.full_name,
        phone: legacy.phone,
        date_of_birth: legacy.date_of_birth,
        address: legacy.address,
        faculty: legacy.faculty,
        department: legacy.department,
        matric_number: legacy.matric_number,
        academic_level: legacy.academic_level,
        organ: legacy.organ,
        society: legacy.society,
        parish: legacy.parish,
        is_legacy: true,
        legacy_id: legacy.id,
        claimed_at: new Date().toISOString(),
        status: "active", // Claimed members are immediately active (pre-approved)
      })
      .eq("id", userId);

    if (profileError) {
      return { error: `Failed to link profile: ${profileError.message}` };
    }

    // 4. Link payments to new profile
    const { error: paymentsError } = await adminClient
      .from("payments")
      .update({
        profile_id: userId,
      })
      .eq("legacy_member_id", legacy.id);

    if (paymentsError) {
      console.error("Failed to link legacy payments:", paymentsError.message);
    }

    // 5. Update legacy claim status
    await adminClient
      .from("legacy_members")
      .update({
        claim_status: "claimed",
        claimed_by_profile: userId,
      })
      .eq("id", legacy.id);

    // 6. Write audit log
    await adminClient.from("audit_log").insert({
      action: "claim_legacy_account",
      target_type: "profile",
      target_id: userId,
      metadata: {
        legacy_id: legacy.id,
        email,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "An error occurred during account claiming." };
  }
}

export async function revokeLegacyInvite(id: string, excoId: string) {
  try {
    const { data: legacy, error: getError } = await adminClient
      .from("legacy_members")
      .select("full_name")
      .eq("id", id)
      .single();

    if (getError || !legacy) {
      return { error: "Legacy member not found" };
    }

    const { error } = await adminClient
      .from("legacy_members")
      .update({
        claim_status: "unclaimed",
        claim_token: null,
        claim_token_expires: null,
      })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "revoke_legacy_invite",
      target_type: "legacy_member",
      target_id: id,
      metadata: { name: legacy.full_name },
    });

    revalidatePath("/admin/members");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to revoke invite" };
  }
}

export async function deleteLegacyMember(id: string, excoId: string) {
  try {
    // Verify the caller is a super_admin
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", excoId)
      .single();

    if (!callerProfile || callerProfile.role !== "super_admin") {
      return { error: "Unauthorized. Only Super Admins can delete legacy member records." };
    }

    const { data: legacy, error: getError } = await adminClient
      .from("legacy_members")
      .select("full_name, claim_status")
      .eq("id", id)
      .single();

    if (getError || !legacy) {
      return { error: "Legacy member not found" };
    }

    if (legacy.claim_status === "claimed") {
      return { error: "Cannot delete a legacy member whose account is already claimed." };
    }

    // Delete associated payments first to avoid FK constraint errors
    await adminClient.from("payments").delete().eq("legacy_member_id", id);

    // Delete the legacy member
    const { error } = await adminClient
      .from("legacy_members")
      .delete()
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "delete_legacy_member",
      target_type: "legacy_member",
      target_id: id,
      metadata: { name: legacy.full_name },
    });

    revalidatePath("/admin/members");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to delete legacy member" };
  }
}

export async function updateLegacyMember(id: string, values: Partial<MigrationFormValues>, excoId: string) {
  try {
    const { data: legacy, error: getError } = await adminClient
      .from("legacy_members")
      .select("full_name, claim_status")
      .eq("id", id)
      .single();

    if (getError || !legacy) {
      return { error: "Legacy member not found" };
    }

    if (legacy.claim_status === "claimed") {
      return { error: "Cannot edit a legacy member whose account is already claimed." };
    }

    const { error } = await adminClient
      .from("legacy_members")
      .update({
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null,
        matric_number: values.matric_number || null,
        faculty: values.faculty || null,
        department: values.department || null,
        academic_level: values.academic_level || null,
        organ: (values.organ as any) || null,
        society: values.society || null,
        parish: values.parish || null,
        notes: values.notes || null,
      })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "update_legacy_member",
      target_type: "legacy_member",
      target_id: id,
      metadata: { name: values.full_name },
    });

    revalidatePath("/admin/members");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to update legacy member" };
  }
}
