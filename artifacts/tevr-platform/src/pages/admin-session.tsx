import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetSession, useListMessages, useSendMessage, useEndSession, useGetCustomer,
  getListMessagesQueryKey, useListQrDictionary, useSubmitSessionFeedback, useGetHeadset,
} from "@workspace/api-client-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useDeepgramTranscription } from "@/hooks/useDeepgramTranscription";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePortalMode } from "@/hooks/usePortalMode";

export default function AdminSession() {
  const { customerId = "", sessionId = "" } = useParams<{ customerId: string; sessionId: string }>();
  const [, setLocation] = useLocation();
  const { isTevrMode, base } = usePortalMode();
  const queryClient = useQueryClient();

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef  = useRef<HTMLVideoElement>(null);

  const [messageInput, setMessageInput] = useState("");
  const [volume, setVolume] = useState(80);
  const [pointingToQr, setPointingToQr] = useState("");
  const [pointToConfirm, setPointToConfirm] = useState("");
  const [pointToPanelOpen, setPointToPanelOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackIssue, setFeedbackIssue] = useState("");
  const [feedbackResolved, setFeedbackResolved] = useState<boolean | null>(null);

  const session  = useGetSession(sessionId, { query: { enabled: !!sessionId } });
  const customer = useGetCustomer(customerId, { query: { enabled: !!customerId } });

  const pointToObjects = customer.data?.pointToObjects ?? [];
  const dictionary = useListQrDictionary(customerId, { query: { enabled: !!customerId } });

  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of dictionary.data ?? []) map.set(e.qrValue, e.name);
    return map;
  }, [dictionary.data]);

  const categories = useMemo(() => {
    type CatItem = { qrValue: string; displayName: string };
    type Cat = { id: string; label: string; items: CatItem[] };
    const cats: Cat[] = [];

    const ungrouped = pointToObjects
      .filter((it) => !it.children?.length)
      .map((it) => ({ qrValue: it.label, displayName: nameMap.get(it.label) ?? it.label }));
    if (ungrouped.length > 0) cats.push({ id: "__ungrouped__", label: "Ungrouped", items: ungrouped });

    for (const it of pointToObjects.filter((it) => it.children && it.children.length > 0)) {
      cats.push({
        id: it.label,
        label: it.label,
        items: it.children!.map((c) => ({ qrValue: c.label, displayName: nameMap.get(c.label) ?? c.label })),
      });
    }
    return cats;
  }, [pointToObjects, nameMap]);

  const messages   = useListMessages(sessionId, {
    query: { enabled: !!sessionId, queryKey: getListMessagesQueryKey(sessionId), refetchInterval: 2000 },
  });
  const sendMessage = useSendMessage();
  const endSession  = useEndSession();
  const submitFeedback = useSubmitSessionFeedback();

  const roomCode = session.data?.roomCode ?? "";

  const { isConnected, remoteStream, toggleMic, toggleCamera, isMicOn, isCameraOn, sendPointTo, batteryLevel: socketBattery } = useWebRTC({
    roomCode, role: "admin", remoteVideoRef, localVideoRef,
  });

  const headsetId = session.data?.headsetId ?? "";
  const headset = useGetHeadset(headsetId, {
    query: { enabled: !!headsetId, refetchInterval: 30000 },
  });

  const batteryLevel: number | null = socketBattery ?? headset.data?.batteryLevel ?? null;

  const sessionHistoryEnabled = customer.data?.sessionHistoryEnabled ?? false;
  useDeepgramTranscription({
    sessionId,
    enabled: isConnected && sessionHistoryEnabled,
    remoteStream,
  });

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.volume = volume / 100;
  }, [volume]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.data]);

  const handleSendMessage = useCallback(() => {
    if (!messageInput.trim()) return;
    sendMessage.mutate(
      { sessionId, data: { senderRole: "admin", content: messageInput.trim() } },
      { onSuccess: () => { setMessageInput(""); queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(sessionId) }); } }
    );
  }, [messageInput, sessionId, sendMessage, queryClient]);

  const handlePointTo = useCallback((qrValue: string) => {
    setPointingToQr(qrValue);
    setPointToPanelOpen(false);
    sendPointTo(qrValue);
    const name = nameMap.get(qrValue) ?? qrValue;
    setPointToConfirm(`Pointing to: ${name}`);
    setTimeout(() => setPointToConfirm(""), 3000);
  }, [sendPointTo, nameMap]);

  const handleClearPointTo = useCallback(() => {
    setPointingToQr("");
    sendPointTo("");
    setPointToConfirm("");
  }, [sendPointTo]);

  const navigateAfterSession = useCallback(() => {
    setLocation(`${base}/${customerId}/troubleshoot`);
  }, [setLocation, base, customerId]);

  const handleEndSession = useCallback(() => {
    if (sessionHistoryEnabled) {
      endSession.mutate({ sessionId }, { onSuccess: () => setShowFeedbackModal(true) });
    } else {
      endSession.mutate({ sessionId }, { onSuccess: navigateAfterSession });
    }
  }, [sessionId, endSession, sessionHistoryEnabled, navigateAfterSession]);

  const handleFeedbackSubmit = useCallback(() => {
    if (!feedbackIssue.trim() || feedbackResolved === null) return;
    submitFeedback.mutate(
      { sessionId, data: { issueDescription: feedbackIssue.trim(), resolved: feedbackResolved } },
      { onSuccess: navigateAfterSession, onError: navigateAfterSession },
    );
  }, [sessionId, feedbackIssue, feedbackResolved, submitFeedback, navigateAfterSession]);

  const pointingToName = nameMap.get(pointingToQr) ?? pointingToQr;

  if (showFeedbackModal) {
    const canSubmit = feedbackIssue.trim().length > 0 && feedbackResolved !== null;
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <svg width="20" height="20" className="text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground">Session notes</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Help us keep a record of this support call. This will be added to the session summary.
            </p>
          </div>

          <div className="px-8 py-6 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-foreground">
                What was the main issue?
              </label>
              <textarea
                data-testid="feedback-issue-input"
                value={feedbackIssue}
                onChange={(e) => setFeedbackIssue(e.target.value)}
                placeholder="e.g. Espresso machine pressure too low, grinder producing inconsistent grind size…"
                rows={4}
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-foreground">
                Was the issue resolved?
              </label>
              <div className="flex gap-3">
                <button
                  data-testid="feedback-resolved-yes"
                  onClick={() => setFeedbackResolved(true)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    feedbackResolved === true
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:border-emerald-400 hover:text-foreground"
                  }`}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Yes, resolved
                </button>
                <button
                  data-testid="feedback-resolved-no"
                  onClick={() => setFeedbackResolved(false)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                    feedbackResolved === false
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-border text-muted-foreground hover:border-amber-400 hover:text-foreground"
                  }`}
                >
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  Not yet
                </button>
              </div>
            </div>
          </div>

          <div className="px-8 pb-8 flex items-center justify-between gap-3">
            <button
              data-testid="feedback-skip"
              onClick={navigateAfterSession}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Skip
            </button>
            <button
              data-testid="feedback-submit"
              onClick={handleFeedbackSubmit}
              disabled={!canSubmit || submitFeedback.isPending}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {submitFeedback.isPending ? "Saving…" : "Save notes"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            data-testid="back-to-troubleshoot"
            onClick={() => setLocation(`${base}/${customerId}/troubleshoot`)}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div className="w-6 h-6 rounded-lg bg-primary flex items-center justify-center">
            <div className="w-2 h-2 rounded-sm bg-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground">
            {isTevrMode ? "True Echo VR" : (customer.data?.name ?? "…")}
          </span>
          <span className="text-muted-foreground text-sm">
            {isTevrMode ? "TEVR Admin" : "Live Session"}
          </span>
          {isTevrMode && customer.data?.name && (
            <span className="ml-1 px-3 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-sm font-bold border border-red-200 dark:border-red-800 tracking-wide">
              {customer.data.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-muted-foreground"}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? "Live" : session.isLoading ? "Loading…" : "Connecting…"}
            </span>
          </div>
          {session.data && (
            <span className="hidden sm:block text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
              {session.data.roomCode}
            </span>
          )}
          <ThemeToggle />
          <button
            data-testid="end-session"
            onClick={handleEndSession}
            disabled={endSession.isPending}
            className="text-sm px-3 py-1.5 rounded-lg border border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors disabled:opacity-50"
          >
            End session
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden relative">
          <div className="relative flex-1 bg-black flex items-center justify-center min-h-0">
            <video ref={remoteVideoRef} data-testid="remote-video" autoPlay playsInline muted={false} className="w-full h-full object-contain" />
            {!isConnected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                  <svg width="28" height="28" className="text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-sm">Waiting for headset to connect</p>
                  {roomCode && <p className="text-white/30 text-xs mt-1 font-mono">{roomCode}</p>}
                </div>
              </div>
            )}
            {batteryLevel !== null && (
              <div className="absolute bottom-4 left-4 flex flex-col items-start gap-1">
                <div
                  data-testid="battery-indicator"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md backdrop-blur-sm text-xs font-semibold select-none transition-colors ${
                    batteryLevel < 20
                      ? "bg-red-900/70 text-red-300 animate-pulse"
                      : batteryLevel < 40
                      ? "bg-amber-900/70 text-amber-300"
                      : "bg-black/50 text-white/70"
                  }`}
                >
                  {/* Battery icon */}
                  <svg width="18" height="12" viewBox="0 0 18 12" fill="none" className="shrink-0">
                    <rect x="0.5" y="0.5" width="15" height="11" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <rect x="16" y="3.5" width="1.5" height="5" rx="0.75" fill="currentColor" />
                    <rect
                      x="2"
                      y="2"
                      width={`${Math.round((batteryLevel / 100) * 11)}`}
                      height="8"
                      rx="1"
                      fill="currentColor"
                    />
                  </svg>
                  {batteryLevel}%
                </div>
                {batteryLevel < 20 && (
                  <span className="text-red-400 text-xs font-medium bg-black/60 px-2 py-0.5 rounded backdrop-blur-sm animate-pulse">
                    Low battery
                  </span>
                )}
              </div>
            )}
            {isCameraOn && (
              <div className="absolute bottom-4 right-4 w-36 h-24 rounded-lg overflow-hidden border border-white/20 shadow-xl">
                <video ref={localVideoRef} data-testid="local-video" autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Point-to picker panel */}
          {pointToPanelOpen && (() => {
            const activeCatId = selectedCategory || categories[0]?.id || "";
            const activeCat = categories.find((c) => c.id === activeCatId) ?? categories[0];
            return (
              <div
                data-testid="point-to-panel"
                className="absolute bottom-0 left-0 right-0 z-20 bg-card border-t border-border shadow-2xl flex flex-col"
                style={{ height: "260px" }}
              >
                <div className="flex items-center justify-between px-5 py-2.5 border-b border-border shrink-0">
                  <span className="text-sm font-semibold text-foreground">Point to object</span>
                  <button
                    data-testid="point-to-panel-close"
                    onClick={() => setPointToPanelOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No categories configured. Set up categories in Point-to Object Menu settings.
                  </p>
                ) : (
                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-44 shrink-0 border-r border-border overflow-y-auto bg-background">
                      {categories.map((cat) => {
                        const isActive = cat.id === activeCatId;
                        return (
                          <button
                            key={cat.id}
                            data-testid={`point-to-cat-${cat.id}`}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-b border-border/50 flex items-center justify-between gap-2 ${
                              isActive
                                ? "bg-primary/10 text-primary border-l-2 border-l-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            <span className="truncate">{cat.label}</span>
                            <span className={`text-xs shrink-0 tabular-nums ${isActive ? "text-primary/70" : "text-muted-foreground/60"}`}>
                              {cat.items.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex-1 overflow-y-auto px-5 py-4">
                      {activeCat ? (
                        <div className="flex flex-wrap gap-2">
                          {activeCat.items.map((item) => (
                            <button
                              key={item.qrValue}
                              data-testid={`point-to-option-${item.qrValue}`}
                              onClick={() => handlePointTo(item.qrValue)}
                              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                pointingToQr === item.qrValue
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-background border-border text-foreground hover:bg-muted"
                              }`}
                            >
                              {item.displayName}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="border-t border-border bg-card px-8 py-5 flex items-center gap-6 shrink-0 flex-wrap">
            <button
              data-testid="toggle-mic"
              onClick={toggleMic}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-base font-medium transition-colors ${
                isMicOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isMicOn ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                  </>
                )}
              </svg>
              {isMicOn ? "Mic on" : "Mic off"}
            </button>

            <button
              data-testid="toggle-camera"
              onClick={toggleCamera}
              className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-base font-medium transition-colors ${
                isCameraOn ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
              </svg>
              {isCameraOn ? "Camera on" : "Camera off"}
            </button>

            <div className="flex items-center gap-3 max-w-56">
              <svg width="18" height="18" className="text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
              <input
                type="range"
                data-testid="volume-slider"
                min={0} max={100} value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="flex-1 accent-primary h-2"
              />
              <span className="text-sm text-muted-foreground w-10 tabular-nums">{volume}%</span>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              {pointingToQr ? (
                <button
                  data-testid="point-to-clear"
                  onClick={handleClearPointTo}
                  className="flex items-center gap-2.5 bg-primary text-primary-foreground border border-primary rounded-lg px-5 py-3 text-base font-medium hover:opacity-90 transition-opacity"
                >
                  <span>Pointing to: {pointingToName}</span>
                  <span className="inline-flex items-center gap-1.5 pl-3 ml-1 border-l border-primary-foreground/30">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear
                  </span>
                </button>
              ) : (
                <button
                  data-testid="point-to-open"
                  onClick={() => setPointToPanelOpen((v) => !v)}
                  className={`flex items-center gap-2.5 px-5 py-3 rounded-lg text-base font-medium border transition-colors ${
                    pointToPanelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border text-foreground hover:bg-muted"
                  }`}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 6.927-3.286-.682zm-7.518-.267A8.25 8.25 0 1120.25 10.5M8.288 14.212A5.25 5.25 0 1117.25 10.5" />
                  </svg>
                  Point to object…
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} className={`transition-transform ${pointToPanelOpen ? "rotate-180" : ""}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
              )}
              {pointToConfirm && !pointingToQr && (
                <span className="text-sm text-primary font-medium">{pointToConfirm}</span>
              )}
            </div>
          </div>
        </div>

        <div className="w-72 border-l border-border flex flex-col bg-card shrink-0">
          <div className="px-4 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Chat</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {session.data?.headsetLabel ?? "Headset"}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 min-h-0">
            {messages.isLoading ? (
              <p className="text-xs text-muted-foreground text-center">Loading…</p>
            ) : messages.data?.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center">No messages yet</p>
            ) : (
              messages.data?.map((msg) => (
                <div key={msg.id} data-testid={`message-${msg.id}`} className={`flex flex-col gap-1 ${msg.senderRole === "admin" ? "items-end" : "items-start"}`}>
                  <span className="text-xs text-muted-foreground capitalize">{msg.senderRole}</span>
                  <div className={`rounded-lg px-3 py-2 text-sm max-w-full break-words ${msg.senderRole === "admin" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {msg.content}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(msg.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-border flex gap-2 shrink-0">
            <input
              type="text"
              data-testid="message-input"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Type a message…"
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              data-testid="send-message"
              onClick={handleSendMessage}
              disabled={sendMessage.isPending || !messageInput.trim()}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
