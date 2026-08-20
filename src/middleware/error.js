// Catches errors thrown/passed via next(err) anywhere in the app and
// returns a consistent JSON shape instead of leaking a stack trace.
const errorHandler = (err, req, res, next) => {
  console.error(err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server error';
  let errors;

  // Prisma: record not found (e.g. .findUniqueOrThrow, or an update/delete on a missing id)
  if (err.code === 'P2025') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Prisma: unique constraint violation (e.g. duplicate email)
  if (err.code === 'P2002') {
    statusCode = 400;
    const fields = err.meta?.target?.join(', ') || 'field';
    message = `Duplicate value for: ${fields}`;
  }

  // Prisma: foreign key constraint failed (e.g. requestorId pointing nowhere)
  if (err.code === 'P2003') {
    statusCode = 400;
    message = 'Related record not found';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
  });
};

module.exports = errorHandler;
