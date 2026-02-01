import { Request, Response, NextFunction } from 'express';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  // Log to console for dev
  if (process.env.NODE_ENV === 'development') {
    console.error(err);
  }

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    message = `Resource not found`;
    statusCode = 404;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    message = 'Duplicate field value entered';
    statusCode = 400;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((val: any) => val.message).join(', ');
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    error: message
  });
};

export default errorHandler;
