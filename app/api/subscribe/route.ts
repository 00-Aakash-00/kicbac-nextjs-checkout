import Kicbac, { KicbacError } from "kicbac";

export const runtime = "nodejs";

const plan = {
  id: "monthly-pro",
  amount: "29.00",
  payments: 0,
  dayFrequency: 30,
} as const;

interface SubscribeBody {
  paymentToken?: unknown;
  planId?: unknown;
  customer?: {
    name?: unknown;
    email?: unknown;
  };
}

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function looksLikePan(value: string): boolean {
  return /^\d{13,19}$/.test(value.replace(/[\s-]/g, ""));
}

export async function POST(request: Request): Promise<Response> {
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return json(400, { ok: false, message: "The request body must be JSON." });
  }

  const paymentToken = stringValue(body.paymentToken);
  if (!paymentToken || looksLikePan(paymentToken)) {
    return json(400, {
      ok: false,
      message: "Submit a Collect.js payment token, not raw card data.",
    });
  }

  if (body.planId !== plan.id) {
    return json(400, { ok: false, message: "Unknown subscription plan." });
  }

  const customerName = stringValue(body.customer?.name);
  const customerEmail = stringValue(body.customer?.email);
  const [firstName, ...lastNameParts] = (customerName ?? "Sandbox Customer").split(" ");

  try {
    const kicbac = new Kicbac();
    const result = await kicbac.subscriptions.create({
      plan: {
        amount: plan.amount,
        payments: plan.payments,
        dayFrequency: plan.dayFrequency,
      },
      paymentToken,
      orderId: `sub_${crypto.randomUUID()}`,
      billing: {
        firstName,
        lastName: lastNameParts.join(" ") || "Customer",
        ...(customerEmail ? { email: customerEmail } : {}),
      },
      merchantDefinedFields: {
        1: "nextjs-checkout",
      },
    });

    if (!result.ok) {
      return json(402, {
        ok: false,
        code: result.code,
        message: result.message,
      });
    }

    return json(200, {
      ok: true,
      subscriptionId: result.subscriptionId,
      transactionId: result.transactionId,
    });
  } catch (error) {
    if (KicbacError.isKicbacError(error)) {
      return json(500, {
        ok: false,
        code: error.code,
        message: "Subscription processing failed. Check the server logs.",
      });
    }

    throw error;
  }
}
