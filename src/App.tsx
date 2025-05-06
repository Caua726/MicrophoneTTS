import React, { useState } from 'react';
import './App.css';
import AudioOutput from './components/AudioOutput';
import TextToSpeech from './components/TextToSpeech';

function App() {
  const [inputText, setInputText] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [isOutputActive, setIsOutputActive] = useState<boolean>(false);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Synthetic Voice App</h1>
      </header>
      <main>
        <div className="api-key-input">
          <label htmlFor="apiKey">OpenAI API Key:</label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your OpenAI API Key"
          />
        </div>

        <div className="container">
          <AudioOutput isActive={isOutputActive} setIsActive={setIsOutputActive} />

          <TextToSpeech 
            apiKey={apiKey} 
            isOutputActive={isOutputActive}
          />
        </div>
      </main>
    </div>
  );
}

export default App; 