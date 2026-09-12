import { Pool } from 'pg';

const globalForDb = globalThis as unknown as { verificationPool?: Pool };
const pool = globalForDb.verificationPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== 'production') globalForDb.verificationPool = pool;

export { pool as verificationDb };
