const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveAudio: (audioBuffer) => ipcRenderer.invoke('save-audio', audioBuffer),
  platform: () => ipcRenderer.invoke('get-platform'),
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  createVirtualMicrophone: () => ipcRenderer.invoke('create-virtual-microphone'),
  startAudioRouting: (options) => ipcRenderer.invoke('start-audio-routing', options),
  stopAudioRouting: () => ipcRenderer.invoke('stop-audio-routing'),
  getTtsBackends: () => ipcRenderer.invoke('get-tts-backends'),
  generateEspeak: (options) => ipcRenderer.invoke('generate-espeak', options),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window')
}); 