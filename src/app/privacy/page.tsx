import * as React from "react";
import type { Metadata } from "next";
import { LegalLayout } from "@/components/layout/LegalLayout";
import { Mail, ShieldCheck, Database, CreditCard, Lock, UserCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — NFCS UNN Registration Portal",
  description: "Learn how NFCS UNN collects, uses, and protects your personal information on our student registration portal.",
};

export default function PrivacyPolicyPage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <LegalLayout title="Privacy Policy" lastUpdated={currentDate}>
      <p className="text-sm text-text-secondary leading-relaxed">
        NFCS UNN (&quot;we,&quot; &quot;us,&quot; &quot;our&quot;) operates the student registration portal at{" "}
        <a href="https://portal.nfcsunn.org" className="text-brand font-semibold hover:underline">
          portal.nfcsunn.org
        </a>
        . This policy explains what information we collect from users of this portal and how we use it.
      </p>

      {/* Information We Collect */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <Database className="size-5 text-brand shrink-0" />
          Information We Collect
        </h2>
        <ul className="list-disc pl-5 space-y-2 text-text-secondary">
          <li>
            <strong className="text-text-primary">Account Details:</strong> Name, email address, matriculation/registration number, and other registration details you provide when creating an account or registering for fellowship activities.
          </li>
          <li>
            <strong className="text-text-primary">Google Sign-In:</strong> If you sign in with Google, we receive your name, email address, and profile picture from Google, as permitted by your Google account settings.
          </li>
          <li>
            <strong className="text-text-primary">Payment Information:</strong> We do not directly collect or store your card or bank details. Payments are processed securely by Paystack and Flutterwave, our third-party payment processors. We only receive confirmation of payment status and a transaction reference.
          </li>
        </ul>
      </section>

      {/* How We Use Your Information */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <UserCheck className="size-5 text-brand shrink-0" />
          How We Use Your Information
        </h2>
        <ul className="list-disc pl-5 space-y-2 text-text-secondary">
          <li>To create and manage your account on the portal.</li>
          <li>To process and confirm your fellowship registration and dues payments.</li>
          <li>To send you account-related emails (e.g., email confirmation, password reset) via our email service provider, Resend.</li>
          <li>To communicate with you about fellowship activities, events, and announcements where applicable.</li>
        </ul>
      </section>

      {/* Third-Party Services */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <CreditCard className="size-5 text-brand shrink-0" />
          Third-Party Services
        </h2>
        <p className="text-text-secondary">
          We use the following reputable third-party services to operate this portal:
        </p>
        <div className="grid sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3 bg-surface-subtle rounded-xl border border-neutrals-borderLight">
            <span className="font-semibold text-text-primary block text-xs">Supabase</span>
            <span className="text-[11px] text-text-tertiary">Authentication and encrypted database hosting</span>
          </div>
          <div className="p-3 bg-surface-subtle rounded-xl border border-neutrals-borderLight">
            <span className="font-semibold text-text-primary block text-xs">Google OAuth</span>
            <span className="text-[11px] text-text-tertiary">Secure single sign-in authentication option</span>
          </div>
          <div className="p-3 bg-surface-subtle rounded-xl border border-neutrals-borderLight">
            <span className="font-semibold text-text-primary block text-xs">Paystack & Flutterwave</span>
            <span className="text-[11px] text-text-tertiary">PCI-DSS compliant payment processing</span>
          </div>
          <div className="p-3 bg-surface-subtle rounded-xl border border-neutrals-borderLight">
            <span className="font-semibold text-text-primary block text-xs">Resend</span>
            <span className="text-[11px] text-text-tertiary">Transactional email delivery</span>
          </div>
        </div>
        <p className="text-xs text-text-tertiary pt-1">
          Each of these providers has its own privacy practices governing the data they process on our behalf.
        </p>
      </section>

      {/* Data Security */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <Lock className="size-5 text-brand shrink-0" />
          Data Security
        </h2>
        <p className="text-text-secondary leading-relaxed">
          We take reasonable measures to protect your information, including using secure, encrypted connections (HTTPS) and reputable third-party providers for sensitive functions like payments and authentication. However, no method of transmission over the internet is 100% secure.
        </p>
      </section>

      {/* Data Retention */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary flex items-center gap-2">
          <ShieldCheck className="size-5 text-brand shrink-0" />
          Data Retention
        </h2>
        <p className="text-text-secondary leading-relaxed">
          We retain your registration and account information for as long as your account is active or as needed to fulfill fellowship administrative purposes.
        </p>
      </section>

      {/* Your Rights */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary">Your Rights</h2>
        <p className="text-text-secondary leading-relaxed">
          You may request access to, correction of, or deletion of your personal data by contacting us at{" "}
          <a href="mailto:support@nfcsunn.org" className="text-brand font-semibold hover:underline">
            support@nfcsunn.org
          </a>
          .
        </p>
      </section>

      {/* Changes to This Policy */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base sm:text-lg font-bold text-text-primary">Changes to This Policy</h2>
        <p className="text-text-secondary leading-relaxed">
          We may update this Privacy Policy from time to time. Continued use of the portal after changes constitutes acceptance of the updated policy.
        </p>
      </section>

      {/* Contact */}
      <section className="p-4 sm:p-5 bg-brand/5 border border-brand/20 rounded-xl space-y-2 mt-6">
        <h2 className="text-sm font-bold text-brand flex items-center gap-2">
          <Mail className="size-4" />
          Contact Us
        </h2>
        <p className="text-xs text-text-secondary leading-relaxed">
          If you have questions or concerns about this Privacy Policy, please contact us at{" "}
          <a href="mailto:support@nfcsunn.org" className="text-brand font-semibold hover:underline">
            support@nfcsunn.org
          </a>.
        </p>

      </section>
    </LegalLayout>
  );
}

