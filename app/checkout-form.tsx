"use client";

import { useCallback, useState } from "react";
import type { CollectJSResponse, KicbacFormError } from "@kicbac/react";
import { KicbacPaymentForm, KicbacProvider } from "@kicbac/react";

interface Plan {
  id: string;
  name: string;
  amount: string;
  cadence: string;
}

interface CheckoutFormProps {
  plan: Plan;
}

type CheckoutState =
  | { kind: "idle"; message: string }
  | { kind: "processing"; message: string }
  | { kind: "success"; message: string; subscriptionId: string | null }
  | { kind: "error"; message: string };

interface SubscribeResponse {
  ok: boolean;
  message?: string;
  subscriptionId?: string | null;
}

export function CheckoutForm({ plan }: CheckoutFormProps) {
  const [customerName, setCustomerName] = useState("Jane Customer");
  const [customerEmail, setCustomerEmail] = useState("jane@example.com");
  const [state, setState] = useState<CheckoutState>({
    kind: "idle",
    message: "Enter sandbox payment details to create a subscription.",
  });

  const createSubscription = useCallback(
    async (response: CollectJSResponse) => {
      setState({ kind: "processing", message: "Creating subscription..." });

      const result = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          paymentToken: response.token,
          planId: plan.id,
          customer: {
            name: customerName,
            email: customerEmail,
          },
        }),
      });

      const payload = (await result.json()) as SubscribeResponse;
      if (!result.ok || !payload.ok) {
        const message = payload.message ?? "The subscription was not created.";
        setState({ kind: "error", message });
        throw new Error(message);
      }

      setState({
        kind: "success",
        message: "Subscription created.",
        subscriptionId: payload.subscriptionId ?? null,
      });
    },
    [customerEmail, customerName, plan.id],
  );

  const handleError = useCallback((error: KicbacFormError) => {
    setState({ kind: "error", message: error.message });
  }, []);

  return (
    <section className="payment-panel" aria-label="Payment details">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Payment method</p>
          <h2>Start subscription</h2>
        </div>
        <span className="amount-chip">${plan.amount}</span>
      </div>

      <div className="customer-fields" aria-label="Customer">
        <label>
          <span>Name</span>
          <input
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            autoComplete="name"
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            value={customerEmail}
            onChange={(event) => setCustomerEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
      </div>

      <KicbacProvider
        tokenizationKey={process.env.NEXT_PUBLIC_KICBAC_TOKENIZATION_KEY}
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

      <p className={`status-line status-line--${state.kind}`} role="status" aria-live="polite">
        {state.message}
        {state.kind === "success" && state.subscriptionId ? (
          <span> Subscription ID: {state.subscriptionId}</span>
        ) : null}
      </p>
    </section>
  );
}
