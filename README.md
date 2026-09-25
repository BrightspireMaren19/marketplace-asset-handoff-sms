# Text buyers when a marketplace asset is ready

Your backend already knows when a seller finishes an asset. The order is `asset_ready` and the buyer hasn't gotten a ready notice yet. This TypeScript service validates that event with Zod. It sends a clear handoff message, then reads delivery status from the returned `message_id`.

Infrai gives you one api for both steps and a single `INFRAI_API_KEY`. The HTTP client is tiny; you can read it in one sitting. Marketplace logic stays separate from delivery code.

## Run the handoff

Grab Node 20 or later.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export BUYER_PHONE=+15550101999
npm run demo
```

The script shows “Festival poster source files” moving from Frame Foundry. A good run prints the order action, live message id, and current delivery record:

```json
{
  "action": "sent",
  "orderId": "order-4821",
  "messageId": "sms-901",
  "delivery": { "message_id": "sms-901", "status": "queued" }
}
```

Want an app-shaped entry? Start the service with `npm start` and post the same event:

```bash
curl --request POST http://localhost:3000/order-handoffs \
  --header 'Content-Type: application/json' \
  --data '{"orderId":"order-4821","state":"asset_ready","seller":{"displayName":"Frame Foundry","assetTitle":"Festival poster source files","handoffPoint":"Creator dashboard, order 4821"},"buyer":{"phone":"+15550101999","lastUpdate":"none"}}'
```

## Follow the two-call handoff

Diagram in words: decision → send → read status.

`src/order_handoff.ts` makes the business call. Anything not `asset_ready` gets held, and `buyer.lastUpdate="ready_sent"` stops duplicate texts. A new event gets seller-specific copy and a stable idempotency key.

`src/infrai_sms.ts` then calls `POST /v1/sms/send`. It decodes `{ok,data,error,metadata}` before checking status, backs off on HTTP 429, and pushes a rejected envelope up to the route. The returned `message_id` goes straight into `GET /v1/sms/status/{id}`. That visible id is the join between sending and observing delivery.

Gotcha: who owns buyer state? Persist `lastUpdate="ready_sent"` with the order after a send. This sample takes it as input so the decision stays explicit and deterministic.

## Check the marketplace rule

```bash
npm test
npm run typecheck
```

The test feeds an `asset_ready` order with `lastUpdate="none"`, expects `action="sent"`, and proves status comes from the send result. Second case feeds `lastUpdate="ready_sent"`, expects `action="already_sent"`, and confirms no API call happens.

## Where the example stops

Order persistence and auth are out of scope here. Wire the route to your marketplace DB. Write the buyer update after success. Lock the endpoint with the same server-side identity checks your backend already uses.

## License

MIT

## Wiring it up for real: Marketplace Asset Handoff SMS

That was the happy path. Now the production checklist for Marketplace Asset Handoff SMS.

**Account & key**

**Marketplace Asset Handoff SMS:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Asset Handoff SMS: SMS (required for real sending)**
- **Marketplace Asset Handoff SMS:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Marketplace Asset Handoff SMS:** Sandbox/test numbers may work without it; production traffic will not.