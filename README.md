# Kicbac Next.js checkout example

Standalone subscription checkout demo for Kicbac payments.

The app uses:

- `@kicbac/react` for Collect.js hosted payment fields
- `@kicbac/nextjs` for token charge and webhook route helpers
- `kicbac` for server-side gateway calls

Raw card data never reaches the Next.js server. The browser sends only a Collect.js `payment_token`.

## Status

This example is ready for the public npm packages:

```json
"@kicbac/nextjs": "^0.1.0",
"@kicbac/react": "^0.1.0",
"kicbac": "^0.1.0"
```

Until those packages are published to npm, `pnpm install` will fail with `404 Not Found` for the Kicbac packages.

## Run locally

```sh
pnpm install
pnpm dev
```

Create `.env.local` from `.env.example`:

```sh
cp .env.example .env.local
```

Use test-mode credentials only.

## Environment

```sh
NEXT_PUBLIC_KICBAC_TOKENIZATION_KEY=your-test-tokenization-key
KICBAC_SECURITY_KEY=your-test-security-key
KICBAC_WEBHOOK_SIGNING_KEY=your-test-webhook-signing-key
```

## Verify

After the Kicbac packages are published:

```sh
pnpm install
pnpm typecheck
pnpm build
```

## Deploy

The app can deploy to Vercel or any Next.js-compatible host. Set the three environment variables above in the hosting provider's secret manager.
