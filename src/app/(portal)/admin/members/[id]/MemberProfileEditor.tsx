"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateMemberBiodata, sendPasswordReset, updateExcoPosition } from "@/lib/actions/member.actions";
import { useToast } from "@/components/ui/toast";
import { UNN_CAMPUS_DATA, EXCO_POSITIONS, NFCS_SOCIETIES } from "@/lib/utils/unn-data";
import { ORGANS } from "@/lib/validations/member.schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Award, Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function MemberProfileEditor({ member, adminId }: { member: any; adminId: string }) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [positionLoading, setPositionLoading] = React.useState(false);

  // Faculty & Department State
  const [selectedFaculty, setSelectedFaculty] = React.useState(member.faculty || "");
  const [selectedDepartment, setSelectedDepartment] = React.useState(member.department || "");
  const [selectedPosition, setSelectedPosition] = React.useState(member.position || "");

  // Multiple selection states for Organ and Society
  const [selectedOrgans, setSelectedOrgans] = React.useState<string[]>(
    member.organ ? member.organ.split(",").map((s: string) => s.trim()).filter(Boolean) : []
  );
  const [selectedSocieties, setSelectedSocieties] = React.useState<string[]>(
    member.society ? member.society.split(",").map((s: string) => s.trim()).filter(Boolean) : []
  );
  const [societySearch, setSocietySearch] = React.useState("");

  const toggleOrgan = (o: string) => {
    setSelectedOrgans((prev) =>
      prev.includes(o) ? prev.filter((item) => item !== o) : [...prev, o]
    );
  };

  const toggleSociety = (soc: string) => {
    setSelectedSocieties((prev) =>
      prev.includes(soc) ? prev.filter((item) => item !== soc) : [...prev, soc]
    );
  };

  const filteredSocieties = React.useMemo(() => {
    const list = Array.from(new Set([...selectedSocieties, ...NFCS_SOCIETIES]));
    if (!societySearch.trim()) return list;
    return list.filter((s) => s.toLowerCase().includes(societySearch.toLowerCase()));
  }, [selectedSocieties, societySearch]);

  const faculties = Object.keys(UNN_CAMPUS_DATA);
  const departments: string[] = selectedFaculty ? (UNN_CAMPUS_DATA[selectedFaculty] || []) : [];

  const isExcoRole = member.role === "exco" || member.role === "super_admin";

  const handleFacultyChange = (val: string) => {
    setSelectedFaculty(val);
    setSelectedDepartment(""); // reset department when faculty changes
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.set("faculty", selectedFaculty);
    formData.set("department", selectedDepartment);
    formData.delete("organ");
    formData.delete("society");
    if (selectedOrgans.length > 0) {
      formData.set("organ", selectedOrgans.join(", "));
    }
    if (selectedSocieties.length > 0) {
      formData.set("society", selectedSocieties.join(", "));
    }
    if (isExcoRole) {
      formData.set("position", selectedPosition);
    }

    const result = await updateMemberBiodata(formData, adminId, member.id);
    setLoading(false);

    if (result.error) {
      toast({ title: "Update Failed", description: result.error, variant: "error" });
    } else {
      toast({ title: "Biodata Updated", description: "Member profile updated successfully!", variant: "success" });
      setIsEditing(false);
    }
  };

  const handlePositionSave = async () => {
    setPositionLoading(true);
    const result = await updateExcoPosition(member.id, selectedPosition || null, adminId);
    setPositionLoading(false);
    if (result.error) {
      toast({ title: "Position Update Failed", description: result.error, variant: "error" });
    } else {
      toast({ title: "Position Updated", description: "Exco position assigned successfully.", variant: "success" });
    }
  };

  const handlePasswordReset = async () => {
    if (!confirm(`Are you sure you want to send a password reset link to ${member.email}?`)) return;
    const result = await sendPasswordReset(member.email, adminId);
    if (result.error) {
      toast({ title: "Reset Failed", description: result.error, variant: "error" });
    } else {
      toast({ title: "Password Reset Link", description: "Link generated successfully.", variant: "success" });
      if (result.link) {
        navigator.clipboard?.writeText(result.link);
        toast({ title: "Copied!", description: "Reset link copied to clipboard.", variant: "success" });
      }
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-white dark:bg-prussian-blue-2 p-4 rounded-[12px] border border-neutrals-borderLight shadow-sm">
          <p className="text-sm font-semibold">Super Admin Controls</p>
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing(true)} variant="secondary" size="sm">
              Edit Biodata
            </Button>
            <Button onClick={handlePasswordReset} variant="ghost" size="sm">
              Reset Password
            </Button>
          </div>
        </div>

        {/* Exco Position Card — only for exco/super_admin */}
        {isExcoRole && (
          <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-4 w-4 text-brand-accent" />
                Exco Position
              </CardTitle>
              <CardDescription>Chapter executive position assignment</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0 space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-semibold text-text-primary">Assigned Position</label>
                  <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select position..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— No Position —</SelectItem>
                      {EXCO_POSITIONS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-text-tertiary">
                    Each position can only be held by one exco at a time.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handlePositionSave}
                  disabled={positionLoading}
                  className="shrink-0"
                >
                  {positionLoading ? "Saving..." : "Assign"}
                </Button>
              </div>
              {member.position && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-brand-light border border-brand-border text-xs text-brand-accent font-semibold">
                  <Award className="h-3.5 w-3.5 shrink-0" />
                  Currently: {member.position}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Academic Profile */}
        <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
          <CardHeader>
            <CardTitle>Academic Profile</CardTitle>
            <CardDescription>University details</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">Faculty</span>
              <p className="text-sm font-medium text-text-primary">{member.faculty || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">Department</span>
              <p className="text-sm font-medium text-text-primary">{member.department || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">Matric Number</span>
              <p className="text-sm font-mono text-text-primary">{member.matric_number || "—"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">Academic Level</span>
              <p className="text-sm font-medium text-text-primary">{member.academic_level || "—"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Catholic & Organ Profile */}
        <Card className="border border-neutrals-borderLight shadow-card bg-white dark:bg-prussian-blue-2">
          <CardHeader>
            <CardTitle>NFCS Organ &amp; Parish details</CardTitle>
            <CardDescription>Communal details</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">Assigned Organ(s)</span>
              <p className="text-sm font-medium text-text-primary capitalize">
                {member.organ
                  ? member.organ
                      .split(",")
                      .map((o: string) => o.trim().replace(/_/g, " "))
                      .join(", ")
                  : "Not assigned"}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">Society / Association</span>
              <p className="text-sm font-medium text-text-primary">{member.society || "None listed"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-text-tertiary uppercase font-semibold">Home Parish</span>
              <p className="text-sm font-medium text-text-primary">{member.parish || "None listed"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className="border border-brand shadow-card bg-white dark:bg-prussian-blue-2">
      <form onSubmit={handleSave}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="space-y-1">
            <CardTitle>Edit Member Biodata</CardTitle>
            <CardDescription>Super Admin Mode</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={() => setIsEditing(false)} variant="ghost" size="sm" disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Full Name</label>
              <Input name="full_name" defaultValue={member.full_name} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Phone Number</label>
              <Input name="phone" defaultValue={member.phone || ""} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Date of Birth</label>
              <Input name="date_of_birth" type="date" defaultValue={member.date_of_birth || ""} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Address</label>
              <Input name="address" defaultValue={member.address || ""} />
            </div>

            {/* Faculty & Department using UNN_CAMPUS_DATA */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Faculty</label>
              <Select value={selectedFaculty} onValueChange={handleFacultyChange} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculties.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Department</label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment} required disabled={!selectedFaculty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Matric Number</label>
              <Input name="matric_number" defaultValue={member.matric_number || ""} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Academic Level</label>
              <Select name="academic_level" defaultValue={member.academic_level || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Level" />
                </SelectTrigger>
                <SelectContent>
                  {["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level", "Graduate"].map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-xs font-semibold text-text-primary">
                Scope Organ(s) ({selectedOrgans.length} selected)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2 border border-neutrals-borderLight rounded-lg bg-surface">
                {ORGANS.map((o) => {
                  const isChecked = selectedOrgans.includes(o);
                  return (
                    <div
                      key={o}
                      onClick={() => toggleOrgan(o)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-xs",
                        isChecked ? "bg-brand-light text-brand-accent font-medium" : "hover:bg-surface-subtle"
                      )}
                    >
                      <Checkbox
                        id={`admin-organ-${o}`}
                        checked={isChecked}
                        onChange={() => toggleOrgan(o)}
                        className="pointer-events-none"
                      />
                      <span className="capitalize">{o.replace(/_/g, " ")}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Society checkboxes from NFCS_SOCIETIES */}
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-primary">
                  Society / Association ({selectedSocieties.length} selected)
                </label>
              </div>

              {/* Selected Badges */}
              {selectedSocieties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-surface-subtle border border-neutrals-borderLight">
                  {selectedSocieties.map((soc) => (
                    <span
                      key={soc}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-brand-light text-brand-accent border border-brand-border"
                    >
                      <span>{soc}</span>
                      <button
                        type="button"
                        onClick={() => toggleSociety(soc)}
                        className="hover:text-danger focus:outline-none"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="border border-neutrals-borderLight rounded-lg p-2 bg-surface space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
                  <Input
                    placeholder="Search society..."
                    value={societySearch}
                    onChange={(e) => setSocietySearch(e.target.value)}
                    className="pl-8 text-xs h-8"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 divide-y divide-neutrals-borderLight/30">
                  {filteredSocieties.map((s) => {
                    const isChecked = selectedSocieties.includes(s);
                    return (
                      <div
                        key={s}
                        onClick={() => toggleSociety(s)}
                        className={cn(
                          "flex items-center p-1.5 rounded cursor-pointer transition-colors text-xs pt-1.5",
                          isChecked ? "bg-brand-light/40 text-brand-accent font-medium" : "hover:bg-surface-subtle"
                        )}
                      >
                        <Checkbox
                          id={`admin-society-${s.replace(/\s+/g, "-")}`}
                          checked={isChecked}
                          onChange={() => toggleSociety(s)}
                          label={s}
                          className="pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-primary">Home Parish</label>
              <Input name="parish" defaultValue={member.parish || ""} />
            </div>

            {/* Exco Position (visible only for exco/super_admin roles) */}
            {isExcoRole && (
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-brand-accent" />
                  Exco Position
                </label>
                <Select value={selectedPosition} onValueChange={setSelectedPosition}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select position..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— No Position —</SelectItem>
                    {EXCO_POSITIONS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-text-tertiary">Each position is unique — no two excos can share the same title.</p>
              </div>
            )}
          </div>
        </CardContent>
      </form>
    </Card>
  );
}
