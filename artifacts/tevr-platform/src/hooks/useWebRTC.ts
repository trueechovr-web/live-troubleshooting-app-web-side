import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface UseWebRTCProps {
  roomCode: string;
  role: "admin" | "tech";
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useWebRTC({ roomCode, role, remoteVideoRef, localVideoRef }: UseWebRTCProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const initLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      if (peerConnectionRef.current) {
        // Replace tracks or add them
        const senders = peerConnectionRef.current.getSenders();
        stream.getTracks().forEach(track => {
          const sender = senders.find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            peerConnectionRef.current?.addTrack(track, stream);
          }
        });
      }
      
      return stream;
    } catch (err) {
      console.error("Error accessing media devices.", err);
      return null;
    }
  }, [localVideoRef]);

  const toggleCamera = useCallback(async () => {
    const nextState = !isCameraOn;
    setIsCameraOn(nextState);
    if (nextState || isMicOn) {
      await initLocalStream(nextState, isMicOn);
    } else if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
    }
  }, [isCameraOn, isMicOn, initLocalStream, localVideoRef]);

  const toggleMic = useCallback(async () => {
    const nextState = !isMicOn;
    setIsMicOn(nextState);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = nextState;
      } else if (nextState || isCameraOn) {
        await initLocalStream(isCameraOn, nextState);
      }
    } else if (nextState || isCameraOn) {
      await initLocalStream(isCameraOn, nextState);
    }
  }, [isMicOn, isCameraOn, initLocalStream]);

  useEffect(() => {
    if (!roomCode) return;

    socketRef.current = io(window.location.origin, {
      path: "/socket.io/"
    });

    const socket = socketRef.current;

    const configuration = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    };

    const createPeerConnection = () => {
      const pc = new RTCPeerConnection(configuration);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            roomCode,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        setRemoteStream(event.streams[0] ?? null);
      };

      pc.onconnectionstatechange = () => {
        setIsConnected(pc.connectionState === "connected");
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      return pc;
    };

    peerConnectionRef.current = createPeerConnection();

    socket.on("connect", () => {
      socket.emit("join-room", { roomCode, role });
    });

    socket.on("peer-joined", async () => {
      if (role === "admin") {
        try {
          const offer = await peerConnectionRef.current!.createOffer();
          await peerConnectionRef.current!.setLocalDescription(offer);
          socket.emit("offer", { roomCode, offer });
        } catch (err) {
          console.error("Error creating offer", err);
        }
      }
    });

    socket.on("offer", async (offer: RTCSessionDescriptionInit) => {
      try {
        if (!peerConnectionRef.current) peerConnectionRef.current = createPeerConnection();
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        socket.emit("answer", { roomCode, answer });
      } catch (err) {
        console.error("Error handling offer", err);
      }
    });

    socket.on("answer", async (answer: RTCSessionDescriptionInit) => {
      try {
        await peerConnectionRef.current!.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error("Error handling answer", err);
      }
    });

    socket.on("ice-candidate", async (candidate: RTCIceCandidateInit) => {
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error handling ICE candidate", err);
      }
    });

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
      if (socket) {
        socket.disconnect();
      }
    };
  }, [roomCode, role, remoteVideoRef]);

  const sendPointTo = useCallback((objectName: string) => {
    if (socketRef.current) {
      socketRef.current.emit("point-to", { roomCode, objectName });
    }
  }, [roomCode]);

  return {
    isConnected,
    localStream: localStreamRef.current,
    remoteStream,
    toggleMic,
    toggleCamera,
    isMicOn,
    isCameraOn,
    sendPointTo,
    socket: socketRef.current
  };
}
