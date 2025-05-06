const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron', {
    saveAudio: (audioBuffer) => ipcRenderer.invoke('save-audio', audioBuffer),
    platform: () => ipcRenderer.invoke('get-platform'),
    getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
    createVirtualMicrophone: () => ipcRenderer.invoke('create-virtual-microphone'),
    startAudioRouting: (options) => ipcRenderer.invoke('start-audio-routing', options),
    stopAudioRouting: () => ipcRenderer.invoke('stop-audio-routing')
  }
);

// Expose any other APIs that will be needed in the renderer 