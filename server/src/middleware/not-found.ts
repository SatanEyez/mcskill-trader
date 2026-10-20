import type { RequestHandler } from 'express';

export const notFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { message: `Маршрут ${req.method} ${req.originalUrl} не найден` },
  });
};
