import * as React from "react";
import type { Metadata } from "next";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { Mail, BookOpen, ShieldAlert, CreditCard, UserCheck, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service — NFCS UNN Registration Portal",
  description: "Read the Terms of Service governing your use of the NFCS UNN student registration portal.",
};

export default function TermsOfServicePage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <LegalLayout title="Terms of Service" lastUpdated={currentDate}>
      <p className="text-sm text-text-secondary leading-relaxed">
        By accessing or using the NFCS UNN student registration portal (
        <a href="https://portal.nfcsunn.org" className="text-brand font-semibold hover:underline">
          portal.nfcsunn.org
        </a>
        ), you agree to these Terms of Service.
      </p>

      {/* Purpose of This Portal */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <BookOpen className="size-5 text-brand shrink-0" />
          Purpose of This Portal
        </h2>
        <p className="text-text-secondary leading-relaxed">
          This portal is provided by <strong className="text-text-primary">NFCS UNN</strong> (Nigerian Federation of Catholic Students, University of Nigeria, Nsukka chapter) to facilitate student registration, dues tracking, and membership management for the fellowship.
        </p>
      </section>

      {/* Eligibility */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <UserCheck className="size-5 text-brand shrink-0" />
          Eligibility
        </h2>
        <p className="text-text-secondary leading-relaxed">
          This portal is intended for students, alumni, and members affiliated with NFCS UNN at the University of Nigeria, Nsukka.
        </p>
      </section>

      {/* Account Responsibilities */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <ShieldAlert className="size-5 text-brand shrink-0" />
          Account Responsibilities
        </h2>
        <p className="text-text-secondary leading-relaxed">
          You are responsible for maintaining the confidentiality of your account credentials and for all activity conducted under your account. You agree to provide accurate, truthful information when registering.
        </p>
      </section>

      {/* Payments */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <CreditCard className="size-5 text-brand shrink-0" />
          Payments & Dues
        </h2>
        <p className="text-text-secondary leading-relaxed">
          Registration fees and fellowship dues, where applicable, are processed securely through Paystack and/or Flutterwave. By making a payment, you agree to those providers&apos; respective terms of service in addition to ours.
        </p>
        <p className="text-text-secondary leading-relaxed">
          Refund requests should be directed to{" "}
          <a href="mailto:support@nfcsunn.org" className="text-brand font-semibold hover:underline">
            support@nfcsunn.org
          </a>{" "}
          and will be handled on a case-by-case basis at the discretion of NFCS UNN leadership.
        </p>
      </section>

      {/* Acceptable Use */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <AlertTriangle className="size-5 text-brand shrink-0" />
          Acceptable Use
        </h2>
        <p className="text-text-secondary leading-relaxed">
          You agree not to misuse this portal, including but not limited to:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-text-secondary">
          <li>Attempting unauthorized access to administrative functions or other users&apos; accounts.</li>
          <li>Submitting false registration, matriculation, or personal information.</li>
          <li>Interfering with or disrupting the portal&apos;s normal technical operation.</li>
        </ul>
      </section>

      {/* Changes to the Service */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary">Changes to the Service</h2>
        <p className="text-text-secondary leading-relaxed">
          We may modify, suspend, or discontinue any part of this portal at any time, including for maintenance or software improvements.
        </p>
      </section>

      {/* Limitation of Liability */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary">Limitation of Liability</h2>
        <p className="text-text-secondary leading-relaxed">
          This portal is provided &quot;as is.&quot; NFCS UNN is not liable for any indirect or incidental damages arising from your use of the portal, to the extent permitted by applicable law.
        </p>
      </section>

      {/* Changes to These Terms */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary">Changes to These Terms</h2>
        <p className="text-text-secondary leading-relaxed">
          We may update these Terms from time to time. Continued use of the portal after changes constitutes acceptance of the updated Terms.
        </p>
      </section>

      {/* Contact */}
      <section className="p-4 sm:p-5 bg-brand/5 border border-brand/20 rounded-xl space-y-2 mt-6">
        <h2 className="text-sm font-bold text-brand flex items-center gap-2">
          <Mail className="size-4" />
          Contact Us
        </h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          Questions about these Terms can be directed to{" "}
          <a href="mailto:support@nfcsunn.org" className="text-brand font-semibold hover:underline">
            support@nfcsunn.org
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  );
}
