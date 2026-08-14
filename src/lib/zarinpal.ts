import "server-only";

const API_ORIGIN = "https://payment.zarinpal.com";
const REQUEST_PATH = "/pg/v4/payment/request.json";
const VERIFY_PATH = "/pg/v4/payment/verify.json";

type GatewayResponse = {
  data?: {
    code?: number;
    authority?: string;
    ref_id?: number | string;
    card_pan?: string;
    card_hash?: string;
    fee_type?: string;
    fee?: number;
  };
  errors?: { code?: number | string; message?: string } | Array<{ code?: number | string; message?: string }>;
};

export class ZarinpalError extends Error {
  constructor(
    message: string,
    public readonly code?: number | string,
    public readonly response?: GatewayResponse,
  ) {
    super(message);
    this.name = "ZarinpalError";
  }
}

function merchantId() {
  const value = process.env.ZARINPAL_MERCHANT_ID?.trim();
  if (!value) throw new ZarinpalError("کد پذیرنده زرین‌پال روی سرور تنظیم نشده است.");
  return value;
}

export function zarinpalCallbackUrl() {
  return (
    process.env.ZARINPAL_CALLBACK_URL?.trim() ||
    "https://chaplly.ir/api/payments/zarinpal/callback"
  );
}

function gatewayError(payload: GatewayResponse) {
  const errors = Array.isArray(payload.errors) ? payload.errors[0] : payload.errors;
  return new ZarinpalError(
    `${errors?.message || "پاسخ نامعتبر از زرین‌پال دریافت شد."}${errors?.code == null ? "" : ` (کد خطا: ${errors.code})`}`,
    errors?.code,
    payload,
  );
}

async function post(path: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Chaplly/1.0 ZarinPal",
      },
      body: JSON.stringify({ merchant_id: merchantId(), ...body }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new ZarinpalError(timedOut ? "پاسخ زرین‌پال بیش از ۱۵ ثانیه طول کشید." : `ارتباط سرور با زرین‌پال برقرار نشد${error instanceof Error ? `: ${error.message}` : "."}`);
  }
  let payload: GatewayResponse;
  try {
    payload = (await response.json()) as GatewayResponse;
  } catch {
    throw new ZarinpalError(`پاسخ زرین‌پال قابل خواندن نبود (HTTP ${response.status}).`);
  }
  if (!response.ok || !payload.data) throw gatewayError(payload);
  return payload;
}

export async function createZarinpalPayment(input: {
  amount: number;
  description: string;
  mobile?: string;
  email?: string;
  callbackUrl?: string;
}) {
  const metadata: Record<string, string> = {};
  if (input.mobile) metadata.mobile = input.mobile;
  if (input.email) metadata.email = input.email;
  const response = await post(REQUEST_PATH, {
    amount: input.amount,
    callback_url: input.callbackUrl || zarinpalCallbackUrl(),
    description: input.description,
    ...(Object.keys(metadata).length ? { metadata } : {}),
  });
  const authority = response.data?.authority;
  if (response.data?.code !== 100 || !authority) throw gatewayError(response);
  return { authority, response, url: zarinpalGatewayUrl(authority) };
}

export async function verifyZarinpalPayment(authority: string, amount: number) {
  const response = await post(VERIFY_PATH, { authority, amount });
  const code = Number(response.data?.code);
  if (code !== 100 && code !== 101) throw gatewayError(response);
  return { code, refId: String(response.data?.ref_id || ""), response };
}

export function zarinpalGatewayUrl(authority: string) {
  return `${API_ORIGIN}/pg/StartPay/${encodeURIComponent(authority)}`;
}
