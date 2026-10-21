import { createServer } from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { closeDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { ensureBootstrapAdmin } from './modules/auth/bootstrap.js';
import { closeChatSocket, initChatSocket } from './modules/chat/chat.socket.js';
import { logger } from './utils/logger.js';

async function bootstrap(): Promise<void> {
  logger.info('Запуск McSkill Trader API…');

  await runMigrations();
  await ensureBootstrapAdmin();

  if (env.SEED_ON_START) {
    const result = await seedDatabase();
    if (result.skipped) {
      logger.info('В базе уже есть ресурсы — сидирование пропущено');
    }
  }

  const app = createApp();
  const server = createServer(app);
  initChatSocket(server);

  server.listen(env.PORT, () => {
    logger.ready(`API доступно: http://localhost:${env.PORT}/api`);
    if (env.NODE_ENV === 'development') {
      logger.info(`Админка: http://localhost:5173/admin`);
    }
  });

  let shuttingDown = false;

  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.warn(`Получен ${signal}, завершаем работу…`);

    const forceExit = setTimeout(() => {
      logger.error('Принудительное завершение: сервер не остановился за 10 секунд');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    // Сначала отпускаем WebSocket-подключения чата, иначе server.close ждёт их.
    closeChatSocket();

    server.close(() => {
      void closeDb()
        .catch((error) => logger.error('Ошибка при закрытии БД:', error))
        .finally(() => {
          clearTimeout(forceExit);
          process.exit(0);
        });
    });

    // Keep-alive соединения браузера не дают server.close() завершиться —
    // закрываем их, чтобы процесс остановился без ожидания таймаутов.
    server.closeIdleConnections();

    const forceConnections = setTimeout(() => {
      server.closeAllConnections();
    }, 2_000);
    forceConnections.unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Необработанный Promise rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Необработанное исключение:', error);
    shutdown('uncaughtException');
  });
}

bootstrap().catch((error) => {
  logger.error('Не удалось запустить сервер:', error);
  process.exit(1);
});
