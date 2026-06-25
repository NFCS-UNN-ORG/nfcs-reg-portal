"use client";

import * as React from "react";
import { useUser } from "@/hooks/useUser";
import { updateProfile } from "@/lib/actions/member.actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { Select } from "@/components/ui/select";
import { ORGANS } from "@/lib/validations/member.schema";
import { UNN_CAMPUS_DATA, UNN_HOSTELS, NFCS_SOCIETIES } from "@/lib/utils/unn-data";
import { 
  User, 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Church, 
  Music, 
  Award, 
  School, 
  GraduationCap, 
  Upload, 
  ShieldCheck, 
  Check, 
  Loader2 
} from "lucide-react";

export default function ProfilePage() {
  const { toast } = useToast();
  const { profile, isLoading: isUserLoading, refetch } = useUser();
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string | null>(null);

  // Dynamic dropdown states for UNN Campus Data
  const [selectedFaculty, setSelectedFaculty] = React.useState("");
  const [selectedDepartment, setSelectedDepartment] = React.useState("");
  const [selectedHostel, setSelectedHostel] = React.useState("");
  const [customAddress, setCustomAddress] = React.useState("");

  const isRestrictedRole = profile ? (profile.role !== "exco" && profile.role !== "super_admin") : false;
  const isFacultyDisabled = isRestrictedRole && !!profile?.faculty;
  const isDepartmentDisabled = isRestrictedRole && !!profile?.department;
  const isAcademicLevelDisabled = isRestrictedRole && !!profile?.academic_level;

  // Sync profile details to dynamic states
  React.useEffect(() => {
    if (profile) {
      setSelectedFaculty(profile.faculty || "");
      setSelectedDepartment(profile.department || "");
      
      const addr = profile.address || "";
      if (addr) {
        // Find matching hostel case-insensitively, ignoring "Off Campus" option itself
        const matchingHostel = UNN_HOSTELS.find(
          (h) => h.toLowerCase() === addr.toLowerCase() && h !== "Off Campus"
        );
        if (matchingHostel) {
          setSelectedHostel(matchingHostel);
          setCustomAddress("");
        } else {
          setSelectedHostel("Off Campus");
          setCustomAddress(addr);
        }
      } else {
        setSelectedHostel("");
        setCustomAddress("");
      }
    }
  }, [profile]);

  // Sync profile photo to preview when profile loads
  React.useEffect(() => {
    if (profile?.passport_photo_url) {
      setPhotoPreview(profile.passport_photo_url);
    }
  }, [profile]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Passport photo must be under 2MB.",
          variant: "error",
        });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;

    setIsLoading(true);
    const formData = new FormData(e.currentTarget);

    // Merge hostel selection and custom address into standard address key
    const addressOption = formData.get("address_option") as string;
    if (addressOption === "Off Campus") {
      const addressCustom = formData.get("address_custom") as string;
      formData.set("address", addressCustom || "Off Campus");
    } else if (addressOption) {
      formData.set("address", addressOption);
    }
    formData.delete("address_option");
    formData.delete("address_custom");

    if (isFacultyDisabled && profile.faculty) {
      formData.set("faculty", profile.faculty);
    }
    if (isDepartmentDisabled && profile.department) {
      formData.set("department", profile.department);
    }
    if (isAcademicLevelDisabled && profile.academic_level) {
      formData.set("academic_level", profile.academic_level);
    }

    if (photoFile) {
      formData.append("passport_photo", photoFile);
    }

    try {
      const result = await updateProfile(formData, profile.id);
      if (result?.success) {
        toast({
          title: "Profile Updated",
          description: "Your changes have been saved successfully.",
          variant: "success",
        });
        setPhotoFile(null);
        await refetch();
      } else if (result?.error) {
        toast({
          title: "Update Failed",
          description: result.error,
          variant: "error",
        });
      }
    } catch (err) {
      toast({
        title: "Unexpected Error",
        description: "Could not update profile. Please try again.",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center text-center gap-3">
        <User className="h-10 w-10 text-text-tertiary" />
        <h2 className="text-base font-bold text-text-primary">Profile Not Found</h2>
        <p className="text-xs text-text-secondary max-w-xs">
          We could not load your profile details. Please log out and try again.
        </p>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    student: "Student Member",
    alumnus: "Alumnus",
    exco: "Executive Officer",
    super_admin: "Super Administrator",
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === "super_admin") return "superAdmin" as const;
    if (role === "exco") return "exco" as const;
    if (role === "alumnus") return "alumnus" as const;
    return "student" as const;
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === "active") return "active" as const;
    if (status === "pending") return "pending" as const;
    return "inactive" as const;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1 select-none text-left">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          My Profile
        </h1>
        <p className="text-xs text-text-secondary">
          Manage your personal information, contact details, and chapter credentials.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Avatar & Account Summary */}
        <div className="space-y-6">
          <Card className="border border-neutrals-borderLight shadow-card bg-surface text-center">
            <CardContent className="p-6 flex flex-col items-center gap-4">
              {/* Photo Upload area */}
              <div className="relative group">
                <Avatar 
                  src={photoPreview} 
                  name={profile.full_name} 
                  size="xl" 
                  className="h-28 w-28 border-4 border-neutrals-borderLight shadow-sm"
                />
                <label 
                  htmlFor="passport_photo" 
                  className="absolute bottom-0 right-0 h-8 w-8 bg-brand hover:bg-brand-accent text-white rounded-full flex items-center justify-center border-2 border-white shadow-md cursor-pointer transition-all hover:scale-105"
                >
                  <Upload className="h-4 w-4" />
                </label>
                <input 
                  type="file" 
                  id="passport_photo" 
                  name="passport_photo" 
                  accept="image/*" 
                  onChange={handlePhotoChange} 
                  className="hidden" 
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-text-primary flex items-center justify-center gap-1">
                  {profile.full_name}
                  {profile.status === "active" && (
                    <ShieldCheck className="h-4 w-4 text-brand-accent" />
                  )}
                </h3>
                <p className="text-xs text-text-secondary">{profile.email}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2 border-t border-neutrals-borderLight w-full">
                <Badge variant={getRoleBadgeVariant(profile.role)}>
                  {roleLabels[profile.role] || profile.role}
                </Badge>
                <Badge variant={getStatusBadgeVariant(profile.status)}>
                  {profile.status.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Academic Summary Card (Read Only) */}
          <Card className="border border-neutrals-borderLight shadow-card bg-surface text-left">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold">Academic & Chapter Details</CardTitle>
              <CardDescription className="text-[11px]">Your primary chapter and school info.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <School className="h-4 w-4 text-text-tertiary shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{profile.faculty}</p>
                  <p className="text-[10px] text-text-tertiary">Faculty</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <GraduationCap className="h-4 w-4 text-text-tertiary shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-text-primary truncate">{profile.department}</p>
                  <p className="text-[10px] text-text-tertiary">Department</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <Award className="h-4 w-4 text-text-tertiary shrink-0" />
                <div>
                  <p className="font-semibold text-text-primary">{profile.academic_level}</p>
                  <p className="text-[10px] text-text-tertiary">Academic Level</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <Music className="h-4 w-4 text-text-tertiary shrink-0" />
                <div>
                  <p className="font-semibold text-text-primary capitalize">
                    {profile.organ ? profile.organ.replace(/_/g, " ") : "None"}
                  </p>
                  <p className="text-[10px] text-text-tertiary">Scope Organ</p>
                </div>
              </div>

              {profile.role === "exco" && (
                <div className="flex items-center gap-3 text-xs text-text-secondary animate-in fade-in duration-300">
                  <Award className="h-4 w-4 text-text-tertiary shrink-0" />
                  <div>
                    <p className="font-semibold text-text-primary">
                      {profile.position || "Not Assigned"}
                    </p>
                    <p className="text-[10px] text-text-tertiary">Exco Position</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Profile Edit Form */}
        <div className="lg:col-span-2">
          <Card className="border border-neutrals-borderLight shadow-card bg-surface text-left">
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
              <CardDescription>Update your personal and contact details.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pt-0">
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                      <Input 
                        name="full_name"
                        required
                        defaultValue={profile.full_name || ""}
                        disabled={isLoading}
                        className="pl-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                      <Input 
                        name="phone"
                        defaultValue={profile.phone || ""}
                        disabled={isLoading}
                        className="pl-9 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Date of Birth */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Date of Birth</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                      <Input 
                        type="date"
                        name="date_of_birth"
                        defaultValue={profile.date_of_birth || ""}
                        disabled={isLoading}
                        className="pl-9 text-xs"
                      />
                    </div>
                  </div>

                  {/* Residential Address Option Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Hostel / Residential Option</label>
                    <Select 
                      name="address_option"
                      value={selectedHostel}
                      onChange={(e) => {
                        setSelectedHostel(e.target.value);
                        if (e.target.value !== "Off Campus") {
                          setCustomAddress("");
                        }
                      }}
                      disabled={isLoading}
                      className="text-xs"
                      required
                    >
                      <option value="">Select Hostel / Option</option>
                      {UNN_HOSTELS.map((hostel) => (
                        <option key={hostel} value={hostel}>{hostel}</option>
                      ))}
                    </Select>

                    {/* Custom Address Input (Only visible if Off Campus is selected) */}
                    {selectedHostel === "Off Campus" && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200 mt-2">
                        <label className="text-xs font-semibold text-text-secondary">Off-Campus Address</label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                          <Input 
                            name="address_custom"
                            placeholder="e.g. 30 Odim Street, Nsukka"
                            defaultValue={customAddress}
                            onChange={(e) => setCustomAddress(e.target.value)}
                            disabled={isLoading}
                            className="pl-9 text-xs"
                            required
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Catholic Society */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Catholic Society / Devotional Group</label>
                    <Select 
                      name="society"
                      defaultValue={profile.society || ""}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      <option value="">Select Devotional Society / Unit</option>
                      {NFCS_SOCIETIES.map((soc) => (
                        <option key={soc} value={soc}>{soc}</option>
                      ))}
                      {profile.society && !NFCS_SOCIETIES.includes(profile.society as any) && (
                        <option value={profile.society}>{profile.society}</option>
                      )}
                    </Select>
                  </div>

                  {/* Home Parish */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Home Parish / Base Church</label>
                    <div className="relative">
                      <Church className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary pointer-events-none" />
                      <Input 
                        name="parish"
                        placeholder="St. Peter's Chaplaincy, UNN"
                        defaultValue={profile.parish || ""}
                        disabled={isLoading}
                        className="pl-9 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-b border-neutrals-borderLight pb-2 pt-4">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Academic & Chapter Details</h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Faculty Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                      <span>Faculty</span>
                      {isFacultyDisabled && <span className="text-[10px] text-amber-600 font-normal">Locked (Contact Admin to change)</span>}
                    </label>
                    <Select 
                      name="faculty"
                      value={selectedFaculty}
                      onChange={(e) => {
                        setSelectedFaculty(e.target.value);
                        setSelectedDepartment(""); // Reset department when faculty changes
                      }}
                      disabled={isLoading || isFacultyDisabled}
                      className="text-xs"
                      required
                    >
                      <option value="">Select Faculty</option>
                      {Object.keys(UNN_CAMPUS_DATA).map((fac) => (
                        <option key={fac} value={fac}>{fac}</option>
                      ))}
                    </Select>
                  </div>

                  {/* Department Dropdown (Filtered by Faculty) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                      <span>Department</span>
                      {isDepartmentDisabled && <span className="text-[10px] text-amber-600 font-normal">Locked</span>}
                    </label>
                    <Select 
                      name="department"
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      disabled={isLoading || !selectedFaculty || isDepartmentDisabled}
                      className="text-xs"
                      required
                    >
                      <option value="">Select Department</option>
                      {selectedFaculty &&
                        UNN_CAMPUS_DATA[selectedFaculty]?.map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Academic Level */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary flex items-center justify-between">
                      <span>Academic Level</span>
                      {isAcademicLevelDisabled && <span className="text-[10px] text-amber-600 font-normal">Locked</span>}
                    </label>
                    <Select 
                      name="academic_level"
                      defaultValue={profile.academic_level || ""}
                      disabled={isLoading || isAcademicLevelDisabled}
                      className="text-xs"
                    >
                      <option value="">Select Level</option>
                      <option value="100 Level">100 Level</option>
                      <option value="200 Level">200 Level</option>
                      <option value="300 Level">300 Level</option>
                      <option value="400 Level">400 Level</option>
                      <option value="500 Level">500 Level</option>
                      <option value="Graduate">Graduate</option>
                      <option value="Postgraduate">Postgraduate</option>
                    </Select>
                  </div>

                  {/* Scope Organ */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-text-secondary">Scope Organ</label>
                    <Select 
                      name="organ"
                      defaultValue={profile.organ || ""}
                      disabled={isLoading}
                      className="text-xs"
                    >
                      <option value="">Select Organ</option>
                      {ORGANS.map((o) => (
                        <option key={o} value={o}>
                          {o.replace(/_/g, " ").toUpperCase()}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-neutrals-borderLight">
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="px-6 h-10 text-xs font-semibold gap-2 bg-brand hover:bg-brand-accent transition-colors"
                    isLoading={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
