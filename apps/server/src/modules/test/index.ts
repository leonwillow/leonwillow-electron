import { Elysia } from 'elysia';
import { testResponse } from './model';

export const test = new Elysia({ name: 'test' })
  .get('/test', () => ({ message: 'test' } as const), { response: testResponse });
