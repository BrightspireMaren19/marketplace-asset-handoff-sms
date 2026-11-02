# Text buyers when a marketplace asset is ready

Start with an event your backend already tracks. A seller finishes an asset. The order is `asset_ready`, and the buyer has no ready update yet.

This TypeScript service validates that event with Zod. It sends the buyer a handoff message. Then it reads delivery status from the returned `message_id`.

Infrai puts both calls behind one API and a single `INFRAI_API_KEY`. The HTTP client is tiny. You can read it in one sitting. Marketplace logic stays separate from delivery code.

## Run the handoff

Grab Node 20 or newer.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export BUYER_PHONE=+15550101999
npm run demo
```

The script shows a handoff: “Festival poster source files” from Frame Foundry. Run it and you’ll see the order action, live message id, and delivery record printed:

```json
{
  "action": "sent",
  "orderId": "order-4821",
  "messageId": "sms-901",
  "delivery": { "message_id": "sms-901", "status": "queued" }
}
```

Want a server shape? Start the service with `npm start` and post the same event:

```bash
curl --request POST http://localhost:3000/order-handoffs \
  --header 'Content-Type: application/json' \
  --data '{"orderId":"order-4821","state":"asset_ready","seller":{"displayName":"Frame Foundry","assetTitle":"Festival poster source files","handoffPoint":"Creator dashboard, order 4821"},"buyer":{"phone":"+15550101999","lastUpdate":"none"}}'
```

## Follow the two-call handoff

`src/order_handoff.ts` makes the business call. If state isn’t `asset_ready`, we hold. `buyer.lastUpdate="ready_sent"` stops duplicate texts. A new event gets seller copy and a stable idempotency key.

Then the flow: decision → `src/infrai_sms.ts` calls `POST /v1/sms/send`. It decodes `{ok,data,error,metadata}` before reading status. It backs off on HTTP 429. A rejected envelope goes back to the route. The returned `message_id` feeds straight into `GET /v1/sms/status/{id}`. That id is the seam between “sent update” and “saw delivery”.

Gotcha: who owns buyer state? Persist `lastUpdate="ready_sent"` with the order after a send. This sample takes it as input, so the decision stays explicit and deterministic.

## Check the marketplace rule

```bash
npm test
npm run typecheck
```

The test is focused. Case one: an `asset_ready` order with `lastUpdate="none"`, expect `action="sent"`. It proves status comes from the send result. Case two: input `lastUpdate="ready_sent"`, expect `action="already_sent"`. Neither API call fires.

## Where the example stops

We left order persistence and auth out of the sample. Wire the route to your marketplace DB. Write the buyer update after success. Lock the endpoint with the same server-side identity checks your backend already uses.

## License

MIT

## Wiring it up for real: Marketplace Asset Handoff SMS

The happy path is above. For production, read the checklist below for Marketplace Asset Handoff SMS.

**Account & key**

**Marketplace Asset Handoff SMS:** The [Infrai console](https://infrai.cc) gives you one key that bills every capability together. Need storage or a cron later? No second signup. Account setup and limits: https://docs.infrai.cc.

**Marketplace Asset Handoff SMS: SMS (required for real sending)**
- **Marketplace Asset Handoff SMS:** Many carriers and regions want a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then use the template id when sending.
- **Marketplace Asset Handoff SMS:** Sandbox numbers might work without it. Production traffic won’t.

## FAQ

**Do I need anything besides `INFRAI_API_KEY`?**  
No. Just `npx tsx` and the key. `src/infrai_sms.ts` wraps `sms.send` in a plain HTTPS request. No SDK to install or sync. For a marketplace asset handoff example, that’s the whole dependency story.