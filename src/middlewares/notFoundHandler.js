const AppError = require('../errors/AppError');

function notFoundHandler(req, res, next) {
  next(new AppError(404, 'ROUTE_NOT_FOUND', 'Route not found.'));
}

module.exports = notFoundHandler;
