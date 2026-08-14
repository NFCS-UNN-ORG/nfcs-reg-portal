import * as React from "react";
import { SuperAdminPinGate } from "@/components/auth/SuperAdminPinGate";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SuperAdminPinGate>{children}</SuperAdminPinGate>;
}
