import crypto from "crypto";

export type FlutterwaveInitializeInput = {
  amount: number; // in Naira
  email: string;
  txRef: string;
  redirectUrl: string;
  customerName?: string;
  customerPhone?: string;
  title?: string;
  description?: string;
};

export type FlutterwaveInitializeResult =
  | {
      success: true;
      checkoutUrl: string;
      txRef: string;
      raw: unknown;
    }
  | {
      success: false;
      error: string;
      raw?: unknown;
    };

export type FlutterwaveVerifyResult =
  | {
      success: true;
      status: "successful" | "failed" | "pending";
      amount: number;
      txRef: string;
      transactionId: string | number;
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

function getFlutterwaveSecretKey() {
  const secretKey = readEnv("FLUTTERWAVE_SECRET_KEY");
  if (!secretKey) {
    throw new Error("Missing required environment variable: FLUTTERWAVE_SECRET_KEY");
  }
  return secretKey;
}

export class FlutterwaveService {
  private readonly baseUrl = "https://api.flutterwave.com/v3";

  private getSecretKey(): string {
    return getFlutterwaveSecretKey();
  }

  /**
   * Initializes a payment session with Flutterwave.
   */
  async initializePayment(input: FlutterwaveInitializeInput): Promise<FlutterwaveInitializeResult> {
    try {
      const secretKey = this.getSecretKey();

      const payload = {
        tx_ref: input.txRef,
        amount: input.amount,
        currency: "NGN",
        redirect_url: input.redirectUrl,
        customer: {
          email: input.email,
          name: input.customerName || input.email,
          phonenumber: input.customerPhone || undefined,
        },
        customizations: {
          title: input.title || "NFCS Dues Payment",
          description: input.description || "Student Fellowship Registration / Dues Payment",
        },
      };

      const response = await fetch(`${this.baseUrl}/payments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success" || !data.data?.link) {
        return {
          success: false,
          error: data.message || `Flutterwave payment initialization failed`,
          raw: data,
        };
      }

      return {
        success: true,
        checkoutUrl: data.data.link,
        txRef: input.txRef,
        raw: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unable to initialize Flutterwave payment",
      };
    }
  }

  /**
   * Verifies a Flutterwave transaction by ID or reference.
   */
  async verifyTransaction(transactionIdOrRef: string): Promise<FlutterwaveVerifyResult> {
    try {
      const secretKey = this.getSecretKey();

      const isNumericId = /^\d+$/.test(transactionIdOrRef);
      const url = isNumericId
        ? `${this.baseUrl}/transactions/${encodeURIComponent(transactionIdOrRef)}/verify`
        : `${this.baseUrl}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(transactionIdOrRef)}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || data.status !== "success" || !data.data) {
        return {
          success: false,
          error: data.message || `Flutterwave transaction verification failed`,
          raw: data,
        };
      }

      const txData = data.data;
      const statusStr = String(txData.status || "").toLowerCase();
      let status: "successful" | "failed" | "pending" = "pending";

      if (statusStr === "successful") {
        status = "successful";
      } else if (statusStr === "failed") {
        status = "failed";
      }

      return {
        success: true,
        status,
        amount: Number(txData.amount || 0),
        txRef: txData.tx_ref,
        transactionId: txData.id,
        raw: data,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unable to verify Flutterwave payment",
      };
    }
  }

  /**
   * Verifies Flutterwave webhook signature using FLUTTERWAVE_SECRET_HASH.
   */
  verifyWebhookSignature(signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;

    const secretHash = readEnv("FLUTTERWAVE_SECRET_HASH");
    if (!secretHash) return false;

    try {
      const hashBuffer = Buffer.from(secretHash);
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
