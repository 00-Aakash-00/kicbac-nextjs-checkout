"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectJSResponse, KicbacFormError } from "@kicbac/react";
import { KicbacPaymentForm, KicbacProvider } from "@kicbac/react";

interface Plan {
  id: string;
  name: string;
  amount: string;
  displayAmount: string;
  cadence: string;
}

interface CheckoutFormProps {
  plan: Plan;
}

type CheckoutState =
  | { kind: "idle"; message: string }
  | { kind: "processing"; message: string }
  | { kind: "success"; message: string; subscriptionId: string | null }
  | { kind: "unconfirmed"; message: string }
  | { kind: "error"; message: string };

interface SubscribeResponse {
  ok?: unknown;
  message?: unknown;
  subscriptionId?: unknown;
  referenceId?: unknown;
}

const ATTEMPT_STORAGE_KEY = "kicbac:subscription-checkout:unresolved-attempt";
const ATTEMPT_ID_PATTERN = /^[a-f0-9]{24}$/;
const REFERENCE_ID_PATTERN = /^sub_[a-f0-9]{24}$/;

function rememberAttempt(attemptId: string, referenceId?: string): void {
  try {
    window.sessionStorage.setItem(
      ATTEMPT_STORAGE_KEY,
      referenceId ? `${attemptId}|${referenceId}` : attemptId,
    );
  } catch {
    // Browser storage is only a shopper-facing guard. Production duplicate
    // prevention belongs to the server's durable active-attempt constraint.
  }
}

function parseStoredAttempt(value: string | null): {
  attemptId: string;
  referenceId?: string;
} | null {
  if (!value) return null;
  const [attemptId, referenceId, ...extra] = value.split("|");
  if (
    extra.length > 0 ||
    !attemptId ||
    !ATTEMPT_ID_PATTERN.test(attemptId) ||
    (referenceId !== undefined && !REFERENCE_ID_PATTERN.test(referenceId))
  ) {
    return null;
  }
  return { attemptId, ...(referenceId ? { referenceId } : {}) };
}

function forgetAttempt(): void {
  try {
    window.sessionStorage.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // See rememberAttempt: server-side attempt state remains authoritative.
  }
}

export function CheckoutForm({ plan }: CheckoutFormProps) {
  const attemptIdRef = useRef<string | null>(null);
  const [restoringAttempt, setRestoringAttempt] = useState(true);
  const [customerName, setCustomerName] = useState("Jane Customer");
  const [customerEmail, setCustomerEmail] = useState("jane@example.com");
  const [state, setState] = useState<CheckoutState>({
    kind: "processing",
    message: "Checking for an unresolved checkout attempt...",
  });

  useEffect(() => {
    let storedAttempt: string | null = null;
    try {
      storedAttempt = window.sessionStorage.getItem(ATTEMPT_STORAGE_KEY);
    } catch {
      // Continue with the server-side controls when storage is unavailable.
    }

    const unresolvedAttempt = parseStoredAttempt(storedAttempt);
    if (unresolvedAttempt) {
      attemptIdRef.current = unresolvedAttempt.attemptId;
      const reconciliationHandle = unresolvedAttempt.referenceId
        ? `Reference: ${unresolvedAttempt.referenceId}`
        : `Support code: ${unresolvedAttempt.attemptId}`;
      setState({
        kind: "unconfirmed",
        message:
          "A previous subscription outcome is still unconfirmed. Do not submit again until " +
          `it is reconciled. ${reconciliationHandle}.`,
      });
    } else {
      if (storedAttempt) forgetAttempt();
      setState({
        kind: "idle",
        message: "Enter sandbox payment details to create a subscription.",
      });
    }
    setRestoringAttempt(false);
  }, []);

  const createSubscription = useCallback(
    async (response: CollectJSResponse) => {
      setState({ kind: "processing", message: "Creating subscription..." });
      attemptIdRef.current ??= crypto.randomUUID().replaceAll("-", "").slice(0, 24);
      const attemptId = attemptIdRef.current;
      rememberAttempt(attemptId);
      const fallbackHandle = `Support code: ${attemptId}`;

      let result: Response;
      try {
        result = await fetch("/api/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            paymentToken: response.token,
            planId: plan.id,
            attemptId,
            customer: {
              name: customerName,
              email: customerEmail,
            },
          }),
        });
      } catch {
        const message =
          "The subscription outcome could not be confirmed. Do not submit again until it is " +
          `reconciled. ${fallbackHandle}.`;
        setState({ kind: "unconfirmed", message });
        throw new Error(message);
      }

      let payload: SubscribeResponse;
      try {
        payload = (await result.json()) as SubscribeResponse;
      } catch {
        const message =
          "The subscription outcome could not be confirmed. Do not submit again until it is " +
          `reconciled. ${fallbackHandle}.`;
        setState({ kind: "unconfirmed", message });
        throw new Error(message);
      }

      const referenceId =
        typeof payload.referenceId === "string" && REFERENCE_ID_PATTERN.test(payload.referenceId)
          ? payload.referenceId
          : null;
      if (referenceId) rememberAttempt(attemptId, referenceId);
      const reconciliationHandle = referenceId ? `Reference: ${referenceId}` : fallbackHandle;
      const responseMessage = typeof payload.message === "string" ? payload.message : undefined;
      const subscriptionId =
        typeof payload.subscriptionId === "string" && payload.subscriptionId.trim() !== ""
          ? payload.subscriptionId.trim()
          : null;

      if (result.status === 402 && payload.ok === false) {
        attemptIdRef.current = null;
        forgetAttempt();
        const message = `${responseMessage ?? "The subscription was declined."} ${reconciliationHandle}.`;
        setState({ kind: "error", message });
        throw new Error(message);
      }

      if (!result.ok || payload.ok !== true || !subscriptionId) {
        const message = `${
          responseMessage ??
          "The subscription outcome could not be confirmed. Do not submit again until it is reconciled."
        } ${reconciliationHandle}.`;
        setState({ kind: "unconfirmed", message });
        throw new Error(message);
      }

      setState({
        kind: "success",
        message: "Subscription created.",
        subscriptionId,
      });
      attemptIdRef.current = null;
      forgetAttempt();
    },
    [customerEmail, customerName, plan.id],
  );

  const handleError = useCallback((error: KicbacFormError) => {
    setState((current) =>
      current.kind === "unconfirmed" ? current : { kind: "error", message: error.message },
    );
  }, []);

  return (
    <section className="payment-panel" aria-label="Payment details">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Payment method</p>
          <h2>Start subscription</h2>
        </div>
        <span className="amount-chip">{plan.displayAmount}</span>
      </div>

      <div className="customer-fields" aria-label="Customer">
        <label>
          <span>Name</span>
          <input
            name="customerName"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            autoComplete="name"
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            name="customerEmail"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            autoComplete="email"
            spellCheck={false}
          />
        </label>
      </div>

      {restoringAttempt || state.kind === "unconfirmed" ? null : (
        <KicbacProvider
          tokenizationKey={process.env.NEXT_PUBLIC_KICBAC_TOKENIZATION_KEY}
          injectStyles={false}
          appearance={{
            variables: {
              colorPrimary: "#f04ac4",
              colorText: "#141442",
              colorDanger: "#c4284c",
              borderRadius: "10px",
              fontFamily: "Inter, system-ui, sans-serif",
            },
          }}
        >
          <KicbacPaymentForm
            amount={plan.amount}
            currency="USD"
            buttonLabel="Start subscription"
            metadata={{ planId: plan.id }}
            onToken={createSubscription}
            onError={handleError}
          />
        </KicbacProvider>
      )}

      <p
        className={`status-line status-line--${state.kind === "unconfirmed" ? "error" : state.kind}`}
        role="status"
        aria-live="polite"
      >
        {state.message}
        {state.kind === "success" && state.subscriptionId ? (
          <span> Subscription ID: {state.subscriptionId}</span>
        ) : null}
      </p>
    </section>
  );
}
