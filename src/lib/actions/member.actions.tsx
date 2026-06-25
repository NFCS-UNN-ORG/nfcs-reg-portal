"use server";

import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import RegistrationConfirmation from "../../../emails/RegistrationConfirmation";
import ApprovalNotification from "../../../emails/ApprovalNotification";
import * as React from "react";

// Helper to upload passport photo
async function uploadPassportPhoto(file: File, userId: string): Promise<string> {
  const ext = file.name.split(".").pop();
  const path = `${userId}/passport.${ext}`;

  const { error } = await adminClient.storage
    .from("passport-photos")
    .upload(path, file, { upsert: true });

  if (error) {
    console.error("Storage upload error:", error);
    throw new Error("Passport photo upload failed");
  }

  // Create signed URL valid for 1 year
  const { data } = await adminClient.storage
    .from("passport-photos")
    .createSignedUrl(path, 365 * 24 * 60 * 60);

  return data?.signedUrl ?? "";
}

export async function registerMember(formData: FormData) {
  try {
    const full_name = formData.get("full_name") as string;
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const matric_number = formData.get("matric_number") as string;
    const phone = formData.get("phone") as string || null;
    const date_of_birth = formData.get("date_of_birth") as string || null;
    const address = formData.get("address") as string || null;
    const faculty = formData.get("faculty") as string || null;
    const department = formData.get("department") as string || null;
    const academic_level = formData.get("academic_level") as string || null;
    const organ = formData.get("organ") as any || null;
    const society = formData.get("society") as string || null;
    const parish = formData.get("parish") as string || null;
    const passportPhotoFile = formData.get("passport_photo") as File | null;

    console.log("[registerMember] called with:", { full_name, email, matric_number });

    if (!full_name || !email || !password || !matric_number) {
      console.log("[registerMember] Missing required fields");
      return { error: "Required fields are missing" };
    }

    // Create Auth User via admin client to bypass email confirmation (avoids SMTP 500 errors)
    console.log("[registerMember] Attempting admin createUser for:", email);
    const { data: authData, error: signupError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
      },
    });

    if (signupError) {
      console.error("[registerMember] admin createUser error:", signupError);
      return { error: signupError.message };
    }

    const userId = authData.user?.id;
    console.log("[registerMember] admin createUser success. userId:", userId);

    if (!userId) {
      console.error("[registerMember] No userId returned from admin createUser");
      return { error: "Failed to retrieve user ID after signup" };
    }

    let passport_photo_url = "";
    if (passportPhotoFile && passportPhotoFile.size > 0) {
      console.log("[registerMember] Uploading passport photo...");
      passport_photo_url = await uploadPassportPhoto(passportPhotoFile, userId);
      console.log("[registerMember] Passport photo uploaded:", passport_photo_url);
    }

    // Update profile using admin client (bypassing RLS)
    console.log("[registerMember] Updating profile for userId:", userId);
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name,
        phone,
        date_of_birth,
        address,
        faculty,
        department,
        matric_number,
        academic_level,
        organ,
        society,
        parish,
        passport_photo_url,
        status: "pending", // Default to pending approval
      })
      .eq("id", userId);

    if (profileError) {
      console.error("[registerMember] Profile update error:", profileError);
      return { error: `Profile update failed: ${profileError.message}` };
    }

    console.log("[registerMember] Profile updated successfully");

    // Write audit log
    const { error: auditError } = await adminClient.from("audit_log").insert({
      action: "self_registration",
      target_type: "profile",
      target_id: userId,
      metadata: {
        email,
        full_name,
        matric_number,
      },
    });
    if (auditError) {
      console.warn("[registerMember] Audit log insert failed (non-fatal):", auditError);
    }

    // Send RegistrationConfirmation email
    try {
      await sendEmail({
        to: email,
        subject: "NFCS Portal Registration Submitted",
        react: <RegistrationConfirmation fullName={full_name} matricNumber={matric_number} />,
      });
    } catch (emailErr) {
      console.error("Failed to send registration confirmation email:", emailErr);
    }

    console.log("[registerMember] Registration complete for:", email);
    return { success: true };
  } catch (err: any) {
    console.error("[registerMember] Unexpected error:", err);
    return { error: err?.message || "An error occurred during profile registration." };
  }
}

export async function approveMember(memberId: string, excoId: string) {
  const { data: member, error } = await adminClient
    .from("profiles")
    .update({
      status: "active",
      approved_by: excoId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .select("email, full_name")
    .single();

  if (error || !member) {
    return { error: error?.message || "Failed to approve member status" };
  }

  await adminClient.from("audit_log").insert({
    actor_id: excoId,
    action: "approve_member",
    target_type: "profile",
    target_id: memberId,
  });

  // Send ApprovalNotification email
  try {
    if (member.email) {
      await sendEmail({
        to: member.email,
        subject: "NFCS Portal Activated",
        react: <ApprovalNotification fullName={member.full_name} status="active" />,
      });
    }
  } catch (emailErr) {
    console.error("Failed to send approval confirmation email:", emailErr);
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { success: true };
}

export async function rejectMember(memberId: string, excoId: string) {
  const { data: member, error } = await adminClient
    .from("profiles")
    .update({
      status: "suspended", // Rejected members are suspended
    })
    .eq("id", memberId)
    .select("email, full_name")
    .single();

  if (error || !member) {
    return { error: error?.message || "Failed to reject member status" };
  }

  await adminClient.from("audit_log").insert({
    actor_id: excoId,
    action: "reject_member",
    target_type: "profile",
    target_id: memberId,
  });

  // Send ApprovalNotification email with status="suspended"
  try {
    if (member.email) {
      await sendEmail({
        to: member.email,
        subject: "NFCS Account Update",
        react: <ApprovalNotification fullName={member.full_name} status="suspended" />,
      });
    }
  } catch (emailErr) {
    console.error("Failed to send rejection confirmation email:", emailErr);
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { success: true };
}

export async function suspendMember(memberId: string, excoId: string) {
  const { data: member, error } = await adminClient
    .from("profiles")
    .update({
      status: "suspended",
    })
    .eq("id", memberId)
    .select("email, full_name")
    .single();

  if (error || !member) {
    return { error: error?.message || "Failed to suspend member status" };
  }

  await adminClient.from("audit_log").insert({
    actor_id: excoId,
    action: "suspend_member",
    target_type: "profile",
    target_id: memberId,
  });

  // Send ApprovalNotification email with status="suspended"
  try {
    if (member.email) {
      await sendEmail({
        to: member.email,
        subject: "NFCS Account Update",
        react: <ApprovalNotification fullName={member.full_name} status="suspended" />,
      });
    }
  } catch (emailErr) {
    console.error("Failed to send suspension email:", emailErr);
  }

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { success: true };
}

export async function upgradeMemberToAlumnus(memberId: string, excoId: string) {
  const { error } = await adminClient
    .from("profiles")
    .update({
      role: "alumnus",
      academic_level: "Graduate",
    })
    .eq("id", memberId);

  if (error) {
    return { error: error.message };
  }

  await adminClient.from("audit_log").insert({
    actor_id: excoId,
    action: "upgrade_student_to_alumnus",
    target_type: "profile",
    target_id: memberId,
  });

  revalidatePath("/admin/members");
  revalidatePath(`/admin/members/${memberId}`);
  return { success: true };
}

export async function onsiteRegisterMember(formData: FormData, excoId: string) {
  const full_name = formData.get("full_name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const phone = formData.get("phone") as string;
  const date_of_birth = formData.get("date_of_birth") as string || null;
  const address = formData.get("address") as string || null;
  const faculty = formData.get("faculty") as string;
  const department = formData.get("department") as string;
  const matric_number = formData.get("matric_number") as string;
  const academic_level = formData.get("academic_level") as string;
  const organ = formData.get("organ") as any;
  const society = formData.get("society") as string || null;
  const parish = formData.get("parish") as string || null;
  const passportPhotoFile = formData.get("passport_photo") as File | null;

  if (!full_name || !email || !password || !faculty || !department || !matric_number || !organ) {
    return { error: "Required fields are missing" };
  }

  // Create user via adminClient to bypass email confirm / automatically verify
  const { data: authData, error: signupError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: {
      full_name,
    },
  });

  if (signupError) {
    return { error: signupError.message };
  }

  const userId = authData.user?.id;
  if (!userId) {
    return { error: "Failed to retrieve user ID after admin signup" };
  }

  try {
    let passport_photo_url = "";
    if (passportPhotoFile && passportPhotoFile.size > 0) {
      passport_photo_url = await uploadPassportPhoto(passportPhotoFile, userId);
    }

    // Update profile to be active immediately
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name,
        phone,
        date_of_birth,
        address,
        faculty,
        department,
        matric_number,
        academic_level,
        organ,
        society,
        parish,
        passport_photo_url,
        status: "active", // Active immediately
        approved_by: excoId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (profileError) {
      return { error: `Profile update failed: ${profileError.message}` };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "onsite_registration",
      target_type: "profile",
      target_id: userId,
      metadata: {
        email,
        full_name,
        matric_number,
      },
    });

    // Send ApprovalNotification email
    try {
      await sendEmail({
        to: email,
        subject: "NFCS Portal Activated",
        react: <ApprovalNotification fullName={full_name} status="active" />,
      });
    } catch (emailErr) {
      console.error("Failed to send onsite welcome email:", emailErr);
    }

    revalidatePath("/admin/members");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "An error occurred during onsite registration." };
  }
}

export async function updateMemberRole(
  memberId: string,
  role: "student" | "alumnus" | "exco" | "super_admin",
  excoId: string
) {
  try {
    const updateData: any = { role };
    // When demoting from exco, clear their position
    if (role !== "exco") {
      updateData.position = null;
    }

    const { error } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", memberId);

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "change_member_role",
      target_type: "profile",
      target_id: memberId,
      metadata: {
        new_role: role,
      },
    });

    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${memberId}`);
    revalidatePath("/admin/settings");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to update member role" };
  }
}

export async function updateProfile(formData: FormData, userId: string) {
  try {
    const full_name = formData.get("full_name") as string;
    const phone = formData.get("phone") as string;
    const date_of_birth = formData.get("date_of_birth") as string || null;
    const address = formData.get("address") as string || null;
    const society = formData.get("society") as string || null;
    const parish = formData.get("parish") as string || null;
    const faculty = formData.get("faculty") as string || null;
    const department = formData.get("department") as string || null;
    const academic_level = formData.get("academic_level") as string || null;
    const organ = formData.get("organ") as any || null;
    const passportPhotoFile = formData.get("passport_photo") as File | null;

    if (!full_name) {
      return { error: "Full Name is required" };
    }

    let passport_photo_url: string | undefined = undefined;
    if (passportPhotoFile && passportPhotoFile.size > 0) {
      passport_photo_url = await uploadPassportPhoto(passportPhotoFile, userId);
    }

    const updateData: any = {
      full_name,
      phone,
      date_of_birth,
      address,
      society,
      parish,
      faculty,
      department,
      academic_level,
      organ,
    };

    if (passport_photo_url) {
      updateData.passport_photo_url = passport_photo_url;
    }

    const { error } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (error) {
      return { error: `Profile update failed: ${error.message}` };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: userId,
      action: "update_profile",
      target_type: "profile",
      target_id: userId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/profile");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "An error occurred during profile update." };
  }
}

export async function updateMemberBiodata(formData: FormData, adminId: string, targetMemberId: string) {
  try {
    const full_name = formData.get("full_name") as string;
    const phone = formData.get("phone") as string;
    const date_of_birth = formData.get("date_of_birth") as string || null;
    const address = formData.get("address") as string || null;
    const society = formData.get("society") as string || null;
    const parish = formData.get("parish") as string || null;
    const faculty = formData.get("faculty") as string || null;
    const department = formData.get("department") as string || null;
    const academic_level = formData.get("academic_level") as string || null;
    const matric_number = formData.get("matric_number") as string || null;
    const organ = formData.get("organ") as any || null;
    const position = formData.get("position") as string || null;

    if (!full_name) {
      return { error: "Full Name is required" };
    }

    const updateData: any = {
      full_name,
      phone,
      date_of_birth,
      address,
      society,
      parish,
      faculty,
      department,
      academic_level,
      matric_number,
      organ,
    };

    // Only persist position if provided (exco-specific field)
    if (position !== undefined) {
      updateData.position = position || null;
    }

    const { error } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", targetMemberId);

    if (error) {
      return { error: `Profile update failed: ${error.message}` };
    }

    await adminClient.from("audit_log").insert({
      actor_id: adminId,
      action: "super_admin_update_biodata",
      target_type: "profile",
      target_id: targetMemberId,
    });

    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${targetMemberId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "An error occurred during profile update." };
  }
}

export async function updateExcoPosition(
  memberId: string,
  position: string | null,
  adminId: string
) {
  try {
    // If assigning a position, check uniqueness among active excos (excluding this member)
    if (position) {
      const { data: existing } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .eq("position", position)
        .eq("role", "exco")
        .neq("id", memberId)
        .limit(1);

      if (existing && existing.length > 0) {
        return {
          error: `Position "${position}" is already held by ${existing[0].full_name}. Each position can only be assigned to one exco member.`,
        };
      }
    }

    const { error } = await adminClient
      .from("profiles")
      .update({ position: position || null })
      .eq("id", memberId);

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: adminId,
      action: "update_exco_position",
      target_type: "profile",
      target_id: memberId,
      metadata: { position },
    });

    revalidatePath("/admin/members");
    revalidatePath(`/admin/members/${memberId}`);
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to update exco position" };
  }
}

export async function sendPasswordReset(email: string, adminId: string) {
  try {
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: adminId,
      action: "super_admin_password_reset",
      target_type: "auth",
      metadata: { email },
    });

    return { success: true, link: data.properties?.action_link };
  } catch (err: any) {
    return { error: err?.message || "Failed to generate reset link" };
  }
}
