import React, { useState, useRef } from 'react';
import OpenAI from 'openai';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  apiKey: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscription, apiKey }) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      setError(null);
      audioChunksRef.current = [];
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        transcribeAudio(audioBlob);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      setError('Error accessing microphone. Please check permissions.');
      console.error('Error accessing microphone:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop all tracks of the stream
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    if (!apiKey) {
      setError('Please enter your OpenAI API key first.');
      return;
    }

    try {
      setIsTranscribing(true);
      
      // Create a File object from the Blob
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      
      // Send to OpenAI for transcription
      const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Enable API calls from browser
      });
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1'
      });
      
      if (transcription.text) {
        onTranscription(transcription.text);
      } else {
        setError('No transcription returned.');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Error transcribing audio. Please check your API key and try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="voice-controls">
      <h2>Voice Recorder</h2>
      {error && <p className="error">{error}</p>}
      
      <div className="controls">
        <button 
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing || !apiKey}
        >
          {isRecording ? 'Stop Recording' : 'Start Recording'}
          {isRecording && <span className="recording-indicator"></span>}
        </button>
        
        {isTranscribing && <p>Transcribing...</p>}
      </div>
      
      <p className="help-text">
        {!apiKey ? 'Enter your OpenAI API key to start recording' : 'Click the button to start recording your voice'}
      </p>
    </div>
  );
};

export default VoiceRecorder; 