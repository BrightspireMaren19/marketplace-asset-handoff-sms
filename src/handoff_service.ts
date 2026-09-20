import { createServer } from "node:http";
import { InfraiError, InfraiSms } from "./infrai_sms";
import { handoffRequestSchema, processAssetHandoff } from "./order_handoff";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("INFRAI_API_KEY is required");
const sms = new InfraiSms(apiKey);

const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method !== "POST" || request.url !== "/order-handoffs") {
    response.writeHead(404).end(JSON.stringify({ error: "route not found" }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const parsed = handoffRequestSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    if (!parsed.success) {
      response.writeHead(400).end(JSON.stringify({ error: "invalid request", issues: parsed.error.issues }));
      return;
    }
    const result = await processAssetHandoff(parsed.data, sms);
    response.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      response.writeHead(status).end(JSON.stringify({ error: error.detail }));
      return;
    }
    response.writeHead(500).end(JSON.stringify({ error: "request could not be processed" }));
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Marketplace handoff service listening on http://localhost:${port}`));
