import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSubscription } = vi.hoisted(() => ({ createSubscription: vi.fn() }));

vi.mock("@kicbac/nextjs/server", () => ({
  readBodyCapped: async (request: Request, maxBytes: number) => {
    const body = new Uint8Array(await request.arrayBuffer());
    return body.byteLength > maxBytes ? null : body;
  },
}));
vi.mock("kicbac", async (importOriginal) => {
  const actual = await importOriginal<typeof import("kicbac")>();
  return {
    ...actual,
    default: class MockKicbac {
      subscriptions = { create: createSubscription };
    },
  };
});

import { TimeoutError } from "kicbac";
import { POST } from "./route";

const ATTEMPT_ID = "0123456789abcdef01234567";
const SECURITY_KEY = "test-security-key";
const REFERENCE_ID = `sub_${createHmac("sha256", SECURITY_KEY)
  .update("kicbac-nextjs-checkout/reference/v1\0")
  .update(ATTEMPT_ID)
  .digest("hex")
  .slice(0, 24)}`;

function request(body: string): Request {
  return new Request("http://localhost/api/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("POST /api/subscribe", () => {
  beforeEach(() => {
    createSubscription.mockReset();
    vi.stubEnv("KICBAC_SECURITY_KEY", SECURITY_KEY);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects a non-JSON content type before any SDK call", async () => {
    const response = await POST(
      new Request("http://localhost/api/subscribe", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({
          paymentToken: "tok_test",
          planId: "monthly-pro",
          attemptId: ATTEMPT_ID,
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it.each(["null", "[]", '"payment-token"'])(
    "rejects a non-object JSON body: %s",
    async (body: string) => {
      const response = await POST(request(body));

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        ok: false,
        message: "The request body must be a JSON object.",
      });
    },
  );

  it("rejects raw card data in place of a payment token", async () => {
    const response = await POST(
      request(JSON.stringify({ paymentToken: "4111 1111 1111 1111", planId: "monthly-pro" })),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "Submit a Kicbac.js payment token, not raw card data.",
    });
  });

  it("rejects an oversized streamed body without relying on content-length", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          paymentToken: "x".repeat(17_000),
          planId: "monthly-pro",
        }),
      ),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      message: "The request body is too large.",
    });
  });

  it("rejects unexpected top-level and customer fields before any SDK call", async () => {
    const unexpectedTopLevel = await POST(
      request(
        JSON.stringify({
          paymentToken: "tok_test",
          planId: "monthly-pro",
          attemptId: ATTEMPT_ID,
          ccnumber: "not-forwarded",
        }),
      ),
    );
    const unexpectedCustomer = await POST(
      request(
        JSON.stringify({
          paymentToken: "tok_test",
          planId: "monthly-pro",
          attemptId: ATTEMPT_ID,
          customer: { email: "jane@example.com", accountNumber: "not-forwarded" },
        }),
      ),
    );

    expect(unexpectedTopLevel.status).toBe(400);
    expect(unexpectedCustomer.status).toBe(400);
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("rejects an invalid checkout attempt ID before any SDK call", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          paymentToken: "tok_test",
          planId: "monthly-pro",
          attemptId: "attacker-controlled-order-id",
        }),
      ),
    );

    expect(response.status).toBe(400);
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it("derives a stable server-owned gateway reference from the browser attempt ID", async () => {
    createSubscription.mockResolvedValue({
      ok: true,
      subscriptionId: "sub-123",
      transactionId: "txn-123",
    });

    const response = await POST(
      request(
        JSON.stringify({
          paymentToken: "tok_test",
          planId: "monthly-pro",
          attemptId: ATTEMPT_ID,
          customer: { name: "Jane Customer", email: "jane@example.com" },
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(createSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: REFERENCE_ID,
        paymentToken: "tok_test",
        currency: "USD",
      }),
    );
    expect(REFERENCE_ID).not.toContain(ATTEMPT_ID);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      subscriptionId: "sub-123",
      transactionId: "txn-123",
      referenceId: REFERENCE_ID,
    });
  });

  it("returns a definitive typed decline with its gateway reference", async () => {
    createSubscription.mockResolvedValue({
      ok: false,
      code: 200,
      message: "DECLINE",
    });

    const response = await POST(
      request(
        JSON.stringify({
          paymentToken: "tok_test",
          planId: "monthly-pro",
          attemptId: ATTEMPT_ID,
        }),
      ),
    );

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: 200,
      message: "DECLINE",
      referenceId: REFERENCE_ID,
    });
  });

  it("returns a reference and a no-retry instruction for an ambiguous SDK error", async () => {
    createSubscription.mockRejectedValue(new TimeoutError("timed out", { timeoutMs: 1000 }));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(
      request(
        JSON.stringify({
          paymentToken: "tok_test",
          planId: "monthly-pro",
          attemptId: ATTEMPT_ID,
        }),
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "kicbac_timeout",
      message:
        "The subscription outcome could not be confirmed. Do not retry automatically; " +
        "reconcile it using the reference ID.",
      referenceId: REFERENCE_ID,
      retryable: false,
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Kicbac subscription request failed",
      expect.objectContaining({ attemptId: ATTEMPT_ID, referenceId: REFERENCE_ID }),
    );
    consoleError.mockRestore();
  });
});
