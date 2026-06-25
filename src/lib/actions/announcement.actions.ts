"use server";

import { adminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createAnnouncement(formData: FormData, excoId: string) {
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;
  const organ = formData.get("organ") as string || null;
  const event_date = formData.get("event_date") as string || null;

  if (!title || !body) {
    return { error: "Title and message content are required" };
  }

  try {
    const { data: announcement, error } = await adminClient
      .from("announcements")
      .insert({
        title,
        body,
        organ: organ ? (organ as any) : null,
        event_date: event_date || null,
        is_published: true,
        published_at: new Date().toISOString(),
        created_by: excoId,
      })
      .select()
      .single();

    if (error) {
      return { error: error.message };
    }

    // Write audit log
    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "create_announcement",
      target_type: "announcement",
      target_id: announcement.id,
      metadata: {
        title,
      },
    });

    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return { success: true, id: announcement.id };
  } catch (err: any) {
    return { error: err?.message || "Failed to create announcement" };
  }
}

export async function deleteAnnouncement(announcementId: string, excoId: string) {
  try {
    const { error } = await adminClient
      .from("announcements")
      .delete()
      .eq("id", announcementId);

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "delete_announcement",
      target_type: "announcement",
      target_id: announcementId,
    });

    revalidatePath("/announcements");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to delete announcement" };
  }
}
