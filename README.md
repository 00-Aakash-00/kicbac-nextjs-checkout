# Kicbac Next.js subscription checkout

Subscription checkout demo using `@kicbac/react` for tokenized browser fields and `@kicbac/nextjs` for webhook handling.

## Run locally

```sh
pnpm install
pnpm --filter @kicbac/example-nextjs-checkout dev
```

Create `examples/nextjs-checkout/.env.local`:

```sh
NEXT_PUBLIC_KICBAC_TOKENIZATION_KEY=your-test-tokenization-key
KICBAC_SECURITY_KEY=your-test-security-key
KICBAC_WEBHOOK_SIGNING_KEY=your-test-webhook-signing-key
```

The checkout sends only the Kicbac.js `payment_token` to `/api/subscribe`. Raw card data never reaches the Next.js server route.
