import React, { useState } from 'react';
import './App.css';
import AudioOutput from './components/AudioOutput';
import TextToSpeech from './components/TextToSpeech';

function App() {
  const [apiKey, setApiKey] = useState<string>('');
  const [isOutputActive, setIsOutputActive] = useState<boolean>(false);

  // Handle window control buttons
  const handleMinimize = () => {
    if (window.electron) {
      window.electron.minimizeWindow();
    }
  };

  const handleClose = () => {
    if (window.electron) {
      window.electron.closeWindow();
    }
  };

  return (
    <>
      {/* Custom titlebar */}
      <div className="titlebar">
        <div className="titlebar-title">Synthetic Voice App</div>
        <div className="titlebar-controls">
          <button className="titlebar-button" onClick={handleMinimize}>_</button>
          <button className="titlebar-button close" onClick={handleClose}>✕</button>
        </div>
      </div>

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
    </>
  );
}

export default App; 