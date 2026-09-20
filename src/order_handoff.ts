import { z } from "zod";
import type { SmsStatusData } from "./infrai_sms";

export const handoffRequestSchema = z.object({
  orderId: z.string().min(1).max(64),
  state: z.enum(["paid", "asset_ready", "handed_off"]),
  seller: z.object({
    displayName: z.string().min(1).max(80),
    assetTitle: z.string().min(1).max(120),
    handoffPoint: z.string().min(1).max(160),
  }),
  buyer: z.object({
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    lastUpdate: z.enum(["none", "ready_sent"]),
  }),
});

export type HandoffRequest = z.infer<typeof handoffRequestSchema>;

export interface SmsPort {
  send(to: string, body: string, idempotencyKey: string): Promise<{ message_id: string }>;
  status(messageId: string): Promise<SmsStatusData>;
}

export type HandoffResult =
  | { action: "held"; orderId: string }
  | { action: "already_sent"; orderId: string }
  | { action: "sent"; orderId: string; messageId: string; delivery: SmsStatusData };

export async function processAssetHandoff(
  input: HandoffRequest,
  sms: SmsPort,
): Promise<HandoffResult> {
  if (input.state !== "asset_ready") {
    return { action: "held", orderId: input.orderId };
  }
  if (input.buyer.lastUpdate === "ready_sent") {
    return { action: "already_sent", orderId: input.orderId };
  }

  const message = `${input.seller.assetTitle} from ${input.seller.displayName} is ready. Handoff: ${input.seller.handoffPoint}`;
  const sent = await sms.send(
    input.buyer.phone,
    message,
    `asset-handoff:${input.orderId}:ready`,
  );
  const delivery = await sms.status(sent.message_id);
  return { action: "sent", orderId: input.orderId, messageId: sent.message_id, delivery };
}
