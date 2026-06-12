# Contributing

Thanks for improving the Kicbac checkout example.

## Setup

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

The Kicbac npm packages must be published before this standalone repo can install and build from the public registry.

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
