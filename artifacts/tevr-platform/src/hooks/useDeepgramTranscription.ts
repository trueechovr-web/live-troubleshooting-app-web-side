import { useEffect, useRef, useCallback } from "react";
import { useAppendTranscriptChunk } from "@workspace/api-client-react";

const DEEPGRAM_API_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY as string | undefined;
const DEEPGRAM_WS_URL =
  "wss://api.deepgram.com/v1/listen?model=nova-2&language=en-US&punctuate=true&interim_results=false&encoding=opus&sample_rate=48000";

interface UseDeepgramTranscriptionProps {
  sessionId: string;
  enabled: boolean;
  remoteStream: MediaStream | null;
}

function startDeepgramStream(
  stream: MediaStream,
  speaker: "admin" | "tech",
  onTranscript: (text: string, speaker: "admin" | "tech") => void,
): () => void {
  if (!DEEPGRAM_API_KEY) {
    console.warn("[Transcription] VITE_DEEPGRAM_API_KEY not set — transcription disabled.");
    return () => {};
  }

  const ws = new WebSocket(DEEPGRAM_WS_URL, ["token", DEEPGRAM_API_KEY]);
  let recorder: MediaRecorder | null = null;
  let closed = false;

  ws.onopen = () => {
    if (closed) { ws.close(); return; }
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    recorder = new MediaRecorder(stream, { mimeType });
    recorder.ondataavailable = async (e) => {
      if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        const buf = await e.data.arrayBuffer();
        ws.send(buf);
      }
    };
    recorder.start(250);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string) as {
        type: string;
        is_final: boolean;
        channel: { alternatives: Array<{ transcript: string }> };
      };
      if (data.type === "Results" && data.is_final) {
        const transcript = data.channel?.alternatives?.[0]?.transcript ?? "";
        if (transcript.trim()) {
          onTranscript(transcript, speaker);
        }
      }
    } catch {
      /* ignore parse errors */
    }
  };

  ws.onerror = (err) => {
    console.error(`[Transcription:${speaker}] WebSocket error`, err);
  };

  return () => {
    closed = true;
    recorder?.stop();
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
      ws.close();
    }
  };
}

export function useDeepgramTranscription({
  sessionId,
  enabled,
  remoteStream,
}: UseDeepgramTranscriptionProps) {
  const appendChunk = useAppendTranscriptChunk();
  const cleanupRef = useRef<Array<() => void>>([]);

  const handleTranscript = useCallback(
    (text: string, speaker: "admin" | "tech") => {
      if (!sessionId) return;
      appendChunk.mutate({ sessionId, data: { speaker, text } });
    },
    [sessionId, appendChunk],
  );

  useEffect(() => {
    if (!enabled || !sessionId || !DEEPGRAM_API_KEY) return;

    let active = true;
    let adminStream: MediaStream | null = null;
    const cleanups: Array<() => void> = [];

    async function startStreams() {
      try {
        adminStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!active) {
          adminStream.getTracks().forEach((t) => t.stop());
          return;
        }
        const stopAdmin = startDeepgramStream(adminStream, "admin", handleTranscript);
        cleanups.push(() => {
          stopAdmin();
          adminStream?.getTracks().forEach((t) => t.stop());
        });
      } catch (err) {
        console.warn("[Transcription] Could not get admin mic:", err);
      }

      if (remoteStream instanceof MediaStream) {
        const audioTracks = remoteStream.getAudioTracks();
        if (audioTracks.length > 0) {
          const headsetStream = new MediaStream(audioTracks);
          const stopHeadset = startDeepgramStream(headsetStream, "tech", handleTranscript);
          cleanups.push(stopHeadset);
        }
      }

      cleanupRef.current = cleanups;
    }

    startStreams();

    return () => {
      active = false;
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    };
  }, [enabled, sessionId, handleTranscript, remoteStream]);
}
