# Contributing

Thanks for improving the Kicbac checkout example.

## Setup

```sh
pnpm -C ../kicbac-js install
pnpm --dir ../kicbac-js exec turbo run build
pnpm --dir ../kicbac-js -r --filter kicbac --filter @kicbac/js --filter @kicbac/react --filter @kicbac/nextjs --filter @kicbac/themes exec pnpm pack
node scripts/use-local-kicbac.mjs ../kicbac-js
pnpm install --no-frozen-lockfile
cp .env.example .env.local
pnpm dev
```

The Kicbac npm packages are not published yet, so use the local tarball workflow above. Do not commit the temporary `package.json` overrides or generated `pnpm-lock.yaml`; after first publish, commit a lockfile and restore frozen registry installs.

## Checks

```sh
pnpm typecheck
pnpm build
```

## Guardrails

- Keep the example tokenized with Kicbac.js hosted fields.
- Never add raw-card form fields.
- Never commit `.env.local`, live keys, or real payment data.
- Keep the checkout amount decided server-side.
