import { InfraiSms } from "../src/infrai_sms";
import { handoffRequestSchema, processAssetHandoff } from "../src/order_handoff";

const apiKey = process.env.INFRAI_API_KEY;
const buyerPhone = process.env.BUYER_PHONE;
if (!apiKey || !buyerPhone) throw new Error("INFRAI_API_KEY and BUYER_PHONE are required");

const input = handoffRequestSchema.parse({
  orderId: "order-4821",
  state: "asset_ready",
  seller: {
    displayName: "Frame Foundry",
    assetTitle: "Festival poster source files",
    handoffPoint: "Creator dashboard, order 4821",
  },
  buyer: { phone: buyerPhone, lastUpdate: "none" },
});

console.log(JSON.stringify(await processAssetHandoff(input, new InfraiSms(apiKey)), null, 2));
