// Typed application errors that carry an HTTP status code and, for
// validation failures, the form field they map to on the frontend.
class AppError extends Error {
  constructor(statusCode, message, { field, details } = {}) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.field = field;
    this.details = details;
  }
}

const badRequest = (message, opts) => new AppError(400, message, opts);
const notFound = (message, opts) => new AppError(404, message, opts);
const conflict = (message, opts) => new AppError(409, message, opts);

module.exports = { AppError, badRequest, notFound, conflict };
