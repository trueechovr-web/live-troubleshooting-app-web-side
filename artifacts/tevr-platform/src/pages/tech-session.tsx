import { useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useWebRTC } from "@/hooks/useWebRTC";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function TechSession() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const roomCode = params.get("roomCode") ?? "";

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);

  const { isConnected, isMicOn, isCameraOn, toggleMic, toggleCamera } = useWebRTC({
    roomCode, role: "tech", remoteVideoRef, localVideoRef,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2 h-2 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground text-sm">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Live Support</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? "Connected" : "Waiting for admin…"}
            </span>
          </div>
          {roomCode && (
            <span className="hidden sm:block text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
              {roomCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            data-testid="tech-toggle-mic"
            onClick={toggleMic}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${isMicOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            title={isMicOn ? "Mute" : "Unmute"}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button
            data-testid="tech-toggle-camera"
            onClick={toggleCamera}
            className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${isCameraOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
            title={isCameraOn ? "Camera off" : "Camera on"}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </button>
          <ThemeToggle />
          <button
            data-testid="tech-leave-session"
            onClick={() => setLocation("/tech")}
            className="px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive text-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      <div className="relative flex-1 bg-black flex items-center justify-center">
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
            <div className="w-14 h-14 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
              <svg width="28" height="28" className="text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white/50 text-sm">Waiting for admin to join</p>
              {roomCode && <p className="text-white/30 text-xs mt-1 font-mono">{roomCode}</p>}
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
