import express from 'express';
import ticketRoutes from './src/routes/ticket.routes.js';
import { errorMiddleware } from './src/middleware/error.middleware.js';

const app = express();

// Parse incoming JSON request bodies.
app.use(express.json());

// ---------------------------------------------------------------------------
// Health check endpoint
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Support Ticket AI is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use('/api/tickets', ticketRoutes);

// ---------------------------------------------------------------------------
// 404 handler — catches requests to undefined routes
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// ---------------------------------------------------------------------------
// Global error handler — must be registered LAST
// Express identifies it by its 4-argument signature (err, req, res, next)
// ---------------------------------------------------------------------------
app.use(errorMiddleware);

export default app;
