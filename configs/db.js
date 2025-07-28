/**
 *------------------------------------------------------------------
 * db.js is the database configuration file that:
 * 1. Creates Neon connection
 * 2. Used by controllers and routes
 *------------------------------------------------------------------
 */

// Import Neon
import { neon } from '@neondatabase/serverless';

// Create Neon connection
const sql = neon(process.env.DATABASE_URL);

// Export Neon connection
export default sql;
