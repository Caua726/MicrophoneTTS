import React, { useEffect, useState } from 'react';

// Define the ElectronAPI interface locally for use with type assertions
interface ElectronAPI {
  platform: () => Promise<string>;
  getAudioDevices: () => Promise<Array<{id: string, name: string, type: string}>>;
  createVirtualMicrophone: () => Promise<{success: boolean, deviceId?: string, error?: string}>;
  startAudioRouting: (options: {deviceId: string, outputType: 'microphone' | 'speaker'}) => Promise<{success: boolean, error?: string}>;
  stopAudioRouting: () => Promise<{success: boolean, error?: string}>;
}

// Safely access the electron API with checks for availability
const getElectronAPI = (): ElectronAPI | undefined => {
  if (window.electron) {
    return window.electron as ElectronAPI;
  }
  return undefined;
};

interface AudioOutputProps {
  isActive: boolean;
  setIsActive: (active: boolean) => void;
}

interface AudioDevice {
  id: string;
  name: string;
  type: string;
}

const AudioOutput: React.FC<AudioOutputProps> = ({ isActive, setIsActive }) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [outputType, setOutputType] = useState<'microphone' | 'speaker'>('microphone');
  const [virtualMicCreated, setVirtualMicCreated] = useState<boolean>(false);
  const [electronAvailable, setElectronAvailable] = useState<boolean>(false);

  // Detect OS
  const [platform, setPlatform] = useState<string>('unknown');

  useEffect(() => {
    // Check if electron API is available
    const electronAPI = getElectronAPI();
    if (electronAPI) {
      setElectronAvailable(true);
      
      // Detect platform through Electron
      electronAPI.platform().then((plat: string) => {
        setPlatform(plat);
      }).catch(err => {
        console.error('Error getting platform:', err);
        setPlatform('unknown');
      });

      // Fetch available audio devices
      loadAudioDevices();
    } else {
      console.warn('Electron API not available. Running in development/browser mode.');
      setElectronAvailable(false);
      // Add some mock devices for development
      setAudioDevices([
        { id: 'mock-speaker', name: 'Mock Speaker', type: 'audiooutput' },
        { id: 'mock-mic', name: 'Mock Microphone', type: 'audioinput' }
      ]);
    }
  }, []);

  const loadAudioDevices = async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      setError('Electron API not available.');
      return;
    }

    try {
      setLoading(true);
      const devices = await electronAPI.getAudioDevices();
      setAudioDevices(devices);
      setLoading(false);
    } catch (err) {
      console.error('Error getting audio devices:', err);
      setError('Failed to get audio devices.');
      setLoading(false);
    }
  };

  const createVirtualMicrophone = async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      setError('Electron API not available.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await electronAPI.createVirtualMicrophone();
      
      if (result.success) {
        setVirtualMicCreated(true);
        await loadAudioDevices(); // Reload devices to include the new one
        
        if (result.deviceId) {
          setSelectedDeviceId(result.deviceId);
        }
      } else {
        setError(result.error || 'Failed to create virtual microphone.');
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error creating virtual microphone:', err);
      setError('Error creating virtual microphone. This may require special system permissions.');
      setLoading(false);
    }
  };

  const toggleAudioOutput = async () => {
    const electronAPI = getElectronAPI();
    
    if (!electronAvailable) {
      // In development mode, just toggle the state
      setIsActive(!isActive);
      return;
    }
    
    if (!electronAPI) {
      setError('Electron API not available.');
      return;
    }

    try {
      if (isActive) {
        // Stop routing audio
        await electronAPI.stopAudioRouting();
        setIsActive(false);
      } else {
        // Start routing audio to selected device
        const result = await electronAPI.startAudioRouting({
          deviceId: selectedDeviceId,
          outputType: outputType
        });
        
        if (result.success) {
          setIsActive(true);
        } else {
          setError(result.error || 'Failed to start audio routing.');
        }
      }
    } catch (err) {
      console.error('Error toggling audio routing:', err);
      setError('Error accessing audio devices. This may require special system permissions.');
    }
  };

  return (
    <div className="voice-controls">
      <h2>Audio Output Configuration</h2>
      {error && <p className="error">{error}</p>}
      {!electronAvailable && (
        <p className="warning">Running in development mode. Electron features are simulated.</p>
      )}
      
      <div className="device-selection">
        <div className="output-type-selector">
          <label>
            <input 
              type="radio" 
              value="microphone" 
              checked={outputType === 'microphone'} 
              onChange={() => setOutputType('microphone')}
              disabled={isActive}
            />
            Route to Microphone
          </label>
          <label>
            <input 
              type="radio" 
              value="speaker" 
              checked={outputType === 'speaker'} 
              onChange={() => setOutputType('speaker')}
              disabled={isActive}
            />
            Play on Speaker
          </label>
        </div>
        
        {outputType === 'microphone' && (
          <>
            <label htmlFor="deviceSelect">Select Microphone Device:</label>
            <select 
              id="deviceSelect"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={isActive || loading}
            >
              <option value="default">Default Device</option>
              {audioDevices
                .filter(device => device.type === 'audioinput')
                .map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
            </select>
            
            <button 
              onClick={createVirtualMicrophone}
              disabled={isActive || loading || virtualMicCreated || !electronAvailable}
              className="secondary-button"
            >
              {loading ? 'Creating...' : 'Create Virtual Microphone'}
            </button>
            
            {virtualMicCreated && (
              <p className="success-message">Virtual microphone created successfully!</p>
            )}
            
            {platform && platform !== 'unknown' && (
              <p className="platform-info">
                Detected platform: {platform}
                {platform === 'linux' ? ' (using PulseAudio)' : 
                 platform === 'win32' ? ' (using Windows Audio API)' : ''}
              </p>
            )}
          </>
        )}
        
        {outputType === 'speaker' && (
          <>
            <label htmlFor="speakerSelect">Select Speaker Device:</label>
            <select 
              id="speakerSelect"
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={isActive || loading}
            >
              <option value="default">Default Device</option>
              {audioDevices
                .filter(device => device.type === 'audiooutput')
                .map(device => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
            </select>
          </>
        )}
      </div>
      
      <div className="controls">
        <button 
          onClick={toggleAudioOutput}
          className={isActive ? 'active' : ''}
          disabled={loading}
        >
          {isActive ? 'Stop Audio Output' : 'Start Audio Output'}
          {isActive && <span className="recording-indicator"></span>}
        </button>
      </div>
      
      <p className="help-text">
        {outputType === 'microphone' ? 
          (isActive ? 'Audio will be routed to selected microphone' : 'Click to start routing audio to selected microphone') :
          (isActive ? 'Audio will be played on selected speaker' : 'Click to start playing audio on selected speaker')
        }
      </p>
      <p className="note">
        {outputType === 'microphone' ? 
          `Note: Virtual microphone creation requires system permissions. On ${platform === 'linux' ? 'Linux' : 'Windows'}, this will use ${platform === 'linux' ? 'PulseAudio/JACK' : 'Windows Audio API'}.` :
          'Note: Speaker playback uses your system audio output.'
        }
      </p>
    </div>
  );
};

export default AudioOutput; 