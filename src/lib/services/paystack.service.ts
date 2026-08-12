import crypto from "crypto";

export type PaystackInitializeInput = {
  amount: number; // Amount in Naira (will be converted to kobo)
  email: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type PaystackInitializeResult =
  | {
      success: true;
      authorizationUrl: string;
      accessCode: string;
      reference: string;
      raw: unknown;
    }
  | {
      success: false;
      error: string;
      raw?: unknown;
    };

export type PaystackVerifyResult =
  | {
      success: true;
      status: "success" | "failed" | "abandoned" | "pending";
      amount: number; // in Naira
      reference: string;
      paidAt?: string;
      raw: unknown;
    }
  | {
      success: false;
      error: string;
      raw?: unknown;
    };

function readEnv(name: string) {
  return process.env[name]?.trim();
}

function getPaystackSecretKey() {
  const secretKey = readEnv("PAYSTACK_SECRET_KEY");
  if (!secretKey) {
    throw new Error("Missing required environment variable: PAYSTACK_SECRET_KEY");
  }
  return secretKey;
}

export class PaystackService {
  private readonly baseUrl = "https://api.paystack.co";

  private getSecretKey(): string {
    return getPaystackSecretKey();
  }

  /**
   * Initializes a transaction with Paystack.
   */
  async initializeTransaction(input: PaystackInitializeInput): Promise<PaystackInitializeResult> {
    try {
      const secretKey = this.getSecretKey();
      const amountInKobo = Math.round(input.amount * 100);

      const payload = {
        email: input.email,
        amount: amountInKobo,
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata || {},
      };

      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.status || !data.data?.authorization_url) {
        return {
          success: false,
          error: data.message || `Paystack initialization failed with status ${response.status}`,
          raw: data,
        };
      }

      return {
        success: true,
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference: data.data.reference,
        raw: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unable to initialize Paystack payment",
      };
    }
  }

  /**
   * Verifies a transaction status with Paystack using the reference.
   */
  async verifyTransaction(reference: string): Promise<PaystackVerifyResult> {
    try {
      const secretKey = this.getSecretKey();

      const response = await fetch(
        `${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();

      if (!response.ok || !data.status || !data.data) {
        return {
          success: false,
          error: data.message || `Paystack transaction verification failed`,
          raw: data,
        };
      }

      const txData = data.data;
      const statusStr = String(txData.status || "").toLowerCase();
      let status: "success" | "failed" | "abandoned" | "pending" = "pending";

      if (statusStr === "success") {
        status = "success";
      } else if (statusStr === "failed") {
        status = "failed";
      } else if (statusStr === "abandoned") {
        status = "abandoned";
      }

      return {
        success: true,
        status,
        amount: Number(txData.amount || 0) / 100,
        reference: txData.reference,
        paidAt: txData.paid_at,
        raw: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unable to verify Paystack payment",
      };
    }
  }

  /**
   * Verifies Paystack webhook signature using HMAC-SHA512.
   */
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;

    try {
      const secretKey = this.getSecretKey();
      const hash = crypto
        .createHmac("sha512", secretKey)
        .update(rawBody)
        .digest("hex");

      const hashBuffer = Buffer.from(hash);
      const sigBuffer = Buffer.from(signatureHeader);

      if (hashBuffer.length !== sigBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(hashBuffer, sigBuffer);
    } catch {
      return false;
    }
  }
}
