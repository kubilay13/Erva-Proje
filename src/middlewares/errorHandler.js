function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message =
    statusCode === 500 && !err.isOperational
      ? 'Unexpected error occurred.'
      : err.message;

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
}

module.exports = errorHandler;
