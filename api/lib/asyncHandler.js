// Wraps an async route handler so a rejected promise is forwarded to
// Express's error-handling middleware instead of being swallowed.
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
