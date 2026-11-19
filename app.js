import express from 'express';

const app = express();

// Parse incoming JSON request bodies.
// This is required for POST/PATCH endpoints that accept JSON payloads.
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check endpoint
// ---------------------------------------------------------------------------
// A simple endpoint that returns a 200 OK response with server status info.
// Used to verify the server is running (Postman, deployment health checks, etc.)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Support Ticket AI is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ---------------------------------------------------------------------------
// 404 handler — catches any request to a route that does not exist
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

export default app;
