/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  globalShortcut,
  ipcRenderer,
  protocol,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

const querystring = require('querystring');
const axios = require('axios');

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug')();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  // Default shortcuts
  const isMac = process.platform === 'darwin';

  // Define default shortcuts based on platform
  let shortcuts = {
    nextTrack: isMac ? 'Command+3' : 'Ctrl+3',
    playTrack: isMac ? 'Command+5' : 'Ctrl+5',
    pauseTrack: isMac ? 'Command+4' : 'Ctrl+4',
    VolumeDown: isMac ? 'Command+1' : 'Ctrl+1',
    VolumeUP: isMac ? 'Command+2' : 'Ctrl+2',
  };

  // Register initial shortcuts
  registerShortcuts(shortcuts);

  // Listen for changes in shortcuts from renderer
  ipcMain.on('set-shortcuts', (_, newShortcuts) => {
    console.log(_, newShortcuts);

    // Unregister old shortcuts
    unregisterShortcuts(shortcuts);
    shortcuts = newShortcuts;
    // Register new shortcuts
    registerShortcuts(shortcuts);
  });

  // Fetch current shortcuts
  ipcMain.on('get-shortcuts', () => {
    mainWindow.webContents.send('current-shortcuts', JSON.stringify(shortcuts));
  });
  ipcMain.on('login', (url) => {
    console.log('Testing', url);

    shell.openExternal(
      `${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=${SCOPES}&response_type=token&show_dialog=true`,
    );
  });

  function registerShortcuts(shortcuts) {
    globalShortcut.register(shortcuts.nextTrack, () => {
      mainWindow.webContents.send('nextTrack', 'Test');
    });
    globalShortcut.register(shortcuts.playTrack, () => {
      mainWindow.webContents.send('playTrack', 'Test');
    });
    globalShortcut.register(shortcuts.pauseTrack, () => {
      mainWindow.webContents.send('pauseTrack', 'Test');
    });
    globalShortcut.register(shortcuts.VolumeUP, () => {
      mainWindow.webContents.send('VolumeUP', 'Test');
    });
    globalShortcut.register(shortcuts.VolumeDown, () => {
      mainWindow.webContents.send('VolumeDown', 'Test');
    });
  }

  function unregisterShortcuts(shortcuts) {
    if (globalShortcut.isRegistered(shortcuts.nextTrack)) {
      globalShortcut.unregister(shortcuts.nextTrack);
    }
    if (globalShortcut.isRegistered(shortcuts.playTrack)) {
      globalShortcut.unregister(shortcuts.playTrack);
    }
    if (globalShortcut.isRegistered(shortcuts.pauseTrack)) {
      globalShortcut.unregister(shortcuts.pauseTrack);
    }
    if (globalShortcut.isRegistered(shortcuts.VolumeDown)) {
      globalShortcut.unregister(shortcuts.VolumeDown);
    }
    if (globalShortcut.isRegistered(shortcuts.VolumeUP)) {
      globalShortcut.unregister(shortcuts.VolumeUP);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
const isSecondInstance = app.requestSingleInstanceLock();
// Prevent multiple instances of the app
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }

    // Handle the custom protocol URL if it was passed as a command line argument
    const url = commandLine.find((arg) => arg.startsWith('myapp://'));
    if (url) {
      handleCustomProtocol(url);
    }
  });

  app
    .whenReady()
    .then(() => {
      // Register the custom protocol early, before OAuth request
      app.setAsDefaultProtocolClient('myapp'); // Register the protocol

      // Create the window once the app is ready
      createWindow();

      // Handle the custom protocol
      protocol.registerHttpProtocol('myapp', (request) => {
        const url = request.url;
        handleCustomProtocol(url);
      });

      // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
      app.on('activate', () => {
        if (mainWindow === null) createWindow();
      });
    })
    .catch(console.log);
}

const handleCustomProtocol = (url) => {
  const parsedUrl = new URL(url);
  console.log('Custom protocol URL:', parsedUrl);

  const hashParams = new URLSearchParams(parsedUrl.hash.substring(1)); // Remove the leading "#"
  const accessToken = hashParams.get('access_token');
  const expiresIn = hashParams.get('expires_in');

  if (accessToken) {
    console.log('🎯 Token received:', accessToken);

    // Send the access token and expiration info to the renderer process (front-end)
    mainWindow?.webContents.send('spotify-auth-success', accessToken);
  } else {
    console.log('No access token found.');
  }
};
