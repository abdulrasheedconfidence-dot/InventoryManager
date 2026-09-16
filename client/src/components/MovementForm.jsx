import { useState } from 'react';
import { createMovement, ApiError } from '../api';

function validate({ type, quantity }) {
  const errors = {};

  if (type !== 'in' && type !== 'out') {
    errors.type = "Type must be 'in' or 'out'";
  }

  const quantityNum = Number(quantity);
  if (
    quantity.trim() === '' ||
    !Number.isInteger(quantityNum) ||
    quantityNum <= 0
  ) {
    errors.quantity = 'Quantity must be a positive integer';
  }

  return errors;
}

export default function MovementForm({ productId, onRecorded }) {
  const [type, setType] = useState('in');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    const errors = validate({ type, quantity });
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await createMovement(productId, {
        type,
        quantity: Number(quantity),
        note: note.trim() || undefined,
      });
      setQuantity('');
      setNote('');
      onRecorded();
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
    <form className="movement-form" onSubmit={handleSubmit} noValidate>
      <h2>Record movement</h2>

      {formError && <p className="modal-error">{formError}</p>}

      <div className="movement-form-row">
        <div className="field">
          <label htmlFor="movement-type">Type</label>
          <select
            id="movement-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="in">In</option>
            <option value="out">Out</option>
          </select>
          {fieldErrors.type && <p className="field-error">{fieldErrors.type}</p>}
        </div>

        <div className="field">
          <label htmlFor="movement-quantity">Quantity</label>
          <input
            id="movement-quantity"
            type="number"
            min="1"
            step="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={Boolean(fieldErrors.quantity)}
            aria-describedby={fieldErrors.quantity ? 'movement-quantity-error' : undefined}
          />
          {fieldErrors.quantity && (
            <p id="movement-quantity-error" className="field-error">
              {fieldErrors.quantity}
            </p>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="movement-note">Note (optional)</label>
        <input
          id="movement-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <button type="submit" className="primary" disabled={isSubmitting}>
        {isSubmitting ? 'Recording...' : 'Record movement'}
      </button>
    </form>
  );
}
