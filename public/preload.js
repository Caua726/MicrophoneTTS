const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  saveAudio: (audioBuffer) => ipcRenderer.invoke('save-audio', audioBuffer),
  platform: () => ipcRenderer.invoke('get-platform'),
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),
  createVirtualMicrophone: () => ipcRenderer.invoke('create-virtual-microphone'),
  startAudioRouting: (options) => ipcRenderer.invoke('start-audio-routing', options),
  stopAudioRouting: () => ipcRenderer.invoke('stop-audio-routing')
}); 