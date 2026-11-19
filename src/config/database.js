import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create a single connection pool that is reused across the application.
// Using a pool (rather than individual Client connections) is best practice
// for Express servers — it manages multiple concurrent DB connections efficiently.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Supabase requires SSL. rejectUnauthorized: false means we encrypt the
    // connection but skip strict certificate chain verification.
    // The connection is still fully encrypted — this only skips CA validation.
    rejectUnauthorized: false,
  },
});

// Convenience wrapper so the rest of the app calls db.query() instead of
// importing the pool directly. This keeps things simple and testable.
export const db = {
  query: (text, params) => pool.query(text, params),
};

// Called once at startup to verify the database connection is working.
// If this fails, the server will not start.
export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
  } finally {
    // Always release the client back to the pool, even if an error occurred.
    client.release();
  }
}
