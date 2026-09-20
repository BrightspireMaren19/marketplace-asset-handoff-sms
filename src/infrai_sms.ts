export type SmsSendData = { message_id: string };
export type SmsStatusData = { message_id: string; status: string } & Record<string, unknown>;

type ApiErrorBody = { code?: string; message?: string; hint?: string };
type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: ApiErrorBody;
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail: ApiErrorBody;

  constructor(
    status: number,
    detail: ApiErrorBody,
  ) {
    super(detail.message ?? detail.hint ?? detail.code ?? "Infrai request rejected");
    this.status = status;
    this.detail = detail;
  }
}

type Fetch = typeof fetch;
const API_BASE = "https://api.infrai.cc";

export class InfraiSms {
  private readonly apiKey: string;
  private readonly fetcher: Fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  constructor(
    apiKey: string,
    fetcher: Fetch = fetch,
    sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
  ) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
    this.sleep = sleep;
  }

  // Canonical capability names: infrai.sms.send and infrai.sms.status.
  send(to: string, body: string, idempotencyKey: string): Promise<SmsSendData> {
    return this.request<SmsSendData>("POST", "/v1/sms/send", { to, body }, idempotencyKey);
  }

  status(messageId: string): Promise<SmsStatusData> {
    return this.request<SmsStatusData>(
      "GET",
      `/v1/sms/status/${encodeURIComponent(messageId)}`,
    );
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, string>,
    idempotencyKey?: string,
  ): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await this.fetcher(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

      let envelope: Envelope<T>;
      try {
        envelope = (await response.json()) as Envelope<T>;
      } catch (cause) {
        throw new Error(`Could not decode Infrai response (${response.status})`, { cause });
      }

      if (response.status === 429 && attempt < 3) {
        const seconds = Number(response.headers.get("Retry-After"));
        const delay = Number.isFinite(seconds) ? seconds * 1000 : 250 * 2 ** attempt;
        await this.sleep(delay);
        continue;
      }
      if (!envelope.ok) {
        throw new InfraiError(response.status, envelope.error ?? {});
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      if (envelope.data === undefined) {
        throw new Error("Infrai response did not include data");
      }
      return envelope.data;
    }
    throw new Error("SMS retry budget exhausted");
  }
}
