import { useState } from 'react';
import { createProduct, ApiError } from '../api';

function validate({ sku, name, reorderThreshold }) {
  const errors = {};

  if (!sku.trim()) {
    errors.sku = 'SKU is required';
  }
  if (!name.trim()) {
    errors.name = 'Name is required';
  }

  const thresholdNum = Number(reorderThreshold);
  if (
    reorderThreshold.trim() === '' ||
    !Number.isInteger(thresholdNum) ||
    thresholdNum < 0
  ) {
    errors.reorder_threshold = 'Reorder threshold must be a non-negative integer';
  }

  return errors;
}

export default function AddProductModal({ onClose, onCreated }) {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [reorderThreshold, setReorderThreshold] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const errors = validate({ sku, name, reorderThreshold });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const product = await createProduct({
        sku: sku.trim(),
        name: name.trim(),
        reorder_threshold: Number(reorderThreshold),
      });
      onCreated(product);
    } catch (err) {
      if (err instanceof ApiError && err.field) {
        setFieldErrors({ [err.field]: err.message });
      } else {
        setFormError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-product-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-product-title">Add product</h2>

        {formError && <p className="modal-error">{formError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="sku">SKU</label>
            <input
              id="sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              autoFocus
              aria-invalid={Boolean(fieldErrors.sku)}
              aria-describedby={fieldErrors.sku ? 'sku-error' : undefined}
            />
            {fieldErrors.sku && (
              <p id="sku-error" className="field-error">
                {fieldErrors.sku}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            />
            {fieldErrors.name && (
              <p id="name-error" className="field-error">
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="field">
            <label htmlFor="reorder_threshold">Reorder threshold</label>
            <input
              id="reorder_threshold"
              type="number"
              min="0"
              step="1"
              value={reorderThreshold}
              onChange={(e) => setReorderThreshold(e.target.value)}
              aria-invalid={Boolean(fieldErrors.reorder_threshold)}
              aria-describedby={
                fieldErrors.reorder_threshold ? 'reorder-threshold-error' : undefined
              }
            />
            {fieldErrors.reorder_threshold && (
              <p id="reorder-threshold-error" className="field-error">
                {fieldErrors.reorder_threshold}
              </p>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
