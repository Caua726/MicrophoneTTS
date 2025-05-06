# Voz Sintetica - Synthetic Voice App

This is an Electron and React application that converts text to speech using OpenAI's TTS API and routes the audio to either your system microphone or speakers.

## Features

- Create virtual microphone devices on Linux (using PulseAudio) and Windows
- Select output device: route to microphone or play on speakers
- Convert text to synthetic speech using OpenAI's Text-to-Speech API
- Multiple voice options (Alloy, Echo, Fable, Onyx, Nova, Shimmer)
- Simple and intuitive interface

## Prerequisites

- Node.js (v14 or later)
- npm
- An OpenAI API key with access to the Audio API
- For Linux: PulseAudio installed
- For Windows: Administrative privileges (for creating virtual devices)

## Installation

1. Clone this repository
2. Install dependencies:
```
npm install --legacy-peer-deps
```

## Configuration

You'll need an OpenAI API key to use this application. The API key can be entered directly in the application.

The app supports two primary methods of audio output:

1. **Speaker Output**: Play the synthesized speech directly through your computer's speakers
2. **Microphone Routing**: Send the audio to a selected microphone (real or virtual)

## Virtual Microphone Creation

The app can create virtual microphone devices on supported platforms:

- **Linux**: Uses PulseAudio to create a virtual audio sink and source
- **Windows**: Creates a virtual audio device using the Windows Audio API

## Running the App

### Development mode

```
npm run electron:start
```

### Building for production

```
npm run electron:build
```

This will create distributable packages for your platform in the `dist` folder.

## Usage Instructions

1. Launch the application
2. Enter your OpenAI API key in the input field
3. Choose your preferred output method (speaker or microphone)
4. If using microphone output:
   - Select an existing microphone or click "Create Virtual Microphone" to create a new one
   - The app will detect your platform and create an appropriate virtual device
5. Click "Start Audio Output" to begin audio routing
6. Type your text in the input box
7. Select a voice from the dropdown menu
8. Click "Send" to generate and play the synthetic speech
9. The audio will play through your selected output device

## Implementation Details

### Linux Implementation

On Linux, the app uses PulseAudio commands to:
- Create a virtual sink (`pactl load-module module-null-sink`)
- Create a virtual source (`pactl load-module module-virtual-source`)
- Set up loopback routing (`pactl load-module module-loopback`)

### Windows Implementation

On Windows, the app creates a virtual audio device using the Windows Core Audio API.

## License

ISC # MicrophoneTTS
