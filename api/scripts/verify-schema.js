// Verifies that the expected tables, constraints, and index exist.
// Usage: node scripts/verify-schema.js
require("dotenv").config();
const { Client } = require("pg");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set. Add it to your .env file.");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('products', 'movements')
      ORDER BY table_name
    `);
    console.log("Tables:", tables.rows.map((r) => r.table_name));

    const constraints = await client.query(`
      SELECT tc.table_name, tc.constraint_type, tc.constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public' AND tc.table_name IN ('products', 'movements')
      ORDER BY tc.table_name, tc.constraint_type
    `);
    console.log("\nConstraints:");
    for (const row of constraints.rows) {
      console.log(`  ${row.table_name}: ${row.constraint_type} (${row.constraint_name})`);
    }

    const indexes = await client.query(`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'movements'
    `);
    console.log("\nIndexes on movements:");
    for (const row of indexes.rows) {
      console.log(`  ${row.indexname}: ${row.indexdef}`);
    }

    const uniqueSku = constraints.rows.some(
      (r) => r.table_name === "products" && r.constraint_type === "UNIQUE"
    );
    const hasProductIdIndex = indexes.rows.some((r) =>
      r.indexdef.includes("product_id")
    );

    console.log("\n--- Summary ---");
    console.log("products table:", tables.rows.some((r) => r.table_name === "products") ? "OK" : "MISSING");
    console.log("movements table:", tables.rows.some((r) => r.table_name === "movements") ? "OK" : "MISSING");
    console.log("sku UNIQUE constraint:", uniqueSku ? "OK" : "MISSING");
    console.log("product_id index:", hasProductIdIndex ? "OK" : "MISSING");
  } catch (err) {
    console.error("Verification failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
