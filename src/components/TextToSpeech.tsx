import React, { useState, useRef } from 'react';
import OpenAI from 'openai';

// Use the same ElectronAPI interface and type assertion if needed
interface ElectronAPI {
  saveAudio: (audioBuffer: any) => Promise<{success: boolean}>;
}

// Access the electron API with type assertion when needed
const electronAPI = window.electron as ElectronAPI;

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
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const voiceOptions = [
    { value: 'alloy', label: 'Alloy' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'onyx', label: 'Onyx' },
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' }
  ];

  const generateSpeech = async () => {
    if (!apiKey) {
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
      const audioBlob = await response.blob();
      
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
    } catch (err) {
      console.error('Speech generation error:', err);
      setError('Error generating speech. Please check your API key and try again.');
    } finally {
      setIsGenerating(false);
    }
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
            disabled={isGenerating || !apiKey || !isOutputActive}
            className="text-input"
          />
          <button 
            type="submit"
            disabled={isGenerating || !text || !apiKey || !isOutputActive}
            className="send-button"
          >
            {isGenerating ? 'Generating...' : 'Send'}
          </button>
        </div>
      </form>
      
      <div className="voice-selector">
        <label htmlFor="voiceModel">Select Voice:</label>
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
      </div>
      
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded}
        style={{ display: 'none' }}
      />
      
      <p className="help-text">
        {!apiKey ? 'Enter your OpenAI API key to generate speech' : 
         !isOutputActive ? 'Start the audio output first' :
         'Type your text and click "Send" to convert to speech'}
      </p>
    </div>
  );
};

export default TextToSpeech; 