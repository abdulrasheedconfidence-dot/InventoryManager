export class ApiError extends Error {
  constructor(message, { status, field, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
    this.details = details;
  }
}

async function parseResponse(res) {
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.message || 'Request failed', {
      status: res.status,
      field: err?.field,
      details: err?.details,
    });
  }

  return body;
}

export async function fetchProducts({ search, lowStock, signal } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (lowStock) params.set('lowStock', 'true');

  const res = await fetch(`/api/products?${params.toString()}`, { signal });
  return parseResponse(res);
}

export async function createProduct({ sku, name, reorder_threshold }) {
  const res = await fetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sku, name, reorder_threshold }),
  });
  return parseResponse(res);
}

export async function fetchProduct(id, { signal } = {}) {
  const res = await fetch(`/api/products/${id}`, { signal });
  return parseResponse(res);
}

export async function createMovement(id, { type, quantity, note }) {
  const res = await fetch(`/api/products/${id}/movements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, quantity, note }),
  });
  return parseResponse(res);
}
