import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetSession, useListMessages, useSendMessage, useEndSession, getListMessagesQueryKey } from "@workspace/api-client-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useQueryClient } from "@tanstack/react-query";

const POINT_TO_OBJECTS = [
  "Fire Extinguisher",
  "Control Panel",
  "Emergency Exit",
  "Junction Box",
  "Safety Valve",
  "Power Switch",
  "Circuit Breaker",
  "Warning Label",
];

export default function AdminSession() {
  const [, params] = useRoute("/admin/session/:sessionId");
  const [, setLocation] = useLocation();
  const sessionId = params?.sessionId ?? "";
  const queryClient = useQueryClient();

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  const [messageInput, setMessageInput] = useState("");
  const [volume, setVolume] = useState(80);
  const [pointingTo, setPointingTo] = useState("");
  const [pointToConfirm, setPointToConfirm] = useState("");

  const session = useGetSession(sessionId, { query: { enabled: !!sessionId } });
  const messages = useListMessages(sessionId, {
    query: {
      enabled: !!sessionId,
      queryKey: getListMessagesQueryKey(sessionId),
      refetchInterval: 2000,
    },
  });
  const sendMessage = useSendMessage();
  const endSession = useEndSession();

  const roomCode = session.data?.roomCode ?? "";

  const { isConnected, toggleMic, toggleCamera, isMicOn, isCameraOn, sendPointTo } = useWebRTC({
    roomCode,
    role: "admin",
    remoteVideoRef,
    localVideoRef,
  });

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = volume / 100;
    }
  }, [volume]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim()) return;
    sendMessage.mutate(
      { sessionId, data: { senderRole: "admin", content: messageInput.trim() } },
      {
        onSuccess: () => {
          setMessageInput("");
          queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(sessionId) });
        },
      }
    );
  }, [messageInput, sessionId, sendMessage, queryClient]);

  const handlePointTo = useCallback((obj: string) => {
    setPointingTo(obj);
    sendPointTo(obj);
    setPointToConfirm(`Pointing to: ${obj}`);
    setTimeout(() => setPointToConfirm(""), 3000);
  }, [sendPointTo]);

  const handleEndSession = useCallback(() => {
    endSession.mutate({ sessionId }, { onSuccess: () => setLocation("/admin/troubleshoot") });
  }, [sessionId, endSession, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-troubleshoot"
            onClick={() => setLocation("/admin/troubleshoot")}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-primary-foreground" />
          </div>
          <span className="font-mono font-bold">TEVR</span>
          <span className="text-muted-foreground font-mono text-sm">/ Live Session</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-xs font-mono text-muted-foreground">
              {isConnected ? "LIVE" : session.isLoading ? "Loading..." : "Connecting..."}
            </span>
          </div>
          {session.data && (
            <span className="text-xs font-mono text-muted-foreground">
              Room: <span className="text-primary">{session.data.roomCode}</span>
            </span>
          )}
          <button
            data-testid="end-session"
            onClick={handleEndSession}
            disabled={endSession.isPending}
            className="text-xs font-mono px-3 py-1.5 rounded border border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
          >
            End Session
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="relative flex-1 bg-black flex items-center justify-center min-h-0">
            <video
              ref={remoteVideoRef}
              data-testid="remote-video"
              autoPlay
              playsInline
              muted={false}
              className="w-full h-full object-contain"
            />
            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                  <svg width="32" height="32" className="text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <p className="text-muted-foreground font-mono text-sm">Waiting for headset to connect...</p>
                <p className="text-xs font-mono text-muted-foreground/60">Room code: <span className="text-primary">{roomCode}</span></p>
              </div>
            )}
            {isCameraOn && (
              <div className="absolute bottom-4 right-4 w-40 h-28 rounded-lg overflow-hidden border-2 border-border shadow-xl">
                <video
                  ref={localVideoRef}
                  data-testid="local-video"
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="border-t border-border bg-card px-6 py-4 flex items-center gap-6 shrink-0">
            <button
              data-testid="toggle-mic"
              onClick={toggleMic}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                isMicOn
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isMicOn ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  </>
                )}
              </svg>
              {isMicOn ? "Mic On" : "Mic Off"}
            </button>

            <button
              data-testid="toggle-camera"
              onClick={toggleCamera}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono transition-colors ${
                isCameraOn
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              {isCameraOn ? "Camera On" : "Camera Off"}
            </button>

            <div className="flex items-center gap-3 flex-1 max-w-48">
              <svg width="16" height="16" className="text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
              <input
                type="range"
                data-testid="volume-slider"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 accent-primary"
              />
              <span className="text-xs font-mono text-muted-foreground w-8">{volume}%</span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <select
                data-testid="point-to-select"
                value={pointingTo}
                onChange={(e) => handlePointTo(e.target.value)}
                className="bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Point To...</option>
                {POINT_TO_OBJECTS.map((obj) => (
                  <option key={obj} value={obj}>{obj}</option>
                ))}
              </select>
              {pointToConfirm && (
                <span className="text-xs font-mono text-primary animate-pulse">{pointToConfirm}</span>
              )}
            </div>
          </div>
        </div>

        <div className="w-80 border-l border-border flex flex-col bg-card shrink-0">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Messages</h3>
            <p className="text-xs text-muted-foreground font-mono">
              {session.data?.headsetLabel ?? "Headset"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
            {messages.isLoading ? (
              <p className="text-xs text-muted-foreground font-mono text-center">Loading...</p>
            ) : messages.data?.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono text-center">No messages yet</p>
            ) : (
              messages.data?.map((msg) => (
                <div
                  key={msg.id}
                  data-testid={`message-${msg.id}`}
                  className={`flex flex-col gap-1 ${msg.senderRole === "admin" ? "items-end" : "items-start"}`}
                >
                  <span className="text-xs font-mono text-muted-foreground capitalize">{msg.senderRole}</span>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm max-w-full break-words ${
                      msg.senderRole === "admin"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-border flex gap-2 shrink-0">
            <input
              type="text"
              data-testid="message-input"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-muted border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              data-testid="send-message"
              onClick={handleSendMessage}
              disabled={sendMessage.isPending || !messageInput.trim()}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
