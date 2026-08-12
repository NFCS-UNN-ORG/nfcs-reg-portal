import { NextResponse } from "next/server";
import { verifyFlutterwavePayment } from "@/lib/actions/flutterwave.actions";

export async function GET(
  req: Request,
  { params }: { params: { transaction_id: string } },
) {
  const transactionId = params.transaction_id;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (!transactionId) {
    return NextResponse.redirect(`${appUrl}/dues?error=missing_transaction_id`);
  }

  try {
    const result = await verifyFlutterwavePayment(transactionId);

    if (result.success && result.status === "confirmed" && result.paymentId) {
      return NextResponse.redirect(`${appUrl}/dues/receipt/${result.paymentId}`);
    }

    return NextResponse.redirect(`${appUrl}/dues/pay/checkout?ref=${transactionId}`);
  } catch (err: unknown) {
    console.error("Error in Flutterwave verification route:", err);
    return NextResponse.redirect(`${appUrl}/dues/pay/checkout?ref=${transactionId}`);
  }
}
