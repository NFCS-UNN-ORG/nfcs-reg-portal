"use client";

import * as React from "react";
import { useUser } from "@/hooks/useUser";
import { usePathname } from "next/navigation";
import { isProfileComplete } from "@/lib/utils/unn-data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, UserCog } from "lucide-react";
import Link from "next/link";

/**
 * Indismissible modal that blocks portal usage until the user
 * completes their profile (faculty, department, academic_level, phone, DOB).
 * 
 * Skips rendering on the /profile page itself so the user can actually edit.
 */
export function ProfileGateModal() {
  const { profile, isLoading } = useUser();
  const pathname = usePathname();

  // Don't block the profile page itself — that's where they go to fix it
  const isProfilePage = pathname === "/profile";

  // Determine if the gate should show
  const shouldShow =
    !isLoading &&
    profile &&
    !isProfileComplete(profile) &&
    !isProfilePage;

  if (!shouldShow) return null;

  // Find which fields are missing for a helpful message
  const missing: string[] = [];
  if (!profile.matric_number) missing.push("Matriculation Number");
  if (!profile.faculty) missing.push("Faculty");
  if (!profile.department) missing.push("Department");
  if (!profile.academic_level) missing.push("Academic Level");
  if (!profile.phone) missing.push("Phone Number");
  if (!profile.date_of_birth) missing.push("Date of Birth");


  return (
    <Dialog open modal>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="max-w-[480px]"
      >
        <DialogHeader showClose={false}>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Complete Your Profile
          </DialogTitle>
          <DialogDescription>
            Your profile is missing required information. Please complete it before accessing portal features.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">
              Missing fields:
            </p>
            <ul className="space-y-1">
              {missing.map((field) => (
                <li
                  key={field}
                  className="flex items-center gap-2 text-xs text-amber-700"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  {field}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-text-secondary">
            This information is required for accurate dues calculation and chapter records.
            You will be redirected to the profile page to update these details.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button asChild variant="primary" className="gap-2 w-full font-semibold">
            <Link href="/profile">
              <UserCog className="h-4 w-4" />
              Go to Profile Settings
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
