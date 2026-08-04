import { createHmac } from "node:crypto";
import { readBodyCapped } from "@kicbac/nextjs/server";
import Kicbac, { KicbacError } from "kicbac";

export const runtime = "nodejs";

const plan = {
  id: "monthly-pro",
  amount: "29.00",
  payments: 0,
  dayFrequency: 30,
} as const;

const MAX_BODY_BYTES = 16 * 1024;

const BODY_KEYS = new Set(["paymentToken", "planId", "attemptId", "customer"]);
const CUSTOMER_KEYS = new Set(["name", "email"]);
const ATTEMPT_ID_PATTERN = /^[a-f0-9]{24}$/;

function json(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isJsonRequest(request: Request): boolean {
  return (
    request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ===
    "application/json"
  );
}

function looksLikePan(value: string): boolean {
  return /^\d{13,19}$/.test(value.replace(/[\s-]/g, ""));
}

function referenceForAttempt(attemptId: string, securityKey: string): string {
  const digest = createHmac("sha256", securityKey)
    .update("kicbac-nextjs-checkout/reference/v1\0")
    .update(attemptId)
    .digest("hex")
    .slice(0, 24);
  return `sub_${digest}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!isJsonRequest(request)) {
    return json(400, { ok: false, message: "The request content type must be application/json." });
  }

  let body: Record<string, unknown>;
  try {
    const buffer = await readBodyCapped(request, MAX_BODY_BYTES);
    if (buffer === null) {
      return json(413, { ok: false, message: "The request body is too large." });
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(buffer));
    if (!isObject(parsed)) {
      return json(400, { ok: false, message: "The request body must be a JSON object." });
    }
    body = parsed;
  } catch {
    return json(400, { ok: false, message: "The request body must be JSON." });
  }

  if (!hasOnlyKeys(body, BODY_KEYS)) {
    return json(400, { ok: false, message: "The request body contains unexpected fields." });
  }

  const paymentToken = stringValue(body.paymentToken);
  if (!paymentToken || looksLikePan(paymentToken)) {
    return json(400, {
      ok: false,
      message: "Submit a Kicbac.js payment token, not raw card data.",
    });
  }

  if (body.planId !== plan.id) {
    return json(400, { ok: false, message: "Unknown subscription plan." });
  }

  const attemptId = stringValue(body.attemptId);
  if (!attemptId || !ATTEMPT_ID_PATTERN.test(attemptId)) {
    return json(400, { ok: false, message: "A valid checkout attempt ID is required." });
  }

  const customer = body.customer;
  if (customer !== undefined && (!isObject(customer) || !hasOnlyKeys(customer, CUSTOMER_KEYS))) {
    return json(400, { ok: false, message: "Invalid customer details." });
  }

  const customerName = stringValue(customer?.name);
  const customerEmail = stringValue(customer?.email);
  const [firstName, ...lastNameParts] = (customerName ?? "Sandbox Customer").split(" ");
  const securityKey = stringValue(process.env.KICBAC_SECURITY_KEY);
  if (!securityKey) {
    console.error("Kicbac subscription checkout is missing KICBAC_SECURITY_KEY", { attemptId });
    return json(500, {
      ok: false,
      message: "Checkout is not configured. Contact support with the checkout support code.",
      retryable: false,
    });
  }
  const referenceId = referenceForAttempt(attemptId, securityKey);

  try {
    const kicbac = new Kicbac({ securityKey });
    const result = await kicbac.subscriptions.create({
      plan: {
        amount: plan.amount,
        payments: plan.payments,
        dayFrequency: plan.dayFrequency,
      },
      paymentToken,
      orderId: referenceId,
      currency: "USD",
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
        referenceId,
      });
    }

    if (!result.subscriptionId?.trim()) {
      return json(500, {
        ok: false,
        message:
          "Approval received without a subscription ID. Reconcile it using the reference ID " +
          "before retrying.",
        referenceId,
        retryable: false,
      });
    }

    return json(200, {
      ok: true,
      subscriptionId: result.subscriptionId,
      transactionId: result.transactionId,
      referenceId,
    });
  } catch (error) {
    if (KicbacError.isKicbacError(error)) {
      console.error("Kicbac subscription request failed", {
        attemptId,
        referenceId,
        error: error.toJSON(),
      });
      return json(500, {
        ok: false,
        code: error.code,
        message:
          "The subscription outcome could not be confirmed. Do not retry automatically; " +
          "reconcile it using the reference ID.",
        referenceId,
        retryable: false,
      });
    }

    throw error;
  }
}
