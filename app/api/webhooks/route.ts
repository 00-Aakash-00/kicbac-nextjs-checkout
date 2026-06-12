import { kicbacWebhookHandler } from "@kicbac/nextjs/server";

export const runtime = "nodejs";

export const { POST } = kicbacWebhookHandler({
  "recurring.subscription.add": async (event) => {
    console.log("subscription created", event.event_id);
  },
  "transaction.sale.success": async (event) => {
    console.log("subscription payment succeeded", event.event_id);
  },
  "*": async (event) => {
    console.log("verified Kicbac webhook", event.event_type);
  },
});
