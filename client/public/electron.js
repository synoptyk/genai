const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'GENAI360',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Required for some legacy node integrations if any
      webviewTag: true, // IMPORTANT: Allows us to embed the "Web Browser" module
      webSecurity: false // Disabling to avoid CORS when fetching external content in the desktop app if needed
    }
  });

  // Cargar la aplicación React
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Abrir enlaces externos (target="_blank") en el navegador real del usuario (Chrome/Safari) en lugar de dentro de Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Si la URL es de genai, dejamos que se maneje internamente (o si es el webview)
    if (url.includes('genai.cl')) {
      return { action: 'allow' };
    }
    // Si no, lo abrimos en el navegador externo predeterminado
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  // En macOS es común que la aplicación y su barra de menú sigan activas hasta que el usuario salga explícitamente (Cmd + Q)
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // En macOS es común volver a crear una ventana en la aplicación cuando el icono del dock es pulsado y no hay otras ventanas abiertas
  if (mainWindow === null) {
    createWindow();
  }
});
