import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env, isProduction } from './config/env.js';
import { getDb } from './db/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFound } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoryRouter } from './modules/categories/category.routes.js';
import { importRouter } from './modules/import/import.routes.js';
import { newsRouter } from './modules/news/news.routes.js';
import { presenceRouter } from './modules/presence/presence.routes.js';
import { prefixRouter, roleRouter } from './modules/rbac/access.routes.js';
import { resourceRouter } from './modules/resources/resource.routes.js';
import { statsRouter } from './modules/stats/stats.routes.js';
import { supportRouter } from './modules/support/support.routes.js';
import { tradeRouter } from './modules/trade/trade.routes.js';
import { uploadRouter } from './modules/uploads/upload.routes.js';
import {
  UPLOADS_DIR,
  UPLOADS_URL_PREFIX,
  findUploadedFile,
} from './modules/uploads/upload.storage.js';
import { userRouter } from './modules/users/user.routes.js';
import { asyncHandler } from './utils/async-handler.js';

const clientDist = fileURLToPath(new URL('../../client/dist/', import.meta.url));
const allowedOrigins = env.CLIENT_ORIGIN.split(',').map((origin) => origin.trim());

export function createApp(): Express {
  const app = express();

  // Render (и любой другой reverse-proxy) терминирует TLS и добавляет
  // X-Forwarded-For. Без этого req.ip — адрес самого прокси, поэтому
  // express-rate-limit считал бы всех посетителей одним клиентом и общий
  // лимит в 20 неудачных входов блокировал бы вход всем сразу.
  if (isProduction) app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: isProduction ? allowedOrigins : true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86_400,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);

  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      const db = await getDb();
      await db.query('SELECT 1');

      res.json({
        status: 'ok',
        database: 'mysql',
        uptime: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
      });
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/roles', roleRouter);
  app.use('/api/prefixes', prefixRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/categories', categoryRouter);
  app.use('/api/resources', resourceRouter);
  app.use('/api/trade', tradeRouter);
  app.use('/api/uploads', uploadRouter);
  app.use('/api/import', importRouter);
  app.use('/api/support', supportRouter);
  app.use('/api/news', newsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/presence', presenceRouter);
  app.use('/api', notFound);

  // Иконки прайса лежат в git и отдаются статикой (и в dev, и в проде:
  // Vite проксирует /uploads на API). Остальные загрузки — из базы.
  app.use(
    UPLOADS_URL_PREFIX,
    express.static(UPLOADS_DIR, {
      index: false,
      maxAge: isProduction ? '30d' : 0,
      immutable: isProduction,
    }),
  );

  // Иконки, загруженные импортом, лежат в базе: на Render диск эфемерный.
  app.get(
    `${UPLOADS_URL_PREFIX}/prices/:file`,
    asyncHandler(async (req, res) => {
      const name = req.params.file ?? '';

      if (!/^\d{5}\.png$/.test(name)) {
        res.status(404).json({ error: { message: 'Файл не найден' } });
        return;
      }

      const db = await getDb();
      const result = await db.query<{ data: Buffer }>(
        'SELECT data FROM price_icons WHERE name = ?',
        [name],
      );
      const row = result.rows[0];

      if (!row) {
        res.status(404).json({ error: { message: 'Файл не найден' } });
        return;
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(row.data);
    }),
  );

  app.get(
    `${UPLOADS_URL_PREFIX}/:file`,
    asyncHandler(async (req, res) => {
      const file = await findUploadedFile(req.params.file ?? '');

      if (!file) {
        res.status(404).json({ error: { message: 'Файл не найден' } });
        return;
      }

      res.setHeader('Content-Type', file.mime);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(file.data);
    }),
  );

  if (existsSync(clientDist)) {
    app.use(
      express.static(clientDist, {
        index: false,
        maxAge: isProduction ? '1d' : 0,
        immutable: isProduction,
      }),
    );

    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(join(clientDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({
        service: 'McSkill Trader API',
        message: 'Frontend не собран. Запустите npm run dev или npm run build.',
      });
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
