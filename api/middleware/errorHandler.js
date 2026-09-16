const { AppError } = require("../lib/errors");

// Must be registered last, after all routes. Express recognizes it as an
// error handler because it declares four parameters.
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.field !== undefined && { field: err.field }),
        ...(err.details !== undefined && { details: err.details }),
      },
    });
  }

  console.error(err);
  res.status(500).json({
    error: { message: "Internal server error" },
  });
}

module.exports = errorHandler;
