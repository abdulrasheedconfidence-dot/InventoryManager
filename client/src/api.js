export class ApiError extends Error {
  constructor(message, { field, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.field = field;
    this.details = details;
  }
}

async function parseResponse(res) {
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.message || 'Request failed', {
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
