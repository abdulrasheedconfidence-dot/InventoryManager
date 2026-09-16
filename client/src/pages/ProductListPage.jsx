import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchProducts } from '../api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import AddProductModal from '../components/AddProductModal';

function ProductRow({ product }) {
  const isLowStock = product.stock <= product.reorder_threshold;

  return (
    <tr className={isLowStock ? 'low-stock-row' : undefined}>
      <td>
        <Link to={`/products/${product.id}`}>{product.sku}</Link>
      </td>
      <td>{product.name}</td>
      <td>
        {product.stock}
        {isLowStock && <span className="low-stock-badge">Low stock</span>}
      </td>
      <td>{product.reorder_threshold}</td>
    </tr>
  );
}

export default function ProductListPage() {
  const [searchInput, setSearchInput] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const debouncedSearch = useDebouncedValue(searchInput, 300);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetchProducts({
      search: debouncedSearch.trim(),
      lowStock: lowStockOnly,
      signal: controller.signal,
    })
      .then((data) => {
        setProducts(data);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => controller.abort();
  }, [debouncedSearch, lowStockOnly, refreshIndex]);

  const isFiltered = debouncedSearch.trim() !== '' || lowStockOnly;

  function handleProductCreated() {
    setIsAddModalOpen(false);
    setRefreshIndex((i) => i + 1);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Products</h1>
        <button type="button" className="primary" onClick={() => setIsAddModalOpen(true)}>
          Add product
        </button>
      </div>

      <div className="toolbar">
        <input
          type="search"
          placeholder="Search by name or SKU..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search products"
        />
        <label className="toggle">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
          />
          Low stock only
        </label>
      </div>

      {isLoading && <p className="status">Loading products...</p>}

      {!isLoading && error && (
        <p className="status status-error">Couldn't load products: {error}</p>
      )}

      {!isLoading && !error && products && products.length === 0 && (
        <p className="status">
          {isFiltered ? 'No results match your search.' : 'No products yet.'}
        </p>
      )}

      {!isLoading && !error && products && products.length > 0 && (
        <table className="products-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Current stock</th>
              <th>Reorder threshold</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <ProductRow key={product.id} product={product} />
            ))}
          </tbody>
        </table>
      )}

      {isAddModalOpen && (
        <AddProductModal
          onClose={() => setIsAddModalOpen(false)}
          onCreated={handleProductCreated}
        />
      )}
    </div>
  );
}
