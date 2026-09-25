import { createApp } from './app';

const origins = (
  process.env.CORS_ORIGINS ??
  'http://127.0.0.1:3000,http://localhost:3000,app://platform'
).split(',').map((origin) => origin.trim());

const app = createApp(origins).listen({
  hostname: process.env.HOST ?? '127.0.0.1',
  port: Number(process.env.PORT ?? 3001),
});

console.log(`Elysia: ${app.server?.url}test`);
