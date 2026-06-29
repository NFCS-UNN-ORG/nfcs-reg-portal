"use server";

import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import RegistrationConfirmation from "../../../emails/RegistrationConfirmation";
import ApprovalNotification from "../../../emails/ApprovalNotification";
import * as React from "react";
import { createNotification } from "@/lib/actions/notification.actions";
import { getYearsOfStudy } from "@/lib/utils/unn-data";

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

    // In-app notification for the newly registered student
    await createNotification({
      profile_id: userId,
      title: "Registration Pending Approval ⏳",
      body: "Thank you for completing your profile! Your registration has been submitted for review. An Exco member will verify your details and activate your account within the next 24 hours.",
      type: "general",
    });

    // Notify all Excos and Super Admins
    try {
      const { data: admins } = await adminClient
        .from("profiles")
        .select("id")
        .in("role", ["exco", "super_admin"]);

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await createNotification({
            profile_id: admin.id,
            title: "New Registration Awaiting Review 👤",
            body: `A new student, ${full_name} (${matric_number}), has completed their profile details and is awaiting your approval.`,
            type: "general",
            metadata: { member_id: userId },
          });
        }
      }
    } catch (adminNotifErr) {
      console.error("Failed to notify admins of new registration:", adminNotifErr);
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

  // In-app notification
  await createNotification({
    profile_id: memberId,
    title: "Account Approved ✓",
    body: "Your NFCS UNN account has been verified and activated. Welcome to the federation!",
    type: "account_approved",
    metadata: { approved_by: excoId },
  });

  // Fetch exco name and notify other admins/excos
  try {
    const { data: excoProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", excoId)
      .single();
    const excoName = excoProfile?.full_name || "an Exco member";

    const { data: otherAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .in("role", ["exco", "super_admin"])
      .neq("id", excoId);

    if (otherAdmins && otherAdmins.length > 0) {
      for (const admin of otherAdmins) {
        await createNotification({
          profile_id: admin.id,
          title: "Member Approved ✓",
          body: `${member.full_name} was approved by ${excoName}.`,
          type: "general",
          metadata: { member_id: memberId, approved_by: excoId },
        });
      }
    }
  } catch (notifErr) {
    console.error("Failed to notify other admins of member approval:", notifErr);
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

  // In-app notification
  await createNotification({
    profile_id: memberId,
    title: "Registration Not Approved",
    body: "Your NFCS UNN account registration was not approved at this time. Please contact an Exco member for assistance.",
    type: "account_rejected",
    metadata: { rejected_by: excoId },
  });

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

  // In-app notification
  await createNotification({
    profile_id: memberId,
    title: "Account Suspended",
    body: "Your NFCS UNN account has been suspended. Please contact an Exco member for more information.",
    type: "account_suspended",
    metadata: { suspended_by: excoId },
  });

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

  // In-app notification
  await createNotification({
    profile_id: memberId,
    title: "Account Upgraded to Alumnus 🎓",
    body: "Congratulations! Your account has been upgraded to Alumnus status. You remain part of the NFCS UNN family.",
    type: "role_changed",
    metadata: { new_role: "alumnus", changed_by: excoId },
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
    if (role !== "exco") updateData.position = null;

    // Fetch member name for the notification
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", memberId)
      .single();

    const { error } = await adminClient
      .from("profiles")
      .update(updateData)
      .eq("id", memberId);

    if (error) return { error: error.message };

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "change_member_role",
      target_type: "profile",
      target_id: memberId,
      metadata: { new_role: role },
    });

    const roleLabels: Record<string, string> = {
      student: "Student",
      alumnus: "Alumnus",
      exco: "Exco Member",
      super_admin: "Super Administrator",
    };

    // Notify the affected member
    await createNotification({
      profile_id: memberId,
      title: `Role Updated: ${roleLabels[role] ?? role}`,
      body: `Your account role has been updated to ${roleLabels[role] ?? role}. If you have questions, contact an Exco member.`,
      type: "role_changed",
      metadata: { new_role: role, changed_by: excoId },
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
        .eq("position", position as any)
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
      .update({ position: (position as any) || null })
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

export async function bulkApproveMembers(memberIds: string[], excoId: string) {
  try {
    if (!memberIds || memberIds.length === 0) {
      return { error: "No members selected" };
    }

    // Fetch the list of members first to get names/emails for notifications
    const { data: members, error: fetchError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, status")
      .in("id", memberIds);

    if (fetchError || !members) {
      return { error: fetchError?.message || "Failed to fetch members for bulk approval" };
    }

    // Filter to only those that actually need approval (pending status)
    const pendingMembers = members.filter((m) => m.status === "pending");
    if (pendingMembers.length === 0) {
      return { success: true, message: "No pending members to approve in selection", count: 0 };
    }

    const pendingIds = pendingMembers.map((m) => m.id);

    // Perform bulk update in a single query
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        status: "active",
        approved_by: excoId,
        approved_at: new Date().toISOString(),
      })
      .in("id", pendingIds);

    if (updateError) {
      return { error: updateError.message };
    }

    // Create audit logs for each approved member
    const auditLogs = pendingIds.map((id) => ({
      actor_id: excoId,
      action: "approve_member",
      target_type: "profile",
      target_id: id,
    }));
    await adminClient.from("audit_log").insert(auditLogs);

    // Send emails (asynchronously/concurrently without blocking response)
    const emailPromises = pendingMembers.map(async (m) => {
      if (m.email) {
        try {
          await sendEmail({
            to: m.email,
            subject: "NFCS Portal Activated",
            react: <ApprovalNotification fullName={m.full_name} status="active" />,
          });
        } catch (emailErr) {
          console.error(`Failed to send approval email to ${m.email}:`, emailErr);
        }
      }
    });

    // Create in-app notifications for each student
    const studentNotifPromises = pendingIds.map((id) =>
      createNotification({
        profile_id: id,
        title: "Account Approved ✓",
        body: "Your NFCS UNN account has been verified and activated. Welcome to the federation!",
        type: "account_approved",
        metadata: { approved_by: excoId },
      })
    );

    // Fetch exco name and notify other admins/excos
    let excoName = "an Exco member";
    try {
      const { data: excoProfile } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("id", excoId)
        .single();
      if (excoProfile) {
        excoName = excoProfile.full_name;
      }
    } catch (excoErr) {
      console.error("Failed to fetch exco name for bulk approval notifications:", excoErr);
    }

    const { data: otherAdmins } = await adminClient
      .from("profiles")
      .select("id")
      .in("role", ["exco", "super_admin"])
      .neq("id", excoId);

    const adminNotifPromises = [];
    if (otherAdmins && otherAdmins.length > 0) {
      const namesList = pendingMembers.map((m) => m.full_name).join(", ");
      const limitNames = namesList.length > 80 ? `${namesList.substring(0, 77)}...` : namesList;
      const body = `${pendingMembers.length} member(s) (${limitNames}) were approved by ${excoName}.`;

      for (const admin of otherAdmins) {
        adminNotifPromises.push(
          createNotification({
            profile_id: admin.id,
            title: `${pendingMembers.length} Members Approved ✓`,
            body,
            type: "general",
            metadata: { approved_member_ids: pendingIds, approved_by: excoId },
          })
        );
      }
    }

    // Wait for all non-blocking actions to complete/kick off
    await Promise.all([
      ...emailPromises,
      ...studentNotifPromises,
      ...adminNotifPromises,
    ]);

    revalidatePath("/admin/members");
    return { success: true, count: pendingIds.length };
  } catch (err: any) {
    return { error: err?.message || "An unexpected error occurred during bulk approval" };
  }
}

export async function bulkSuspendMembers(memberIds: string[], excoId: string) {
  try {
    if (!memberIds || memberIds.length === 0) {
      return { error: "No members selected" };
    }

    // Fetch members to check status
    const { data: members, error: fetchError } = await adminClient
      .from("profiles")
      .select("id, email, full_name, status")
      .in("id", memberIds);

    if (fetchError || !members) {
      return { error: fetchError?.message || "Failed to fetch members for bulk suspension" };
    }

    // Filter to those that are not already suspended
    const targetMembers = members.filter((m) => m.status !== "suspended");
    if (targetMembers.length === 0) {
      return { success: true, message: "Selected members are already suspended", count: 0 };
    }

    const targetIds = targetMembers.map((m) => m.id);

    // Perform bulk update in a single query
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({
        status: "suspended",
      })
      .in("id", targetIds);

    if (updateError) {
      return { error: updateError.message };
    }

    // Create audit logs
    const auditLogs = targetIds.map((id) => ({
      actor_id: excoId,
      action: "suspend_member",
      target_type: "profile",
      target_id: id,
    }));
    await adminClient.from("audit_log").insert(auditLogs);

    // Send emails
    const emailPromises = targetMembers.map(async (m) => {
      if (m.email) {
        try {
          await sendEmail({
            to: m.email,
            subject: "NFCS Account Update",
            react: <ApprovalNotification fullName={m.full_name} status="suspended" />,
          });
        } catch (emailErr) {
          console.error(`Failed to send suspension email to ${m.email}:`, emailErr);
        }
      }
    });

    // Create in-app notifications
    const notifPromises = targetIds.map((id) =>
      createNotification({
        profile_id: id,
        title: "Account Suspended",
        body: "Your NFCS UNN account has been suspended. Please contact an Exco member for more information.",
        type: "account_suspended",
        metadata: { suspended_by: excoId },
      })
    );

    await Promise.all([...emailPromises, ...notifPromises]);

    revalidatePath("/admin/members");
    return { success: true, count: targetIds.length };
  } catch (err: any) {
    return { error: err?.message || "An unexpected error occurred during bulk suspension" };
  }
}

export async function performSessionRollover(adminId: string) {
  try {
    // 1. Verify caller is super_admin
    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", adminId)
      .single();

    if (!adminProfile || adminProfile.role !== "super_admin") {
      return { error: "Unauthorized. Super Admin privileges required." };
    }

    // 2. Fetch all profiles that are students or excos
    const { data: profiles, error: fetchErr } = await adminClient
      .from("profiles")
      .select("id, full_name, role, academic_level, faculty, department, status")
      .in("role", ["student", "exco"]);

    if (fetchErr || !profiles) {
      return { error: fetchErr?.message || "Failed to fetch student profiles for rollover" };
    }

    let processedCount = 0;
    const notificationsToInsert: any[] = [];
    
    for (const profile of profiles) {
      // Skip if they are already suspended or legacy (only process active/pending students)
      if (profile.status === "suspended") continue;

      const level = profile.academic_level;
      const totalCourseYears = getYearsOfStudy(profile.faculty, profile.department);

      let newLevel = level;
      let newRole = profile.role;

      if (level === "100 Level") {
        newLevel = "200 Level";
      } else if (level === "200 Level") {
        newLevel = "300 Level";
      } else if (level === "300 Level") {
        newLevel = "400 Level";
      } else if (level === "400 Level") {
        if (totalCourseYears > 4) {
          newLevel = "500 Level";
        } else {
          newLevel = "Graduate";
          newRole = "alumnus";
        }
      } else if (level === "500 Level") {
        if (totalCourseYears > 5) {
          newLevel = "600 Level";
        } else {
          newLevel = "Graduate";
          newRole = "alumnus";
        }
      } else if (level === "600 Level") {
        newLevel = "Graduate";
        newRole = "alumnus";
      }

      // If their role was exco, reset to student when they promote
      if (profile.role === "exco") {
        if (newRole !== "alumnus") {
          newRole = "student";
        }
      }

      const updatePayload: any = {
        academic_level: newLevel,
        role: newRole,
        position: null, // Clear exco positions
      };

      const { error: updateErr } = await adminClient
        .from("profiles")
        .update(updatePayload)
        .eq("id", profile.id);

      if (!updateErr) {
        processedCount++;

        if (newRole !== "alumnus") {
          notificationsToInsert.push({
            profile_id: profile.id,
            title: "New Academic Session 🎉",
            body: `Welcome to the new academic session! You have been promoted to ${newLevel}. Let's make this year a successful and blessed one.`,
            type: "general",
            is_read: false,
          });
        } else {
          notificationsToInsert.push({
            profile_id: profile.id,
            title: "Congratulations Graduate! 🎓",
            body: `Congratulations on completing your program duration! Your portal profile has been updated to Alumnus status.`,
            type: "general",
            is_read: false,
          });
        }
      }
    }

    // Insert all notifications in bulk
    if (notificationsToInsert.length > 0) {
      await adminClient.from("notifications").insert(notificationsToInsert);
    }

    // Insert audit log
    await adminClient.from("audit_log").insert({
      actor_id: adminId,
      action: "session_rollover",
      target_type: "system",
      metadata: { processed_count: processedCount },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin/members");
    revalidatePath("/dashboard");
    
    return { success: true, count: processedCount };
  } catch (err: any) {
    return { error: err?.message || "An unexpected error occurred during session rollover" };
  }
}

