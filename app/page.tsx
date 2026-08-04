import { CheckoutForm } from "./checkout-form";

const amount = "29.00";

const plan = {
  id: "monthly-pro",
  name: "Monthly Pro",
  amount,
  displayAmount: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(amount)),
  cadence: "Billed every 30 days",
  included: ["Tokenized hosted fields", "Verified webhooks", "Customer Vault ready"],
};

export default function Page() {
  return (
    <main className="page-shell">
      <section className="checkout-grid" aria-label="Subscription checkout">
        <div className="summary-panel">
          <header className="brand-row">
            <img
              src="/brand/kicbac_logo_nav.svg"
              alt="Kicbac"
              className="brand-logo"
              width="400"
              height="100"
              fetchPriority="high"
            />
            <span>Sandbox demo</span>
          </header>

          <div className="plan-copy">
            <p className="eyebrow">Subscription</p>
            <h1>{plan.name}</h1>
            <p className="plan-description">
              Start a tokenized recurring billing flow with Kicbac hosted fields and a server-side
              subscription route.
            </p>
          </div>

          <div className="price-row">
            <span className="price">{plan.displayAmount}</span>
            <span>{plan.cadence}</span>
          </div>

          <ul className="included-list">
            {plan.included.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <CheckoutForm plan={plan} />
      </section>
    </main>
  );
}
