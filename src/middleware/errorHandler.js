const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}]`, err.message);
  if (process.env.NODE_ENV === 'development') console.error(err.stack);

  if (err.code === '23505') {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || 'field';
    return res.status(409).json({ success: false, message: `${field} already exists.` });
  }
  if (err.code === '23503') return res.status(400).json({ success: false, message: 'Referenced record not found.' });
  if (err.name === 'ValidationError') return res.status(400).json({ success: false, message: err.message });

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { notFound, errorHandler, asyncHandler };
