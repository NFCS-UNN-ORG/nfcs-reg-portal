import { NextResponse } from "next/server";
import { PaystackService } from "@/lib/services/paystack.service";
import { confirmOnlinePayment, failOnlinePayment } from "@/lib/actions/payment.actions";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-paystack-signature");
    const rawBody = await req.text();

    if (!rawBody) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    const paystack = new PaystackService();
    const isAuthentic = paystack.verifyWebhookSignature(rawBody, signature);

    if (!isAuthentic) {
      console.warn("[Paystack Webhook] Invalid signature rejected");
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const data = event.data || {};
    const reference = data.reference;

    if (!reference) {
      return NextResponse.json({ error: "Missing reference in webhook payload" }, { status: 400 });
    }

    if (eventType === "charge.success") {
      const confirmResult = await confirmOnlinePayment(reference, event);
      if (confirmResult.error) {
        console.error(`[Paystack Webhook] Error confirming ${reference}:`, confirmResult.error);
        return NextResponse.json({ error: confirmResult.error }, { status: 500 });
      }
      console.log(`[Paystack Webhook] Payment ${reference} successfully confirmed.`);
    } else if (eventType === "charge.failed") {
      const failResult = await failOnlinePayment(reference, event);
      if (failResult.error) {
        console.error(`[Paystack Webhook] Error marking payment ${reference} as failed:`, failResult.error);
        return NextResponse.json({ error: failResult.error }, { status: 500 });
      }
      console.log(`[Paystack Webhook] Payment ${reference} marked as failed.`);
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (err: unknown) {
    console.error("[Paystack Webhook] Processing error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
