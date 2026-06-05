// Market Bubble Chat — Electron desktop wrapper.
//
// Launches the local backend (ingestors + WS + config API on :4000) and the web
// app (Next on :3000) as child processes, then opens a window on the Setup page.
// Everything stays local; OBS on the same PC loads http://localhost:3000/overlay.

const { app, BrowserWindow, shell, Menu } = require('electron');
const { spawn } = require('node:child_process');
const path = require('node:path');
const http = require('node:http');
const treeKill = require('tree-kill');

const ROOT = path.resolve(__dirname, '..');
const WEB_PORT = Number(process.env.MB_WEB_PORT || 3000);
const API_PORT = Number(process.env.MB_API_PORT || 4000);

const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

// Market Bubble logo as the window / taskbar icon.
const APP_ICON = path.join(__dirname, isWin ? 'marketbubble.ico' : 'marketbubble.png');
if (isWin) app.setAppUserModelId('com.marketbubble.chat');

let win = null;
const children = [];

function run(label, cwd, env) {
  const child = spawn(npm, ['run', 'start'], {
    cwd,
    env: { ...process.env, ...env },
    shell: isWin, // resolve npm.cmd on Windows
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${label}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${label}] ${d}`));
  child.on('exit', (code) => console.log(`[${label}] exited (${code})`));
  children.push(child);
  return child;
}

function waitForPort(port, timeoutMs = 90000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/' }, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error(`port ${port} never came up`));
        else setTimeout(attempt, 600);
      });
    };
    attempt();
  });
}

async function startup() {
  Menu.setApplicationMenu(null);

  // macOS: set the dock icon (the window `icon` option is Windows/Linux only).
  if (process.platform === 'darwin' && app.dock) {
    try {
      app.dock.setIcon(path.join(__dirname, 'marketbubble.png'));
    } catch {
      /* best-effort */
    }
  }

  win = new BrowserWindow({
    width: 1200,
    height: 880,
    minWidth: 880,
    backgroundColor: '#0a0a0b',
    title: 'Market Bubble Chat',
    icon: APP_ICON,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true },
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Pop-out chat → its own contained app window (no menu, chat-sized).
    if (url.includes('/chat')) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 460,
          height: 820,
          minWidth: 280,
          minHeight: 320,
          backgroundColor: '#0a0a0b',
          frame: false, // no OS title bar — drag via the top strip, close via the in-app ✕
          autoHideMenuBar: true,
          title: 'Market Bubble Chat',
          icon: APP_ICON,
        },
      };
    }
    // External links (cashtag / polymarket) open in the real browser.
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadFile(path.join(__dirname, 'loading.html'));

  // Start backend + web (local production servers).
  run('server', path.join(ROOT, 'server'), { PORT: String(API_PORT) });
  run('web', path.join(ROOT, 'web'), { PORT: String(WEB_PORT) });

  try {
    await waitForPort(WEB_PORT);
    await win.loadURL(`http://localhost:${WEB_PORT}/`);
  } catch (err) {
    console.error('startup failed:', err);
    win.webContents.executeJavaScript(
      `document.body.innerHTML = '<div style="color:#e8b339;font-family:monospace;padding:40px">Failed to start. Make sure you ran <b>npm run app</b> (which builds the web first). Details in the terminal.</div>'`,
    );
  }
}

app.whenReady().then(startup);

app.on('window-all-closed', () => app.quit());

// Tear down child processes on quit (tree-kill gets grandchildren too).
app.on('quit', () => {
  for (const c of children) {
    if (c.pid) {
      try {
        treeKill(c.pid);
      } catch {
        /* ignore */
      }
    }
  }
});
