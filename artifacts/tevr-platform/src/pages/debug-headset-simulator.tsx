import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { io, Socket } from "socket.io-client";
import { ThemeToggle } from "@/components/ThemeToggle";

interface LogEntry {
  id: number;
  ts: string;
  direction: "out" | "in" | "system";
  event: string;
  payload: unknown;
}

let logCounter = 0;

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-1.5 text-xs font-mono bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function PoseBadge({ pose }: { pose: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } }) {
  const f = (n: number) => n.toFixed(3);
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs font-mono">
      <div className="bg-background rounded p-2">
        <p className="text-muted-foreground mb-1 font-sans font-medium text-[10px] uppercase tracking-wide">Position</p>
        <p>x: {f(pose.position.x)}</p>
        <p>y: {f(pose.position.y)}</p>
        <p>z: {f(pose.position.z)}</p>
      </div>
      <div className="bg-background rounded p-2">
        <p className="text-muted-foreground mb-1 font-sans font-medium text-[10px] uppercase tracking-wide">Rotation</p>
        <p>x: {f(pose.rotation.x)}</p>
        <p>y: {f(pose.rotation.y)}</p>
        <p>z: {f(pose.rotation.z)}</p>
        <p>w: {f(pose.rotation.w)}</p>
      </div>
    </div>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(true);

  const isVerbose = ["offer", "answer", "ice-candidate"].includes(entry.event);
  const isPointTo = entry.event === "point-to" && entry.direction === "in";
  const isPeerJoined = entry.event === "peer-joined";

  const dirColor = {
    out: "border-blue-400/50 bg-blue-500/5",
    in: isPointTo ? "border-emerald-400/50 bg-emerald-500/5" : isPeerJoined ? "border-amber-400/50 bg-amber-500/5" : "border-muted bg-muted/20",
    system: "border-border bg-muted/10",
  }[entry.direction];

  const arrow = { out: "↑", in: "↓", system: "·" }[entry.direction];
  const arrowColor = { out: "text-blue-500", in: "text-emerald-500", system: "text-muted-foreground" }[entry.direction];

  const ptPayload = isPointTo ? (entry.payload as { name?: string; qrCode?: string; pose?: { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number; w: number } } }) : null;

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${dirColor}`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs font-bold mt-0.5 shrink-0 ${arrowColor}`}>{arrow}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground font-mono">{entry.event}</span>
            {isPointTo && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800">
                POINT-TO
              </span>
            )}
            {isPeerJoined && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-semibold border border-amber-200 dark:border-amber-800">
                PEER JOINED
              </span>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">{entry.ts}</span>
          </div>

          {isPointTo && ptPayload ? (
            <div className="mt-1.5">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span><span className="text-muted-foreground text-xs">name: </span><span className="font-medium">{ptPayload.name ?? "—"}</span></span>
                <span><span className="text-muted-foreground text-xs">qrCode: </span><span className="font-mono text-xs bg-muted rounded px-1.5 py-0.5">{ptPayload.qrCode ?? <span className="italic text-muted-foreground">none — fallback</span>}</span></span>
              </div>
              {ptPayload.pose ? (
                <PoseBadge pose={ptPayload.pose} />
              ) : (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 italic">No pose data — headset locationId not set or code not calibrated</p>
              )}
            </div>
          ) : isVerbose ? (
            <button onClick={() => setExpanded(v => !v)} className="text-[10px] text-muted-foreground underline-offset-2 hover:underline mt-1">
              {expanded ? "collapse" : "expand payload"}
            </button>
          ) : null}

          {(!isPointTo && (expanded || !isVerbose)) && (
            <JsonBlock value={entry.payload} />
          )}
          {isVerbose && !expanded && null}
        </div>
      </div>
    </div>
  );
}

export default function DebugHeadsetSimulator() {
  const [, setLocation] = useLocation();

  const [roomCode, setRoomCode] = useState("TEST-001");
  const [headsetId, setHeadsetId] = useState("quest-3-unit-01");
  const [locationId, setLocationId] = useState("");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [battery, setBattery] = useState(85);
  const [chatMsg, setChatMsg] = useState("");

  const [startupData, setStartupData] = useState<unknown>(null);
  const [startupLoading, setStartupLoading] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((direction: LogEntry["direction"], event: string, payload: unknown) => {
    setLog(prev => [...prev, { id: logCounter++, ts: ts(), direction, event, payload }]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    setConnecting(true);

    const socket = io(window.location.origin, {
      path: "/socket.io/",
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setConnected(true);
      setConnecting(false);
      addLog("system", "connected", { socketId: socket.id });

      socket.emit("join-room", { role: "headset", roomCode, locationId: locationId || undefined });
      addLog("out", "join-room", { role: "headset", roomCode, locationId: locationId || undefined });
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      addLog("system", "disconnected", { reason });
    });

    socket.on("connect_error", (err) => {
      setConnecting(false);
      addLog("system", "connect_error", { message: err.message });
    });

    socket.on("room-peers", (peers: unknown) => {
      addLog("in", "room-peers", peers);
    });

    socket.on("peer-joined", (data: unknown) => {
      addLog("in", "peer-joined", data);
    });

    socket.on("peer-left", (data: unknown) => {
      addLog("in", "peer-left", data);
    });

    socket.on("offer", (data: unknown) => {
      addLog("in", "offer", data);
    });

    socket.on("answer", (data: unknown) => {
      addLog("in", "answer", data);
    });

    socket.on("ice-candidate", (data: unknown) => {
      addLog("in", "ice-candidate", data);
    });

    socket.on("chat-message", (data: unknown) => {
      addLog("in", "chat-message", data);
    });

    socket.on("point-to", (data: unknown) => {
      addLog("in", "point-to", data);
    });

    socket.on("battery-update", (data: unknown) => {
      addLog("in", "battery-update", data);
    });

    socketRef.current = socket;
  }, [roomCode, locationId, addLog]);

  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => () => { socketRef.current?.disconnect(); }, []);

  const sendBattery = () => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit("battery-update", { roomCode, batteryLevel: battery });
    addLog("out", "battery-update", { roomCode, batteryLevel: battery });
  };

  const sendChat = () => {
    if (!socketRef.current?.connected || !chatMsg.trim()) return;
    socketRef.current.emit("chat-message", { roomCode, message: chatMsg.trim(), senderRole: "headset" });
    addLog("out", "chat-message", { roomCode, message: chatMsg.trim(), senderRole: "headset" });
    setChatMsg("");
  };

  const fetchStartupData = async () => {
    setStartupLoading(true);
    setStartupData(null);
    try {
      const params = locationId ? `?locationId=${encodeURIComponent(locationId)}` : "";
      const res = await fetch(`/api/headsets/${encodeURIComponent(headsetId)}/startup-data${params}`);
      const json = await res.json();
      setStartupData(json);
    } catch (err) {
      setStartupData({ error: String(err) });
    } finally {
      setStartupLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLocation("/tevr")}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">True Echo VR</span>
          <span className="text-muted-foreground text-sm">Operations</span>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-muted-foreground/50">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
          <span className="text-muted-foreground text-sm">Headset Simulator</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-medium">
            Debug tool — internal use only
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="px-6 py-6 max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
        {/* Left panel — controls */}
        <div className="flex flex-col gap-4">
          {/* Connection */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              Connection
              <span className={`inline-block w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : connecting ? "bg-amber-500 animate-pulse" : "bg-muted-foreground/40"}`} />
              <span className="text-xs font-normal text-muted-foreground">{connected ? "Connected" : connecting ? "Connecting…" : "Disconnected"}</span>
            </h2>

            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Room Code</label>
                <input
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value)}
                  disabled={connected}
                  placeholder="e.g. TEST-001"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Headset ID</label>
                <input
                  value={headsetId}
                  onChange={e => setHeadsetId(e.target.value)}
                  placeholder="quest-3-unit-01"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Location ID <span className="text-muted-foreground/60">(for point-to spatial data)</span></label>
                <input
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                  disabled={connected}
                  placeholder="Paste location UUID…"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                />
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={connected ? disconnect : connect}
                disabled={connecting || (!connected && !roomCode.trim())}
                className={`flex-1 text-sm py-2 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  connected
                    ? "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {connected ? "Disconnect" : connecting ? "Connecting…" : "Connect as Headset"}
              </button>
            </div>
          </div>

          {/* Outgoing events */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Send Events</h2>

            <div className="space-y-4">
              {/* Battery */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">
                  Battery Level — <span className="text-foreground font-medium">{battery}%</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={battery}
                  onChange={e => setBattery(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <button
                  onClick={sendBattery}
                  disabled={!connected}
                  className="mt-2 w-full text-sm py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Send battery-update
                </button>
              </div>

              <div className="border-t border-border" />

              {/* Chat */}
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Chat Message</label>
                <input
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") sendChat(); }}
                  placeholder="Type a message…"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={sendChat}
                  disabled={!connected || !chatMsg.trim()}
                  className="mt-2 w-full text-sm py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Send chat-message
                </button>
              </div>
            </div>
          </div>

          {/* REST test panel */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-1">REST — Startup Data</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Calls <code className="font-mono bg-muted px-1 rounded">GET /api/headsets/&#123;id&#125;/startup-data</code> and shows the response. Uses Headset ID and Location ID from above.
            </p>
            <button
              onClick={fetchStartupData}
              disabled={startupLoading || !headsetId.trim()}
              className="w-full text-sm py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {startupLoading ? "Fetching…" : "Fetch startup-data"}
            </button>

            {startupData !== null && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Response</p>
                <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-auto max-h-72 whitespace-pre-wrap break-all leading-relaxed border border-border">
                  {JSON.stringify(startupData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Right panel — event log */}
        <div className="rounded-xl border border-border bg-card flex flex-col min-h-[600px] xl:min-h-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Event Log</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-blue-500 font-medium">↑ outbound</span>
                {" · "}
                <span className="text-emerald-500 font-medium">↓ inbound</span>
                {" · "}
                <span className="text-muted-foreground">· system</span>
              </p>
            </div>
            <button
              onClick={() => setLog([])}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear log
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {log.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} className="text-muted-foreground">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No events yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">Enter a Room Code and click Connect to join as a headset. Events sent and received will appear here.</p>
              </div>
            ) : (
              log.map(entry => <LogRow key={entry.id} entry={entry} />)
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
