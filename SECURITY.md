# Security policy

This example is intentionally safe-by-default: it uses Kicbac.js hosted fields and sends only `payment_token` values to the server.

## Reporting a problem

Report ordinary bugs as GitHub issues. Report leaked keys, unsafe payment-data handling, or webhook signature issues privately to the Kicbac maintainers.

## Rules for changes

- Do not add raw card inputs.
- Do not send PAN, CVV, routing numbers, or bank account numbers to a Next.js route.
- Keep gateway security keys and webhook signing keys server-only.
- Use test-mode credentials in local development.
- Treat `response=2` declines as recoverable user-facing outcomes.
