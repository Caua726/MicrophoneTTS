import React, { useState, useRef } from 'react';
import OpenAI from 'openai';

interface SyntheticVoiceProps {
  text: string;
  apiKey: string;
}

const SyntheticVoice: React.FC<SyntheticVoiceProps> = ({ text, apiKey }) => {
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
      setError('No text to convert to speech.');
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

  return (
    <div className="synthetic-voice-controls">
      <h2>Synthetic Voice</h2>
      {error && <p className="error">{error}</p>}
      
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
      
      <div className="controls">
        <button 
          onClick={generateSpeech}
          disabled={isGenerating || !text || !apiKey}
        >
          {isGenerating ? 'Generating...' : 'Generate Speech'}
        </button>
        
        <button 
          onClick={playAudio}
          disabled={isGenerating || !audioUrlRef.current || isPlaying}
        >
          Play Audio
        </button>
      </div>
      
      <audio 
        ref={audioRef} 
        onEnded={handleAudioEnded}
        style={{ display: 'none' }}
      />
      
      <p className="help-text">
        {!apiKey ? 'Enter your OpenAI API key to generate speech' : 
          !text ? 'Record your voice first to get text for speech synthesis' : 
          'Click Generate Speech to convert the text to audio'}
      </p>
    </div>
  );
};

export default SyntheticVoice; 