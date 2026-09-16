import { Link, useParams } from 'react-router-dom';

export default function ProductDetailPage() {
  const { id } = useParams();

  return (
    <div className="page">
      <p>
        <Link to="/">&larr; Back to products</Link>
      </p>
      <h1>Product #{id}</h1>
      <p className="status">Product detail page coming soon.</p>
    </div>
  );
}
