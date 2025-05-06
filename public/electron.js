const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const url = require('url');
const { spawn, exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const isDev = process.env.NODE_ENV !== 'production';

let mainWindow;
let activeAudioProcess = null;
let activePactlModules = [];

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      devTools: isDev // Only enable DevTools in development mode
    },
    autoHideMenuBar: true, // Hide the menu bar
    frame: false // Remove window frame (including title bar)
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

  // Disable DevTools opening
  mainWindow.webContents.on('devtools-opened', () => {
    if (!isDev) {
      mainWindow.webContents.closeDevTools();
    }
  });

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
  unloadPactlModules();
});

// Helper to get platform
ipcMain.handle('get-platform', async () => {
  return process.platform;
});

// Check if a command is available
async function isCommandAvailable(command) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`where ${command}`, (error) => {
        resolve(!error);
      });
    } else {
      exec(`which ${command}`, (error) => {
        resolve(!error);
      });
    }
  });
}

// Get a list of audio devices on the system
ipcMain.handle('get-audio-devices', async () => {
  if (process.platform === 'linux') {
    try {
      // Try to get real PulseAudio devices
      const hasPactl = await isCommandAvailable('pactl');
      
      if (hasPactl) {
        return await getLinuxAudioDevices();
      }
    } catch (error) {
      console.error('Error getting Linux audio devices:', error);
    }
  }
  
  // Fallback to mock devices
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
  
  return mockDevices;
});

// Get Linux audio devices using pactl
async function getLinuxAudioDevices() {
  return new Promise((resolve, reject) => {
    exec('pactl list sinks short && pactl list sources short', (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      
      const lines = stdout.split('\n');
      const devices = [];
      
      lines.forEach(line => {
        if (!line.trim()) return;
        
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const id = parts[0];
          const name = parts[1];
          
          if (line.includes('list sinks')) {
            devices.push({ id, name, type: 'audiooutput' });
          } else {
            devices.push({ id, name, type: 'audioinput' });
          }
        }
      });
      
      resolve(devices);
    });
  });
}

// Check for TTS backends
ipcMain.handle('get-tts-backends', async () => {
  const backends = [
    { id: 'openai', name: 'OpenAI TTS', available: true }
  ];
  
  // Check for eSpeak
  const hasEspeak = await isCommandAvailable('espeak-ng');
  backends.push({ 
    id: 'espeak', 
    name: 'eSpeak NG', 
    available: hasEspeak 
  });

  return backends;
});

// Create a virtual microphone device
ipcMain.handle('create-virtual-microphone', async () => {
  try {
    if (process.platform === 'linux') {
      // For Linux, use PulseAudio (pactl) to create a virtual device
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

// Create a virtual microphone on Linux using pactl
function createLinuxVirtualMic() {
  return new Promise((resolve, reject) => {
    console.log('Creating virtual mic on Linux with PulseAudio...');
    
    // Check if pactl is available
    exec('which pactl', async (error) => {
      if (error) {
        resolve({
          success: false,
          error: 'pactl not found. Please install PulseAudio.'
        });
        return;
      }
      
      try {
        // Create a null sink
        const sinkResult = await runCommand('pactl load-module module-null-sink sink_name=VirtualSpeaker sink_properties=device.description="Virtual Speaker"');
        activePactlModules.push(sinkResult.trim());
        
        // Create a virtual source
        const sourceResult = await runCommand('pactl load-module module-virtual-source source_name=VirtualMic source_properties=device.description="Virtual Microphone"');
        activePactlModules.push(sourceResult.trim());
        
        // Create a loopback from the sink to the source
        const loopbackResult = await runCommand('pactl load-module module-loopback source=VirtualSpeaker.monitor sink=VirtualMic');
        activePactlModules.push(loopbackResult.trim());
        
        resolve({
          success: true,
          deviceId: 'VirtualMic',
          name: 'Virtual Microphone (PulseAudio)'
        });
      } catch (err) {
        console.error('Error creating PulseAudio virtual devices:', err);
        unloadPactlModules();
        resolve({
          success: false,
          error: `Failed to create PulseAudio virtual devices: ${err.message}`
        });
      }
    });
  });
}

// Helper to run a command and get its output
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

// Unload PulseAudio modules
function unloadPactlModules() {
  if (activePactlModules.length > 0) {
    activePactlModules.forEach(moduleId => {
      try {
        exec(`pactl unload-module ${moduleId}`);
      } catch (err) {
        console.error(`Error unloading module ${moduleId}:`, err);
      }
    });
    activePactlModules = [];
  }
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
    
    // For Linux, use PulseAudio to route audio
    if (process.platform === 'linux') {
      // In a real implementation, we'd need to create loopback modules
      // or adjust the existing modules to route to the selected device
      
      if (deviceId === 'VirtualMic') {
        // Our virtual mic is already set up with the loopback
        resolve({ success: true });
        return;
      }
      
      // For other mics, we'd need to adjust the routing
      exec(`pactl list short sources | grep ${deviceId}`, (error) => {
        if (error) {
          resolve({ 
            success: false, 
            error: `Microphone ${deviceId} not found`
          });
          return;
        }
        
        // In a full implementation, we'd set up the routing here
        resolve({ success: true });
      });
    } 
    // For Windows, you'd use the Windows audio API or third-party tools
    else if (process.platform === 'win32') {
      // Example: You might execute a utility here
      // activeAudioProcess = spawn('some-windows-tool', [...]);
      resolve({ success: true });
    } else {
      resolve({ success: true });
    }
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
    
    resolve();
  });
}

// Handle saving audio
ipcMain.handle('save-audio', async (event, audioBuffer) => {
  // Here you could add functionality to save the audio to a file if needed
  return { success: true };
});

// Generate speech using eSpeak
ipcMain.handle('generate-espeak', async (event, options) => {
  const { text, voice, outputPath } = options;
  const tempWavPath = path.join(os.tmpdir(), `espeak-output-${Date.now()}.wav`);
  
  return new Promise((resolve, reject) => {
    // Check if espeak-ng is available
    exec('which espeak-ng', (error) => {
      if (error) {
        resolve({
          success: false,
          error: 'eSpeak NG not found. Please install it first.'
        });
        return;
      }
      
      // Run espeak-ng to generate speech
      const espeakProcess = spawn('espeak-ng', [
        '-v', voice || 'en',
        '-w', tempWavPath,
        text
      ]);
      
      espeakProcess.on('close', (code) => {
        if (code !== 0) {
          resolve({
            success: false,
            error: `eSpeak process exited with code ${code}`
          });
          return;
        }
        
        // Read the generated audio file
        fs.readFile(tempWavPath, (err, data) => {
          if (err) {
            resolve({
              success: false,
              error: `Failed to read eSpeak output: ${err.message}`
            });
            return;
          }
          
          // Clean up temp file
          fs.unlink(tempWavPath, () => {});
          
          resolve({
            success: true,
            audioData: data.toString('base64')
          });
        });
      });
      
      espeakProcess.on('error', (err) => {
        resolve({
          success: false,
          error: `Failed to start eSpeak: ${err.message}`
        });
      });
    });
  });
});

// Window control functions
ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
}); 