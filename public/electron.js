const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const url = require('url');
const { spawn, exec } = require('child_process');
const os = require('os');
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;
let activeAudioProcess = null;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Set Content Security Policy - but only in production
  // In development, we need to allow eval for React hot reloading
  if (!isDev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; connect-src 'self' https://api.openai.com; style-src 'self' 'unsafe-inline';"
          ]
        }
      });
    });
  }

  // Load app
  const startUrl = isDev 
    ? 'http://localhost:3000'
    : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true
      });

  mainWindow.loadURL(startUrl);

  // Open DevTools in development mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // Clean up any virtual devices or processes when the app quits
  cleanupAudioRouting();
});

// Helper to get platform
ipcMain.handle('get-platform', async () => {
  return process.platform;
});

// Get a list of audio devices on the system
ipcMain.handle('get-audio-devices', async () => {
  // In a real implementation, you'd use native APIs to detect actual devices
  // This is a simplified mock implementation
  const mockDevices = [
    { id: 'default-speaker', name: 'Default Speaker', type: 'audiooutput' },
    { id: 'default-mic', name: 'Default Microphone', type: 'audioinput' },
  ];
  
  // Add platform-specific mocked devices
  if (process.platform === 'linux') {
    mockDevices.push(
      { id: 'pulse-out', name: 'PulseAudio Output', type: 'audiooutput' },
      { id: 'pulse-in', name: 'PulseAudio Input', type: 'audioinput' }
    );
  } else if (process.platform === 'win32') {
    mockDevices.push(
      { id: 'speakers', name: 'Speakers (High Definition Audio)', type: 'audiooutput' },
      { id: 'mic-array', name: 'Microphone Array (HD Audio)', type: 'audioinput' }
    );
  } else if (process.platform === 'darwin') {
    mockDevices.push(
      { id: 'mac-speakers', name: 'MacBook Pro Speakers', type: 'audiooutput' },
      { id: 'mac-mic', name: 'MacBook Pro Microphone', type: 'audioinput' }
    );
  }
  
  // Note: In a real implementation, you would use a native module or API to get the actual devices
  return mockDevices;
});

// Create a virtual microphone device
ipcMain.handle('create-virtual-microphone', async () => {
  try {
    if (process.platform === 'linux') {
      // For Linux, use PulseAudio to create a virtual device
      return createLinuxVirtualMic();
    } else if (process.platform === 'win32') {
      // For Windows, use VB-Cable or similar
      return createWindowsVirtualMic();
    } else {
      return {
        success: false,
        error: `Platform ${process.platform} is not supported for virtual microphone creation.`
      };
    }
  } catch (error) {
    console.error('Error creating virtual microphone:', error);
    return {
      success: false,
      error: `Failed to create virtual microphone: ${error.message}`
    };
  }
});

// Create a virtual microphone on Linux
function createLinuxVirtualMic() {
  return new Promise((resolve) => {
    // In a production app, you would use pactl or JACK to create a virtual device
    console.log('Creating virtual mic on Linux with PulseAudio...');
    
    // This is simplified - in production you would execute real commands:
    // For example: pactl load-module module-null-sink sink_name=VirtualMic sink_properties=device.description=VirtualMic
    
    setTimeout(() => {
      // Simulate success
      resolve({
        success: true,
        deviceId: 'virtual-mic-linux',
        name: 'Virtual Microphone (PulseAudio)'
      });
    }, 1000);
  });
}

// Create a virtual microphone on Windows
function createWindowsVirtualMic() {
  return new Promise((resolve) => {
    // In a production app, you would use the Windows Audio API
    console.log('Creating virtual mic on Windows...');
    
    // This is simplified - in production you would use proper Windows APIs
    
    setTimeout(() => {
      // Simulate success
      resolve({
        success: true,
        deviceId: 'virtual-mic-windows',
        name: 'Virtual Microphone (Windows)'
      });
    }, 1000);
  });
}

// Start audio routing to the selected device
ipcMain.handle('start-audio-routing', async (event, options) => {
  try {
    // Clean up any existing audio routing
    await cleanupAudioRouting();
    
    const { deviceId, outputType } = options;
    
    if (outputType === 'microphone') {
      // Route audio to the selected microphone
      return routeAudioToMicrophone(deviceId);
    } else {
      // Use the selected speaker
      return { success: true };
    }
  } catch (error) {
    console.error('Error starting audio routing:', error);
    return {
      success: false,
      error: `Failed to start audio routing: ${error.message}`
    };
  }
});

// Route audio to a microphone
function routeAudioToMicrophone(deviceId) {
  return new Promise((resolve) => {
    console.log(`Routing audio to microphone: ${deviceId}`);
    
    // In a real implementation, you would use platform-specific APIs
    // This is a simplified mock implementation
    
    // For Linux, you might use PulseAudio to route audio
    if (process.platform === 'linux') {
      // Example: You'd run pactl commands here
      // activeAudioProcess = spawn('pactl', [...]);
    } 
    // For Windows, you'd use the Windows audio API or third-party tools
    else if (process.platform === 'win32') {
      // Example: You might execute a utility here
      // activeAudioProcess = spawn('some-windows-tool', [...]);
    }
    
    setTimeout(() => {
      resolve({ success: true });
    }, 500);
  });
}

// Stop audio routing
ipcMain.handle('stop-audio-routing', async () => {
  try {
    await cleanupAudioRouting();
    return { success: true };
  } catch (error) {
    console.error('Error stopping audio routing:', error);
    return {
      success: false,
      error: `Failed to stop audio routing: ${error.message}`
    };
  }
});

// Clean up audio routing processes
function cleanupAudioRouting() {
  return new Promise((resolve) => {
    if (activeAudioProcess) {
      // Terminate the active audio process
      try {
        activeAudioProcess.kill();
      } catch (err) {
        console.error('Error killing audio process:', err);
      }
      activeAudioProcess = null;
    }
    
    // Additional platform-specific cleanup
    if (process.platform === 'linux') {
      // Example: You might need to run additional cleanup commands
      // exec('pactl unload-module module-loopback', ...);
    } else if (process.platform === 'win32') {
      // Windows-specific cleanup
    }
    
    resolve();
  });
}

// Handle saving audio (from original code)
ipcMain.handle('save-audio', async (event, audioBuffer) => {
  // Here you could add functionality to save the audio to a file if needed
  return { success: true };
}); 