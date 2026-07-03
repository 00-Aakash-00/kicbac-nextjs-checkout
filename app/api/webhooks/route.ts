import { kicbacWebhookHandler } from "@kicbac/nextjs/server";

export const runtime = "nodejs";

// Demo-only dedup: production must store event_id durably because the gateway
// can redeliver up to about 20 times over 3 days.
const seenEvents = new Set<string>();

function alreadySeen(eventId: string): boolean {
  if (seenEvents.has(eventId)) return true;
  seenEvents.add(eventId);
  return false;
}

export const { POST } = kicbacWebhookHandler({
  "recurring.subscription.add": async (event) => {
    if (alreadySeen(event.event_id)) return;
    console.log("subscription created", event.event_id);
  },
  "transaction.sale.success": async (event) => {
    if (alreadySeen(event.event_id)) return;
    console.log("subscription payment succeeded", event.event_id);
  },
  "*": async (event) => {
    if (alreadySeen(event.event_id)) return;
    console.log("verified Kicbac webhook", event.event_type);
  },
});
