import { NextResponse } from "next/server";
import { FlutterwaveService } from "@/lib/services/flutterwave.service";
import { confirmOnlinePayment, failOnlinePayment } from "@/lib/actions/payment.actions";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("verif-hash");
    const rawBody = await req.text();

    if (!rawBody) {
      return NextResponse.json({ error: "Empty request body" }, { status: 400 });
    }

    const flutterwave = new FlutterwaveService();
    const isAuthentic = flutterwave.verifyWebhookSignature(signature);

    if (!isAuthentic) {
      console.warn("[Flutterwave Webhook] Invalid signature rejected");
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event || event["event.type"];
    const data = event.data || {};
    const txRef = data.tx_ref || data.txRef;

    if (!txRef) {
      return NextResponse.json({ error: "Missing tx_ref in webhook payload" }, { status: 400 });
    }

    const status = String(data.status || "").toLowerCase();

    if (status === "successful" || eventType === "charge.completed") {
      const confirmResult = await confirmOnlinePayment(txRef, event);
      if (confirmResult.error) {
        console.error(`[Flutterwave Webhook] Error confirming ${txRef}:`, confirmResult.error);
        return NextResponse.json({ error: confirmResult.error }, { status: 500 });
      }
      console.log(`[Flutterwave Webhook] Payment ${txRef} successfully confirmed.`);
    } else if (status === "failed") {
      const failResult = await failOnlinePayment(txRef, event);
      if (failResult.error) {
        console.error(`[Flutterwave Webhook] Error marking payment ${txRef} as failed:`, failResult.error);
        return NextResponse.json({ error: failResult.error }, { status: 500 });
      }
      console.log(`[Flutterwave Webhook] Payment ${txRef} marked as failed.`);
    }

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (err: unknown) {
    console.error("[Flutterwave Webhook] Processing error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
