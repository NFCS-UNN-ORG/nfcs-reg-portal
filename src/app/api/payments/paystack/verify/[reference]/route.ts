import { NextResponse } from "next/server";
import { verifyPaystackPayment } from "@/lib/actions/paystack.actions";
import { getAppUrl } from "@/lib/utils/app-url";

export async function GET(
  req: Request,
  { params }: { params: { reference: string } },
) {
  const reference = params.reference;
  const appUrl = getAppUrl();

  if (!reference) {
    return NextResponse.redirect(`${appUrl}/dues?error=missing_reference`);
  }

  try {
    const result = await verifyPaystackPayment(reference);

    if (result.success && result.status === "confirmed" && result.paymentId) {
      return NextResponse.redirect(`${appUrl}/dues/receipt/${result.paymentId}`);
    }

    return NextResponse.redirect(`${appUrl}/dues/pay/checkout?ref=${reference}`);
  } catch (err: unknown) {
    console.error("Error in Paystack verification route:", err);
    return NextResponse.redirect(`${appUrl}/dues/pay/checkout?ref=${reference}`);
  }
}
