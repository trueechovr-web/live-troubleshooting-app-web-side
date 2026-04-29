# True Echo VR — Unity WebRTC Integration Guide

This package contains Unity C# scripts to connect a Meta Quest headset to the TEVR platform for live video/audio streaming.

## Requirements

- Unity 2022.3 LTS or later
- Meta XR SDK (from Meta's developer portal)
- Unity WebRTC package (com.unity.webrtc): version 3.0.0-pre.8 or later
- Meta Quest 2, 3, or Pro

## Installation

### 1. Install the Unity WebRTC Package

1. Open Unity Package Manager (Window > Package Manager)
2. Click the **+** button and choose **Add package by name**
3. Enter: `com.unity.webrtc`
4. Select version `3.0.0-pre.8` or later

### 2. Install NativeWebSocket (for signaling)

1. In Package Manager, click **+** > **Add package from git URL**
2. Enter: `https://github.com/endel/NativeWebSocket.git#upm`

### 3. Copy Scripts to Your Project

Copy all `.cs` files from this folder into your Unity project's `Assets/TEVR/` directory.

### 4. Configure the Scene

1. Create an empty GameObject and name it `TEVRManager`
2. Attach the `TEVRStreamingManager` component to it
3. Set the **Server URL** field in the Inspector to your server URL:
   - Development: `https://your-replit-url.replit.dev`
   - Production (AWS): `https://your-domain.com`
4. Set the **Room Code** field (provided by the admin when they start a session)

### 5. Build Settings

1. Set **Platform** to **Android**
2. Set **Texture Compression** to **ASTC**
3. Enable **Custom Main Gradle Template** and add these permissions to AndroidManifest.xml:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
```

4. Build and sideload with:

```bash
adb install -r YourApp.apk
```

## Architecture

```
Meta Quest (Unity)
    └── Camera + Mic capture
    └── TEVRStreamingManager
        └── WebRTC peer connection (video + audio)
        └── Socket.io signaling via WebSocket
            └── TEVR Server (Express + Socket.io)
                └── WebRTC relay/signaling
                └── Admin Web Browser
                    └── Live video feed display
```

## Data Flow

1. Admin opens the TEVR web app and selects a headset to connect
2. Server creates a session with a `roomCode`
3. Technician puts on the Quest headset and opens the app
4. Tech enters or scans the room code
5. Unity app connects to the signaling server via WebSocket
6. WebRTC negotiation happens (offer/answer/ICE candidates)
7. Live video and audio stream from Quest → Admin browser
8. Two-way audio (and optionally admin camera) streams back to Quest

## Troubleshooting

- **Black screen**: Check that the camera permission is granted in Android settings
- **No audio**: Check microphone permission
- **Can't connect**: Verify the server URL is reachable and `/socket.io/` path is accessible
- **Connection drops**: On restricted networks, a TURN server may be required (contact TEVR support)
