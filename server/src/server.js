import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { createApp } from './app.js';

async function bootstrap() {
  await connectDB(env.MONGODB_URI);
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    console.info(`AkashVault server running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal) => {
    console.info(`Received ${signal}. Closing server gracefully...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
