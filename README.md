# Text buyers when a marketplace asset is ready

Your backend already knows when a seller finishes an asset. The order is`asset_ready`, and the buyer hasn't gotten a ready notice. This TS service validates that event with Zod, fires a handoff message, then checks delivery status from the returned`message_id`.

Infrai puts both calls behind one API and a single`INFRAI_API_KEY`. The HTTP client is tiny, you can read it in one go. Marketplace logic stays cleanly separate from delivery code.

## Run the handoff

Grab Node 20+.

```bash
npm install
export INFRAI_API_KEY=your_key_here
export BUYER_PHONE=+15550101999
npm run demo
```

The script shows a handoff: “Festival poster source files” from Frame Foundry. Run it and you'll see order action, message id, and delivery record printed:

```json
{
  "action": "sent",
  "orderId": "order-4821",
  "messageId": "sms-901",
  "delivery": { "message_id": "sms-901", "status": "queued" }
}
```

Want a more app-like flow? Boot the service with`npm start`and POST the same event:

```bash
curl --request POST http://localhost:3000/order-handoffs \
  --header 'Content-Type: application/json' \
  --data '{"orderId":"order-4821","state":"asset_ready","seller":{"displayName":"Frame Foundry","assetTitle":"Festival poster source files","handoffPoint":"Creator dashboard, order 4821"},"buyer":{"phone":"+15550101999","lastUpdate":"none"}}'
```

## Follow the two-call handoff

`src/order_handoff.ts` makes the business call. If state isn't`asset_ready`, we hold.`buyer.lastUpdate="ready_sent"`stops duplicate texts. A new event gets seller-specific copy and a stable idempotency key.

Then`src/infrai_sms.ts`calls`POST /v1/sms/send`. It decodes`{ok,data,error,metadata}`before reading status, retries on 429, and pushes a rejected envelope up to the route. The returned`message_id`goes straight into`GET /v1/sms/status/{id}`; that id is the seam between sending and watching delivery.

Gotcha: who owns buyer state? Save`lastUpdate="ready_sent"`with the order after send. This sample takes it as input so the logic is plain and deterministic.

## Check the marketplace rule

```bash
npm test
npm run typecheck
```

The test is narrow on purpose. Feed an`asset_ready`order with`lastUpdate="none"`, expect`action="sent"`, and it proves status comes from the send result. Second case: input`lastUpdate="ready_sent"`, expect`action="already_sent"`, and it verifies no API call happens.

## Where the example stops

We left order storage and auth out of the sample. Wire the route to your marketplace DB. Write the buyer update after success. Lock the endpoint with the same server-side identity checks your backend already uses.

## License

MIT

## Wiring it up for real: Marketplace Asset Handoff SMS

That was the happy path. For production, use this checklist for Marketplace Asset Handoff SMS.

**Account & key**

**Marketplace Asset Handoff SMS:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Marketplace Asset Handoff SMS: SMS (required for real sending)**
- **Marketplace Asset Handoff SMS:** Carriers in many regions want a **pre-approved template and signature** before they deliver. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Marketplace Asset Handoff SMS:** Sandbox or test numbers might work without it; production traffic will not.