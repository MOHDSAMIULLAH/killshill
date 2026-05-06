// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  const body = {
    success: false,
    message: err.message || 'Internal server error',
  };

  if (err.errors) {
    body.errors = err.errors;
  }

  if (process.env.NODE_ENV !== 'production') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}

module.exports = errorHandler;
