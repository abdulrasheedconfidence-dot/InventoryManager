const express = require('express');
const pool = require('../lib/db');
const asyncHandler = require('../lib/asyncHandler');
const { badRequest, conflict, notFound } = require('../lib/errors');

const router = express.Router();

const UNIQUE_VIOLATION = '23505';

function parseProductId(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id)) {
    throw badRequest('Invalid product id', { field: 'id' });
  }
  return id;
}

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

const STOCK_EXPRESSION = `COALESCE(SUM(CASE WHEN m.type = 'in' THEN m.quantity WHEN m.type = 'out' THEN -m.quantity ELSE 0 END), 0)::int`;

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { search, lowStock } = req.query;
    const params = [];

    let whereClause = '';
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length}`;
    }

    const havingClause = lowStock === 'true'
      ? `HAVING ${STOCK_EXPRESSION} <= p.reorder_threshold`
      : '';

    const sql = `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.reorder_threshold,
        p.created_at,
        ${STOCK_EXPRESSION} AS stock
      FROM products p
      LEFT JOIN movements m ON m.product_id = p.id
      ${whereClause}
      GROUP BY p.id
      ${havingClause}
      ORDER BY p.name
    `;

    const result = await pool.query(sql, params);
    res.json(result.rows);
  })
);

router.get(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);

    const [productResult, movementsResult] = await Promise.all([
      pool.query(
        `SELECT
           p.id, p.sku, p.name, p.reorder_threshold, p.created_at,
           ${STOCK_EXPRESSION} AS stock
         FROM products p
         LEFT JOIN movements m ON m.product_id = p.id
         WHERE p.id = $1
         GROUP BY p.id`,
        [id]
      ),
      pool.query(
        `SELECT id, product_id, type, quantity, note, created_at
         FROM movements
         WHERE product_id = $1
         ORDER BY created_at DESC`,
        [id]
      ),
    ]);

    if (productResult.rowCount === 0) {
      throw notFound(`Product ${id} not found`, { field: 'id' });
    }

    res.json({
      ...productResult.rows[0],
      movements: movementsResult.rows,
    });
  })
);

function validateMovementInput(body) {
  const { type, quantity, note } = body;

  if (type !== 'in' && type !== 'out') {
    throw badRequest("Type must be 'in' or 'out'", { field: 'type' });
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw badRequest('Quantity must be a positive integer', { field: 'quantity' });
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    throw badRequest('Note must be a string', { field: 'note' });
  }

  return { type, quantity, note: note ?? null };
}

router.post(
  '/products/:id/movements',
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);
    const { type, quantity, note } = validateMovementInput(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Locks the product row so a concurrent 'out' movement for the same
      // product has to wait for this transaction to commit or roll back
      // before it can read stock or insert its own movement.
      const productResult = await client.query(
        'SELECT id FROM products WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (productResult.rowCount === 0) {
        throw notFound(`Product ${id} not found`, { field: 'id' });
      }

      const stockResult = await client.query(
        `SELECT ${STOCK_EXPRESSION} AS stock
         FROM products p
         LEFT JOIN movements m ON m.product_id = p.id
         WHERE p.id = $1
         GROUP BY p.id`,
        [id]
      );
      const currentStock = stockResult.rows[0].stock;

      if (type === 'out' && quantity > currentStock) {
        throw conflict(`Only ${currentStock} available`, {
          field: 'quantity',
          details: { available: currentStock },
        });
      }

      const insertResult = await client.query(
        `INSERT INTO movements (product_id, type, quantity, note)
         VALUES ($1, $2, $3, $4)
         RETURNING id, product_id, type, quantity, note, created_at`,
        [id, type, quantity, note]
      );

      await client.query('COMMIT');
      res.status(201).json(insertResult.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

router.get(
  '/products/:id/stock',
  asyncHandler(async (req, res) => {
    const id = parseProductId(req.params.id);

    const result = await pool.query(
      `SELECT ${STOCK_EXPRESSION} AS stock
       FROM products p
       LEFT JOIN movements m ON m.product_id = p.id
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );

    if (result.rowCount === 0) {
      throw notFound(`Product ${id} not found`, { field: 'id' });
    }

    res.json({ stock: result.rows[0].stock });
  })
);

module.exports = router;
