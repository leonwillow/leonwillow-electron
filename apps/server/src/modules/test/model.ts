import { t } from 'elysia';

export const testResponse = t.Object({
  message: t.Literal('test'),
});
