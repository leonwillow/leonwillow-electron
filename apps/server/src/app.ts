import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { test } from './modules/test';

export function createApp(origins: string[]) {
  return new Elysia()
    .use(cors({ origin: origins, methods: ['GET'], credentials: false }))
    .use(test);
}
