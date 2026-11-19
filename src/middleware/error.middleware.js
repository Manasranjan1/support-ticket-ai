// ---------------------------------------------------------------------------
// error.middleware.js
//
// Global Express error handler.
// Any error passed to next(error) in a controller lands here.
//
// Express identifies a function as an error handler by its 4-argument signature:
// (err, req, res, next). Do not remove the unused `next` parameter.
// ---------------------------------------------------------------------------

export function errorMiddleware(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log the full error server-side so it's visible in the terminal
  console.error('❌ Unhandled error:', err);

  // PostgreSQL throws errors with a `code` property (e.g. '22P02' for invalid UUID).
  // We handle a few common ones with friendlier messages.
  if (err.code === '22P02') {
    // Invalid UUID format in a query parameter
    return res.status(400).json({
      status: 'error',
      message: 'Invalid ID format. Must be a valid UUID.',
    });
  }

  if (err.code === '23505') {
    // Unique constraint violation (not expected in Phase 1 but good to have)
    return res.status(409).json({
      status: 'error',
      message: 'A record with this value already exists.',
    });
  }

  // Default: 500 Internal Server Error
  // In production (NODE_ENV=production), hide the internal error message from the client.
  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    status: 'error',
    message,
  });
}
