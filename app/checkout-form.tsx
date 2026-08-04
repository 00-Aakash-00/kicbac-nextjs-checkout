"use client";

import { useCallback, useRef, useState } from "react";
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

export function CheckoutForm({ plan }: CheckoutFormProps) {
  const attemptIdRef = useRef<string | null>(null);
  const [customerName, setCustomerName] = useState("Jane Customer");
  const [customerEmail, setCustomerEmail] = useState("jane@example.com");
  const [state, setState] = useState<CheckoutState>({
    kind: "idle",
    message: "Enter sandbox payment details to create a subscription.",
  });

  const createSubscription = useCallback(
    async (response: CollectJSResponse) => {
      setState({ kind: "processing", message: "Creating subscription..." });
      attemptIdRef.current ??= crypto.randomUUID().replaceAll("-", "").slice(0, 24);
      const attemptId = attemptIdRef.current;
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

      const reconciliationHandle =
        typeof payload.referenceId === "string"
          ? `Reference: ${payload.referenceId}`
          : fallbackHandle;
      const responseMessage = typeof payload.message === "string" ? payload.message : undefined;

      if (result.status === 402 && payload.ok === false) {
        attemptIdRef.current = null;
        const message = `${responseMessage ?? "The subscription was declined."} ${reconciliationHandle}.`;
        setState({ kind: "error", message });
        throw new Error(message);
      }

      if (!result.ok || payload.ok !== true) {
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
        subscriptionId: typeof payload.subscriptionId === "string" ? payload.subscriptionId : null,
      });
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

      {state.kind === "unconfirmed" ? null : (
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
