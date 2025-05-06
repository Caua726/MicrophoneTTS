interface ElectronAPI {
  platform: () => Promise<string>;
  getAudioDevices: () => Promise<Array<{id: string, name: string, type: string}>>;
  createVirtualMicrophone: () => Promise<{success: boolean, deviceId?: string, error?: string}>;
  startAudioRouting: (options: {deviceId: string, outputType: 'microphone' | 'speaker'}) => Promise<{success: boolean, error?: string}>;
  stopAudioRouting: () => Promise<{success: boolean, error?: string}>;
  saveAudio: (audioBuffer: any) => Promise<{success: boolean}>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {}; 