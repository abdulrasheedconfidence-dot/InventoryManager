const express = require('express');
const pool = require('../lib/db');
const asyncHandler = require('../lib/asyncHandler');
const { badRequest, conflict } = require('../lib/errors');

const router = express.Router();

const UNIQUE_VIOLATION = '23505';

function validateProductInput(body) {
  const { sku, name, reorder_threshold } = body;

  if (typeof sku !== 'string' || sku.trim() === '') {
    throw badRequest('SKU is required', { field: 'sku' });
  }
  if (typeof name !== 'string' || name.trim() === '') {
    throw badRequest('Name is required', { field: 'name' });
  }
  if (
    !Number.isInteger(reorder_threshold) ||
    reorder_threshold < 0
  ) {
    throw badRequest('Reorder threshold must be a non-negative integer', {
      field: 'reorder_threshold',
    });
  }

  return { sku: sku.trim(), name: name.trim(), reorder_threshold };
}

router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const { sku, name, reorder_threshold } = validateProductInput(req.body);

    try {
      const result = await pool.query(
        `INSERT INTO products (sku, name, reorder_threshold)
         VALUES ($1, $2, $3)
         RETURNING id, sku, name, reorder_threshold, created_at`,
        [sku, name, reorder_threshold]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === UNIQUE_VIOLATION) {
        throw conflict(`A product with SKU "${sku}" already exists`, {
          field: 'sku',
        });
      }
      throw err;
    }
  })
);

module.exports = router;
