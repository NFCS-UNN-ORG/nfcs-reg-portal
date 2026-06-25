import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Megaphone, Trash2, Calendar, Info, Clock } from "lucide-react";
import { deleteAnnouncement } from "@/lib/actions/announcement.actions";
import Link from "next/link";
import { redirect } from "next/navigation";

// Note card styles from DESIGN.json
const cardColorStyles = [
  {
    bg: "bg-noteCards-green",
    title: "text-noteCards-greenText",
    body: "text-noteCards-greenSubtext",
    meta: "text-noteCards-greenMeta",
  },
  {
    bg: "bg-noteCards-purple",
    title: "text-noteCards-purpleText",
    body: "text-noteCards-purpleSubtext",
    meta: "text-noteCards-purpleMeta",
  },
  {
    bg: "bg-noteCards-amber",
    title: "text-noteCards-amberText",
    body: "text-noteCards-amberSubtext",
    meta: "text-noteCards-amberMeta",
  },
  {
    bg: "bg-noteCards-blue",
    title: "text-noteCards-blueText",
    body: "text-noteCards-blueText",
    meta: "text-[#2563EB]",
  },
];

function AnnouncementCard({
  ann,
  idx,
  isExco,
  isPast,
  handleDelete,
}: {
  ann: any;
  idx: number;
  isExco: boolean;
  isPast?: boolean;
  handleDelete: (id: string) => Promise<void>;
}) {
  const style = cardColorStyles[idx % cardColorStyles.length];
  const dateStr = new Date(ann.created_at || "").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const eventDateStr = ann.event_date
    ? new Date(ann.event_date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div
      className={`rounded-[12px] p-5 flex flex-col justify-between border-none shadow-none text-left h-full ${style.bg} ${isPast ? "opacity-60" : ""}`}
    >
      <div className="space-y-2">
        {/* Meta headers */}
        <div className="flex justify-between items-start gap-2">
          <h4 className={`text-[14px] font-bold ${style.title}`}>{ann.title}</h4>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {ann.organ && (
              <Badge variant="inactive" className="bg-white/40 border-none select-none text-[10px] text-text-primary">
                {ann.organ.replace("_", " ")}
              </Badge>
            )}
            {isPast && (
              <span className="text-[9px] font-bold uppercase tracking-wider bg-black/10 text-text-secondary px-1.5 py-0.5 rounded-full">
                Past
              </span>
            )}
          </div>
        </div>
        {/* Message body */}
        <p className={`text-[12px] leading-relaxed whitespace-pre-line ${style.body}`}>
          {ann.body}
        </p>
      </div>

      <div className="flex justify-between items-center mt-6 border-t border-black/5 pt-3">
        <div className={`text-[11px] font-semibold flex flex-col gap-0.5 ${style.meta}`}>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" /> Posted: {dateStr}
          </span>
          {eventDateStr && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> Event: {eventDateStr}
            </span>
          )}
        </div>

        {isExco && (
          <form action={handleDelete.bind(null, ann.id)}>
            <button
              type="submit"
              className="p-1 rounded-full text-danger hover:bg-black/5 transition-colors border-none bg-transparent"
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className="sr-only">Delete</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default async function AnnouncementsListPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isExco = ["exco", "super_admin"].includes(profile?.role || "student");

  // Fetch announcements
  const { data: announcements, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  // Action wrapper for delete
  const handleDeleteAnnouncement = async (id: string) => {
    "use server";
    await deleteAnnouncement(id, user.id);
  };

  // Split into active/past based on event_date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeAnnouncements = (announcements || []).filter((ann) => {
    if (!ann.event_date) return true; // no event date → always active
    return new Date(ann.event_date) >= today;
  });

  const pastAnnouncements = (announcements || []).filter((ann) => {
    if (!ann.event_date) return false;
    return new Date(ann.event_date) < today;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 select-none">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            Announcements &amp; Bulletins
          </h1>
          <p className="text-xs text-text-secondary">
            Stay updated with notifications and publications from Chapter Exco.
          </p>
        </div>

        {isExco && (
          <Button asChild variant="primary" className="sm:self-end">
            <Link href="/admin/announcements/create" className="gap-2">
              <Plus className="h-4 w-4" /> Compose Announcement
            </Link>
          </Button>
        )}
      </div>

      {/* Error State */}
      {error ? (
        <div className="text-center py-10 bg-white rounded-[12px] border border-neutrals-borderLight">
          <Info className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
          <h3 className="text-sm font-bold text-text-primary">Failed to load bulletins</h3>
          <p className="text-xs text-text-secondary mt-1">{error.message}</p>
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-[12px] border border-neutrals-borderLight shadow-card">
          <Megaphone className="mx-auto h-10 w-10 text-text-tertiary mb-3" />
          <h3 className="text-sm font-bold text-text-primary">No bulletins posted</h3>
          <p className="text-xs text-text-secondary mt-1">
            We will post chapter announcements and bulletins here. Check back soon.
          </p>
        </div>
      ) : (
        <>
          {/* Active / Upcoming Announcements */}
          {activeAnnouncements.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-brand-accent shrink-0" />
                <h2 className="text-sm font-bold text-text-primary">Active Announcements</h2>
                <span className="text-xs text-text-tertiary">({activeAnnouncements.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {activeAnnouncements.map((ann, idx) => (
                  <AnnouncementCard
                    key={ann.id}
                    ann={ann}
                    idx={idx}
                    isExco={isExco}
                    isPast={false}
                    handleDelete={handleDeleteAnnouncement}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Past Announcements */}
          {pastAnnouncements.length > 0 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-text-tertiary shrink-0" />
                <h2 className="text-sm font-bold text-text-secondary">Past Announcements</h2>
                <span className="text-xs text-text-tertiary">({pastAnnouncements.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {pastAnnouncements.map((ann, idx) => (
                  <AnnouncementCard
                    key={ann.id}
                    ann={ann}
                    idx={idx + activeAnnouncements.length}
                    isExco={isExco}
                    isPast={true}
                    handleDelete={handleDeleteAnnouncement}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
