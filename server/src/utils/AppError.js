// An error we throw on purpose, with an HTTP status and a short machine-readable code.
// The central error handler turns it into a JSON response.
class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isExpected = true;
  }
}

// Shortcuts for the errors we use most often.
const badRequest = (code, message, details) => new AppError(400, code, message, details);
const unauthorized = (code = 'UNAUTHORIZED', message = 'Please log in.') => new AppError(401, code, message);
const forbidden = (code = 'FORBIDDEN', message = 'You are not allowed to do this.') => new AppError(403, code, message);
const notFound = (code = 'NOT_FOUND', message = 'Not found.') => new AppError(404, code, message);
const conflict = (code, message) => new AppError(409, code, message);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict };
