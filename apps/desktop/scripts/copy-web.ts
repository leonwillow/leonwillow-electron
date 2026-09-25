import { cpSync, rmSync } from 'node:fs';

const source = new URL('../../web/.output/public/', import.meta.url);
const destination = new URL('../dist/renderer/', import.meta.url);

rmSync(destination, { recursive: true, force: true });
cpSync(source, destination, { recursive: true });
