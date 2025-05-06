import React, { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';

// Use the same ElectronAPI interface and type assertion if needed
interface ElectronAPI {
  saveAudio: (audioBuffer: any) => Promise<{success: boolean}>;
  getTtsBackends: () => Promise<Array<{id: string, name: string, available: boolean}>>;
  generateEspeak: (options: {text: string, voice: string}) => Promise<{success: boolean, audioData?: string, error?: string}>;
}

interface TTSBackend {
  id: string;
  name: string;
  available: boolean;
}

// Safely access the electron API with checks for availability
const getElectronAPI = (): ElectronAPI | undefined => {
  if (typeof window !== 'undefined' && window.electron) {
    return window.electron as ElectronAPI;
  }
  return undefined;
};

interface TextToSpeechProps {
  apiKey: string;
  isOutputActive: boolean;
}

const TextToSpeech: React.FC<TextToSpeechProps> = ({ apiKey, isOutputActive }) => {
  const [text, setText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceModel, setVoiceModel] = useState<string>('alloy');
  const [ttsBackend, setTtsBackend] = useState<string>('openai');
  const [availableBackends, setAvailableBackends] = useState<TTSBackend[]>([
    { id: 'openai', name: 'OpenAI TTS', available: true }
  ]);
  const [espeakVoice, setEspeakVoice] = useState<string>('en');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // OpenAI voice options
  const voiceOptions = [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' }
  ];

  // eSpeak voice options
  const espeakVoiceOptions = [
    { value: 'en', label: 'English' },
    { value: 'en-us', label: 'English (US)' },
    { value: 'en-gb', label: 'English (UK)' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ru', label: 'Russian' }
  ];

  // Check for available TTS backends when component mounts
  useEffect(() => {
    async function checkTtsBackends() {
      try {
        const electronAPI = getElectronAPI();
        if (electronAPI) {
          const backends = await electronAPI.getTtsBackends();
          setAvailableBackends(backends);
          
          // If OpenAI is not available (no API key) but eSpeak is available, default to eSpeak
          if (!apiKey && backends.find(b => b.id === 'espeak' && b.available)) {
            setTtsBackend('espeak');
          }
        }
      } catch (err) {
        console.warn('Error checking TTS backends:', err);
      }
    }
    
    checkTtsBackends();
  }, [apiKey]);

  const generateSpeech = async () => {
    if (ttsBackend === 'openai' && !apiKey) {
      setError('Please enter your OpenAI API key first.');
      return;
    }

    if (!text.trim()) {
      setError('Please enter text to convert to speech.');
      return;
    }

    if (!isOutputActive) {
      setError('Please start the audio output first.');
      return;
    }

    try {
      setError(null);
      setIsGenerating(true);

      let audioBlob: Blob;

      if (ttsBackend === 'openai') {
        // Use OpenAI for speech generation
        audioBlob = await generateOpenAISpeech();
      } else if (ttsBackend === 'espeak') {
        // Use eSpeak NG for speech generation
        audioBlob = await generateEspeakSpeech();
      } else {
        throw new Error(`Unknown TTS backend: ${ttsBackend}`);
      }

      // Create an object URL for the audio blob
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      
      audioUrlRef.current = URL.createObjectURL(audioBlob);
      
      // Set the audio source
      if (audioRef.current) {
        audioRef.current.src = audioUrlRef.current;
        // Play automatically after generation
        playAudio();
      }

      // Optionally save the audio using the Electron API if available
      try {
        const electronAPI = getElectronAPI();
        if (electronAPI) {
          // Create an ArrayBuffer from the Blob to send to Electron
          const arrayBuffer = await audioBlob.arrayBuffer();
          await electronAPI.saveAudio(arrayBuffer);
        }
      } catch (err) {
        console.warn('Could not save audio through Electron:', err);
        // Non-critical error, no need to show to user
      }
    } catch (err) {
      console.error('Speech generation error:', err);
      setError(`Error generating speech: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate speech using OpenAI's API
  const generateOpenAISpeech = async (): Promise<Blob> => {
    const openai = new OpenAI({
      apiKey: apiKey,
      dangerouslyAllowBrowser: true // Enable API calls from browser
    });

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voiceModel,
      input: text
    });

    // Convert the response to an audio blob
    return await response.blob();
  };

  // Generate speech using eSpeak NG
  const generateEspeakSpeech = async (): Promise<Blob> => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      throw new Error('Electron API not available');
    }

    const result = await electronAPI.generateEspeak({
      text: text,
      voice: espeakVoice
    });

    if (!result.success || !result.audioData) {
      throw new Error(result.error || 'Failed to generate speech with eSpeak');
    }

    // Convert base64 to Blob
    const binaryString = atob(result.audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: 'audio/wav' });
  };

  const playAudio = () => {
    if (audioRef.current && audioUrlRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateSpeech();
  };

  // Handle TTS backend change
  const handleBackendChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTtsBackend(e.target.value);
  };

  return (
    <div className="text-to-speech-container">
      <h2>Text to Speech</h2>
      {error && <p className="error">{error}</p>}
      
      <form onSubmit={handleSubmit} className="text-input-form">
        <div className="text-input-container">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your text here"
            disabled={isGenerating || (ttsBackend === 'openai' && !apiKey) || !isOutputActive}
            className="text-input"
          />
          <button 
            type="submit"
            disabled={isGenerating || !text || (ttsBackend === 'openai' && !apiKey) || !isOutputActive}
            className="send-button"
          >
            {isGenerating ? 'Generating...' : 'Send'}
          </button>
        </div>
      </form>
      
      <div className="tts-options">
        {/* TTS Backend Selector */}
        <div className="backend-selector">
          <label htmlFor="ttsBackend">TTS Engine:</label>
          <select
            id="ttsBackend"
            value={ttsBackend}
            onChange={handleBackendChange}
            disabled={isGenerating}
          >
            {availableBackends.map(backend => (
              <option 
                key={backend.id} 
                value={backend.id}
                disabled={!backend.available}
              >
                {backend.name} {!backend.available ? '(Not Available)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Voice selection based on backend */}
        <div className="voice-selector">
          <label htmlFor="voiceModel">
            {ttsBackend === 'openai' ? 'OpenAI Voice:' : 'eSpeak Voice:'}
          </label>
          
          {ttsBackend === 'openai' ? (
            <select 
              id="voiceModel" 
              value={voiceModel}
              onChange={(e) => setVoiceModel(e.target.value)}
              disabled={isGenerating}
            >
              {voiceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <select 
              id="espeakVoice" 
              value={espeakVoice}
              onChange={(e) => setEspeakVoice(e.target.value)}
              disabled={isGenerating}
            >
              {espeakVoiceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded}
        style={{ display: 'none' }}
      />
      
      <p className="help-text">
        {ttsBackend === 'openai' && !apiKey ? 'Enter your OpenAI API key to generate speech' : 
         !isOutputActive ? 'Start the audio output first' :
         `Type your text and click "Send" to convert to speech using ${ttsBackend === 'openai' ? 'OpenAI' : 'eSpeak NG'}`}
      </p>

      {ttsBackend === 'espeak' && (
        <p className="note">
          eSpeak NG is a free and open-source TTS engine that runs locally without internet connection.
        </p>
      )}
    </div>
  );
};

export default TextToSpeech; 