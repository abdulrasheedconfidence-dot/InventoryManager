import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProduct, ApiError } from '../api';
import MovementForm from '../components/MovementForm';

function formatDate(isoString) {
  return new Date(isoString).toLocaleString();
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setNotFound(false);

    fetchProduct(id, { signal: controller.signal })
      .then((data) => {
        setProduct(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err.message);
        }
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [id, refreshIndex]);

  function handleMovementRecorded() {
    setRefreshIndex((i) => i + 1);
  }

  return (
    <div className="page">
      <p>
        <Link to="/">&larr; Back to products</Link>
      </p>

      {isLoading && <p className="status">Loading product...</p>}

      {!isLoading && notFound && <p className="status">Product not found.</p>}

      {!isLoading && !notFound && error && (
        <p className="status status-error">Couldn't load product: {error}</p>
      )}

      {!isLoading && !notFound && !error && product && (
        <>
          <div className="page-header">
            <div>
              <h1>{product.name}</h1>
              <p className="product-sku">{product.sku}</p>
            </div>
          </div>

          <div className="product-summary">
            <div className="summary-stat">
              <span className="summary-label">Current stock</span>
              <span className="summary-value">
                {product.stock}
                {product.stock <= product.reorder_threshold && (
                  <span className="low-stock-badge">Low stock</span>
                )}
              </span>
            </div>
            <div className="summary-stat">
              <span className="summary-label">Reorder threshold</span>
              <span className="summary-value">{product.reorder_threshold}</span>
            </div>
          </div>

          <MovementForm productId={product.id} onRecorded={handleMovementRecorded} />

          <h2>Movement history</h2>
          {product.movements.length === 0 ? (
            <p className="status">No movements recorded yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {product.movements.map((m) => (
                    <tr key={m.id}>
                      <td>{formatDate(m.created_at)}</td>
                      <td className={m.type === 'in' ? 'movement-in' : 'movement-out'}>
                        {m.type}
                      </td>
                      <td>{m.quantity}</td>
                      <td>{m.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
