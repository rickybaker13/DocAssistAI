interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

const getBaseUrl = (env: 'sandbox' | 'production') =>
  env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

const SQUARE_VERSION = '2025-01-23';

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Square-Version': SQUARE_VERSION,
  };
}

export async function createSquareCustomer(
  config: SquareConfig,
  input: { email: string; idempotencyKey: string },
): Promise<{ customerId: string }> {
  const url = `${getBaseUrl(config.environment)}/v2/customers`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      email_address: input.email,
    }),
  });
  const data = await res.json() as { customer?: { id?: string }; errors?: unknown };
  if (!res.ok || !data.customer?.id) {
    throw new Error(`Failed to create Square customer: ${JSON.stringify(data.errors ?? data)}`);
  }
  return { customerId: data.customer.id };
}

export async function storeCardOnFile(
  config: SquareConfig,
  input: { sourceId: string; customerId: string; idempotencyKey: string },
): Promise<{ cardId: string }> {
  const url = `${getBaseUrl(config.environment)}/v2/cards`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      source_id: input.sourceId,
      card: { customer_id: input.customerId },
    }),
  });
  const data = await res.json() as { card?: { id?: string }; errors?: unknown };
  if (!res.ok || !data.card?.id) {
    throw new Error(`Failed to store card on file: ${JSON.stringify(data.errors ?? data)}`);
  }
  return { cardId: data.card.id };
}

export async function chargeStoredCard(
  config: SquareConfig,
  input: {
    customerId: string;
    cardId: string;
    amountCents: number;
    currency: string;
    locationId: string;
    idempotencyKey: string;
    note?: string;
  },
): Promise<{ paymentId: string; status: string }> {
  const url = `${getBaseUrl(config.environment)}/v2/payments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      source_id: input.cardId,
      customer_id: input.customerId,
      location_id: input.locationId,
      autocomplete: true,
      amount_money: { amount: input.amountCents, currency: input.currency },
      note: input.note,
    }),
  });
  const data = await res.json() as { payment?: { id?: string; status?: string }; errors?: unknown };
  if (!res.ok || !data.payment?.id) {
    const errMsg = JSON.stringify(data.errors ?? data);
    throw new Error(`Square payment failed: ${errMsg}`);
  }
  return { paymentId: data.payment.id, status: data.payment.status ?? 'UNKNOWN' };
}

export async function disableCard(
  config: SquareConfig,
  cardId: string,
): Promise<void> {
  const url = `${getBaseUrl(config.environment)}/v2/cards/${cardId}/disable`;
  await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
  });
  // Best-effort — don't throw if it fails
}
