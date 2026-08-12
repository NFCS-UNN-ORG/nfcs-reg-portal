import { NextResponse } from "next/server";
import { initiateFlutterwavePayment } from "@/lib/actions/flutterwave.actions";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.amount || !body.dues_type || !body.payment_period) {
      return NextResponse.json(
        { error: "Missing required fields: amount, dues_type, payment_period" },
        { status: 400 },
      );
    }

    const result = await initiateFlutterwavePayment({
      amount: Number(body.amount),
      dues_type: body.dues_type,
      payment_period: body.payment_period,
      notes: body.notes,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal Server Error" },
      { status: 500 },
    );
  }
}
