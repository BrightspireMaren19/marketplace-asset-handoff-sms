import assert from "node:assert/strict";
import test from "node:test";
import { handoffRequestSchema, processAssetHandoff, type SmsPort } from "../src/order_handoff";

class RecordingSms implements SmsPort {
  sends: Array<{ to: string; body: string; key: string }> = [];
  statusReads: string[] = [];

  async send(to: string, body: string, key: string) {
    this.sends.push({ to, body, key });
    return { message_id: "sms-901" };
  }

  async status(messageId: string) {
    this.statusReads.push(messageId);
    return { message_id: messageId, status: "queued" };
  }
}

function order(lastUpdate: "none" | "ready_sent" = "none") {
  return handoffRequestSchema.parse({
    orderId: "order-4821",
    state: "asset_ready",
    seller: {
      displayName: "Frame Foundry",
      assetTitle: "Festival poster source files",
      handoffPoint: "Creator dashboard, order 4821",
    },
    buyer: { phone: "+15550101999", lastUpdate },
  });
}

test("a new asset-ready event sends once and reads delivery status", async () => {
  const sms = new RecordingSms();
  const result = await processAssetHandoff(order(), sms);

  assert.deepEqual(result, {
    action: "sent",
    orderId: "order-4821",
    messageId: "sms-901",
    delivery: { message_id: "sms-901", status: "queued" },
  });
  assert.deepEqual(sms.sends, [{
    to: "+15550101999",
    body: "Festival poster source files from Frame Foundry is ready. Handoff: Creator dashboard, order 4821",
    key: "asset-handoff:order-4821:ready",
  }]);
  assert.deepEqual(sms.statusReads, ["sms-901"]);
});

test("a recorded buyer update suppresses another send", async () => {
  const sms = new RecordingSms();
  assert.deepEqual(await processAssetHandoff(order("ready_sent"), sms), {
    action: "already_sent",
    orderId: "order-4821",
  });
  assert.equal(sms.sends.length, 0);
  assert.equal(sms.statusReads.length, 0);
});
