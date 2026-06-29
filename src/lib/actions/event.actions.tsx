"use server";

import { adminClient } from "@/lib/supabase/admin";
import type { EventFormValues } from "@/lib/validations/event.schema";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email";
import EventInvitation from "../../../emails/EventInvitation";
import * as React from "react";

export async function createEvent(values: EventFormValues, excoId: string) {
  try {
    const { data: event, error } = await adminClient
      .from("events")
      .insert({
        title: values.title,
        description: values.description || null,
        event_type: values.event_type,
        organ: values.organ ? (values.organ as any) : null,
        location: values.location,
        starts_at: new Date(values.starts_at).toISOString(),
        ends_at: values.ends_at ? new Date(values.ends_at).toISOString() : null,
        is_published: values.is_published,
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
      action: "create_event",
      target_type: "event",
      target_id: event.id,
      metadata: {
        title: values.title,
      },
    });

    // Send EventInvitation if published
    if (values.is_published) {
      try {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("id, email, full_name")
          .eq("status", "active");

        if (profiles && profiles.length > 0) {
          for (const profile of profiles) {
            if (profile.email) {
              await sendEmail({
                to: profile.email,
                subject: `New NFCS Event Invitation: ${values.title}`,
                react: (
                  <EventInvitation
                    title={values.title}
                    location={values.location}
                    startsAt={values.starts_at}
                    description={values.description}
                  />
                ),
              });
            }
          }

          // Insert in-app notifications in bulk
          const notifications = profiles.map((p) => ({
            profile_id: p.id,
            title: "New Event Invitation 📅",
            body: `You've been invited to: ${values.title}. Location: ${values.location || "N/A"}. Starts at: ${new Date(values.starts_at).toLocaleString()}`,
            type: "general",
            is_read: false,
          }));
          await adminClient.from("notifications").insert(notifications);
        }
      } catch (emailErr) {
        console.error("Failed to send event invitations / notifications:", emailErr);
      }
    }

    revalidatePath("/events");
    revalidatePath("/admin/events");
    return { success: true, id: event.id };
  } catch (err: any) {
    return { error: err?.message || "Failed to create event" };
  }
}

export async function publishEvent(eventId: string, excoId: string) {
  try {
    const { data: event, error } = await adminClient
      .from("events")
      .update({
        is_published: true,
      })
      .eq("id", eventId)
      .select("*")
      .single();

    if (error || !event) {
      return { error: error?.message || "Failed to find event" };
    }

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "publish_event",
      target_type: "event",
      target_id: eventId,
    });

    // Send EventInvitation
    try {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name")
        .eq("status", "active");

      if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
          if (profile.email) {
            await sendEmail({
              to: profile.email,
              subject: `New NFCS Event Invitation: ${event.title}`,
              react: (
                <EventInvitation
                  title={event.title}
                  location={event.location || ""}
                  startsAt={event.starts_at}
                  description={event.description}
                />
              ),
            });
          }
        }

        // Insert in-app notifications in bulk
        const notifications = profiles.map((p) => ({
          profile_id: p.id,
          title: "New Event Invitation 📅",
          body: `You've been invited to: ${event.title}. Location: ${event.location || "N/A"}. Starts at: ${new Date(event.starts_at).toLocaleString()}`,
          type: "general",
          is_read: false,
        }));
        await adminClient.from("notifications").insert(notifications);
      }
    } catch (emailErr) {
      console.error("Failed to send event invitations / notifications:", emailErr);
    }

    revalidatePath("/events");
    revalidatePath("/admin/events");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to publish event" };
  }
}

export async function deleteEvent(eventId: string, excoId: string) {
  try {
    const { error } = await adminClient.from("events").delete().eq("id", eventId);

    if (error) {
      return { error: error.message };
    }

    await adminClient.from("audit_log").insert({
      actor_id: excoId,
      action: "delete_event",
      target_type: "event",
      target_id: eventId,
    });

    revalidatePath("/events");
    revalidatePath("/admin/events");
    return { success: true };
  } catch (err: any) {
    return { error: err?.message || "Failed to delete event" };
  }
}
