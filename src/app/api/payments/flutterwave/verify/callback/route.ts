import { NextResponse } from "next/server";
import { verifyFlutterwavePayment } from "@/lib/actions/flutterwave.actions";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const transactionId = searchParams.get("transaction_id");
  const txRef = searchParams.get("tx_ref");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const refToVerify = transactionId || txRef;

  if (!refToVerify) {
    return NextResponse.redirect(`${appUrl}/dues?error=missing_transaction_reference`);
  }

  try {
    const result = await verifyFlutterwavePayment(refToVerify);

    if (result.success && result.status === "confirmed" && result.paymentId) {
      return NextResponse.redirect(`${appUrl}/dues/receipt/${result.paymentId}`);
    }

    return NextResponse.redirect(`${appUrl}/dues/pay/checkout?ref=${txRef || refToVerify}`);
  } catch (err: unknown) {
    console.error("Error in Flutterwave callback handler:", err);
    return NextResponse.redirect(`${appUrl}/dues/pay/checkout?ref=${txRef || refToVerify}`);
  }
}
