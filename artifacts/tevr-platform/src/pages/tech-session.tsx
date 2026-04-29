import { useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useWebRTC } from "@/hooks/useWebRTC";

export default function TechSession() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const roomCode = params.get("roomCode") ?? "";
  const sessionId = params.get("sessionId") ?? "";

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const { isConnected, isMicOn, isCameraOn, toggleMic, toggleCamera } = useWebRTC({
    roomCode,
    role: "tech",
    remoteVideoRef,
    localVideoRef,
  });

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div
        className="flex items-center justify-between px-6 py-3 border-b z-10"
        style={{ borderColor: "rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.8)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-white" />
          </div>
          <span className="font-mono text-sm font-bold">TEVR</span>
          <span className="text-white/50 font-mono text-xs">/ Live Support</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-white/30"}`} />
            <span className="text-xs font-mono text-white/60">
              {isConnected ? "CONNECTED" : "Waiting for admin..."}
            </span>
          </div>
          {roomCode && (
            <span className="text-xs font-mono text-white/40">
              Room: <span className="text-blue-400">{roomCode}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            data-testid="tech-toggle-mic"
            onClick={toggleMic}
            className={`p-2 rounded-lg transition-colors ${isMicOn ? "bg-blue-600 text-white" : "bg-white/10 text-white/50 hover:text-white"}`}
            title={isMicOn ? "Mute" : "Unmute"}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button
            data-testid="tech-toggle-camera"
            onClick={toggleCamera}
            className={`p-2 rounded-lg transition-colors ${isCameraOn ? "bg-blue-600 text-white" : "bg-white/10 text-white/50 hover:text-white"}`}
            title={isCameraOn ? "Camera off" : "Camera on"}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </button>
          <button
            data-testid="tech-leave-session"
            onClick={() => setLocation("/tech")}
            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-mono hover:bg-red-500/10 transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center">
        <video
          ref={remoteVideoRef}
          data-testid="tech-remote-video"
          autoPlay
          playsInline
          className="w-full h-full object-contain"
          style={{ maxHeight: "calc(100vh - 57px)" }}
        />
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center">
              <svg width="36" height="36" className="text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white/50 font-mono text-sm">Waiting for admin to join</p>
              <p className="text-white/30 font-mono text-xs mt-1">Room: {roomCode}</p>
            </div>
          </div>
        )}
        {isCameraOn && (
          <div className="absolute bottom-4 left-4 w-32 h-24 rounded-lg overflow-hidden border border-white/20 shadow-xl">
            <video ref={localVideoRef} data-testid="tech-local-video" autoPlay playsInline muted className="w-full h-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}
