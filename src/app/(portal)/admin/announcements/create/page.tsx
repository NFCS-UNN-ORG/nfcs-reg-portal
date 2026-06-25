"use client";

import * as React from "react";
import { createAnnouncement } from "@/lib/actions/announcement.actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ChevronLeft, Megaphone, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useUser } from "@/hooks/useUser";
import { ORGANS } from "@/lib/validations/member.schema";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateAnnouncementPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useUser();
  
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await createAnnouncement(formData, profile.id);
      if (result?.error) {
        setError(result.error);
        toast({
          title: "Failed to Publish",
          description: result.error,
          variant: "error",
        });
      } else {
        toast({
          title: "Announcement Published",
          description: "Your announcement is live for members.",
          variant: "success",
        });
        router.push("/announcements");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1 select-none">
        <Link
          href="/announcements"
          className="inline-flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-brand-accent mb-2 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Feed
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Publish Announcement
        </h1>
        <p className="text-xs text-text-secondary">
          Compose notifications and news bulletins for chapter members.
        </p>
      </div>

      {/* Form Card Layout */}
      <Card className="max-w-[720px] mx-auto border border-neutrals-borderLight shadow-card bg-white">
        <CardContent className="p-8">
          <form onSubmit={onSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-status-errorBackground p-3 text-xs font-semibold text-status-errorText border border-status-errorBorder">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Announcement Title</label>
              <Input name="title" required placeholder="Gospel Band Music Rehearsal Shift" disabled={isLoading} />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Scope Organ (Optional)</label>
              <Select name="organ" disabled={isLoading}>
                <option value="">All Chapter Members</option>
                {ORGANS.map((o) => (
                  <option key={o} value={o}>
                    {o.replace("_", " ").toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Event / Expiry Date <span className="text-text-tertiary font-normal">— optional</span>
              </label>
              <input
                name="event_date"
                type="date"
                disabled={isLoading}
                className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[13px] text-text-primary focus:border-brand-accent focus:outline-none transition-all"
              />
              <p className="text-[10px] text-text-tertiary">
                After this date, the announcement will move to &quot;Past Announcements&quot; in the feed.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Message Content</label>
              <textarea
                name="body"
                required
                rows={6}
                placeholder="Type your announcement bulletin content here..."
                disabled={isLoading}
                className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-text-primary focus:border-brand-accent focus:outline-none focus:shadow-inputFocus transition-all"
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-neutrals-borderLight">
              <Button type="submit" variant="primary" className="px-6 h-10 text-xs font-semibold gap-2" isLoading={isLoading}>
                <Megaphone className="h-4 w-4" /> Publish Announcement
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
