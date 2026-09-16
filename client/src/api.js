export async function fetchProducts({ search, lowStock, signal } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (lowStock) params.set('lowStock', 'true');

  const res = await fetch(`/api/products?${params.toString()}`, { signal });
  const body = await res.json();

  if (!res.ok) {
    throw new Error(body?.error?.message || 'Failed to load products');
  }

  return body;
}
