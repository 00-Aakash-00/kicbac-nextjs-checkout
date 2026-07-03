# Kicbac Next.js checkout example

Standalone subscription checkout demo for Kicbac payments.

The app uses:

- `@kicbac/react` for Kicbac.js hosted payment fields
- `@kicbac/nextjs` for token charge and webhook route helpers
- `kicbac` for server-side gateway calls

Raw card data never reaches the Next.js server. The browser sends only a Kicbac.js `payment_token`.

## Status

This example is ready for the public npm packages:

```json
"@kicbac/nextjs": "^0.1.0",
"@kicbac/react": "^0.1.0",
"kicbac": "^0.1.0"
```

Until those packages are published to npm, plain `pnpm install` will fail with `404 Not Found` for the Kicbac packages. Run against a local sibling `kicbac-js` checkout instead.

## Run locally

While the packages are unpublished, first pack the SDKs and wire this app to those tarballs:

```sh
pnpm -C ../kicbac-js install
pnpm --dir ../kicbac-js exec turbo run build
pnpm --dir ../kicbac-js -r --filter kicbac --filter @kicbac/js --filter @kicbac/react --filter @kicbac/nextjs --filter @kicbac/themes exec pnpm pack
node scripts/use-local-kicbac.mjs ../kicbac-js
pnpm install --no-frozen-lockfile
pnpm dev
```

`scripts/use-local-kicbac.mjs` adds local `pnpm.overrides` to `package.json`. That change and any generated `pnpm-lock.yaml` are local-only and must not be committed before the npm packages are published.

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

Before publish, use the local tarball workflow above, then:

```sh
pnpm typecheck
pnpm build
```

After the Kicbac packages are published, install from the registry and commit a `pnpm-lock.yaml`.

## Deploy

The app can deploy to Vercel or any Next.js-compatible host. Set the three environment variables above in the hosting provider's secret manager.
