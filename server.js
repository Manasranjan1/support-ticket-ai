import dotenv from 'dotenv';
dotenv.config(); // Must be called before importing anything that reads env vars

import app from './app.js';
import { testConnection } from './src/config/database.js';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Verify the database is reachable before accepting any HTTP traffic.
    // If this throws, the process exits and the developer sees a clear error.
    await testConnection();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    // Exit with a non-zero code so process managers (PM2, Docker) know it crashed.
    process.exit(1);
  }
}

startServer();
