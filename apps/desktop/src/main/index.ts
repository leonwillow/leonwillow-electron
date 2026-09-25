import { app, BrowserWindow, net, protocol } from 'electron';
import { stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const development = process.argv.includes('--dev');
const rendererUrl = development ? 'http://127.0.0.1:3000' : 'app://platform';
const rendererRoot = fileURLToPath(new URL('../renderer/', import.meta.url));

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

async function createWindow() {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    const url = new URL(target);
    const allowed = new URL(rendererUrl);
    if (url.protocol !== allowed.protocol || url.host !== allowed.host) event.preventDefault();
  });
  await window.loadURL(rendererUrl);
}

app.whenReady().then(async () => {
  if (!development) {
    protocol.handle('app', async (request) => {
      const url = new URL(request.url);
      if (url.host !== 'platform' || request.method !== 'GET') {
        return new Response('Not found', { status: 404 });
      }

      const path = resolve(rendererRoot, `.${decodeURIComponent(url.pathname)}`);
      const child = relative(rendererRoot, path);
      if (child.startsWith('..') || isAbsolute(child)) {
        return new Response('Forbidden', { status: 403 });
      }

      const file = await stat(path).catch(() => undefined);
      if (file?.isFile()) return net.fetch(pathToFileURL(path).href);
      if (request.headers.get('accept')?.includes('text/html')) {
        return net.fetch(pathToFileURL(resolve(rendererRoot, 'index.html')).href);
      }
      return new Response('Not found', { status: 404 });
    });
  }

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error: unknown) => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
