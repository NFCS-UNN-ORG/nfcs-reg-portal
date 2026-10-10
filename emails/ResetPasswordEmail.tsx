import * as React from "react";

export interface ResetPasswordEmailProps {
  fullName?: string;
  resetUrl: string;
}

export default function ResetPasswordEmail({
  fullName,
  resetUrl,
}: ResetPasswordEmailProps) {
  return (
    <div
      style={{
        backgroundColor: "#f4f6f8",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: "40px 16px",
        margin: "0",
        minHeight: "100%",
        color: "#1e293b",
      }}
    >
      <table
        align="center"
        border={0}
        cellPadding={0}
        cellSpacing={0}
        width="100%"
        style={{
          maxWidth: "560px",
          margin: "0 auto",
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          overflow: "hidden",
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
        }}
      >
        {/* Header Banner */}
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: "#091D0A",
                padding: "36px 32px 28px",
                textAlign: "center",
                borderBottom: "3px solid #16a34a",
              }}
            >
              <div
                style={{
                  display: "inline-block",
                  width: "56px",
                  height: "56px",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  marginBottom: "14px",
                  padding: "4px",
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                }}
              >
                <img
                  src="https://portal.nfcsunn.org/nfcs-unn-logo.png"
                  alt="NFCS UNN"
                  width="48"
                  height="48"
                  style={{
                    display: "block",
                    margin: "0 auto",
                    borderRadius: "8px",
                    objectFit: "cover",
                  }}
                />
              </div>
              <h1
                style={{
                  color: "#ffffff",
                  fontSize: "20px",
                  fontWeight: "700",
                  letterSpacing: "-0.02em",
                  margin: "0 0 4px",
                }}
              >
                NFCS UNN Portal
              </h1>
              <p
                style={{
                  color: "#a7f3d0",
                  fontSize: "12px",
                  fontWeight: "500",
                  margin: "0",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Password Reset Request
              </p>
            </td>
          </tr>

          {/* Email Body Content */}
          <tr>
            <td style={{ padding: "36px 32px 24px" }}>
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: "24px",
                  margin: "0 0 16px",
                  color: "#0f172a",
                }}
              >
                {fullName ? `Dear ${fullName},` : "Dear Member,"}
              </p>

              <p
                style={{
                  fontSize: "14px",
                  lineHeight: "22px",
                  color: "#334155",
                  margin: "0 0 20px",
                }}
              >
                We received a request to reset the password for your account on the{" "}
                <strong>NFCS University of Nigeria, Nsukka Member Portal</strong>.
              </p>

              <p
                style={{
                  fontSize: "14px",
                  lineHeight: "22px",
                  color: "#334155",
                  margin: "0 0 28px",
                }}
              >
                Click the button below to choose a new, secure password:
              </p>

              {/* Action Button */}
              <div style={{ textAlign: "center", margin: "28px 0 32px" }}>
                <a
                  href={resetUrl}
                  style={{
                    backgroundColor: "#091D0A",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: "600",
                    textDecoration: "none",
                    padding: "14px 32px",
                    borderRadius: "10px",
                    display: "inline-block",
                    boxShadow: "0 2px 6px rgba(9, 29, 10, 0.25)",
                    border: "1px solid #091D0A",
                  }}
                >
                  Reset My Password
                </a>
              </div>

              {/* Security Alert Box */}
              <div
                style={{
                  backgroundColor: "#fef3c7",
                  borderLeft: "4px solid #f59e0b",
                  padding: "14px 16px",
                  borderRadius: "6px",
                  marginBottom: "24px",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    lineHeight: "18px",
                    color: "#92400e",
                    margin: "0",
                  }}
                >
                  <strong>Security notice:</strong> This password reset link will expire in <strong>1 hour</strong>. If you did not request this change, please ignore this email or reach out to the Chapter Exco. Your account remains safe.
                </p>
              </div>

              {/* Raw URL Fallback */}
              <p
                style={{
                  fontSize: "12px",
                  lineHeight: "18px",
                  color: "#64748b",
                  margin: "0 0 8px",
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: "20px",
                }}
              >
                If the button above does not work, copy and paste this link into your browser:
              </p>
              <p
                style={{
                  fontSize: "11px",
                  lineHeight: "16px",
                  color: "#0f766e",
                  wordBreak: "break-all",
                  margin: "0",
                }}
              >
                <a
                  href={resetUrl}
                  style={{ color: "#166534", textDecoration: "underline" }}
                >
                  {resetUrl}
                </a>
              </p>
            </td>
          </tr>

          {/* Footer */}
          <tr>
            <td
              style={{
                backgroundColor: "#f8fafc",
                padding: "24px 32px",
                textAlign: "center",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#334155",
                  margin: "0 0 4px",
                }}
              >
                Nigerian Federation of Catholic Students (NFCS)
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "#64748b",
                  margin: "0 0 8px",
                }}
              >
                St. Peter&apos;s Chaplaincy, University of Nigeria, Nsukka Chapter
              </p>
              <p
                style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                  margin: "0",
                }}
              >
                &copy; {new Date().getFullYear()} NFCS UNN. All rights reserved.
              </p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
