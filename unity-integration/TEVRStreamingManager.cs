using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Unity.WebRTC;
using NativeWebSocket;

namespace TEVR
{
    /// <summary>
    /// Main manager for the TEVR streaming session.
    /// Attach this to a persistent GameObject in your scene.
    /// Handles WebRTC peer connection and Socket.io signaling.
    /// </summary>
    public class TEVRStreamingManager : MonoBehaviour
    {
        [Header("Server Configuration")]
        [Tooltip("Base URL of the TEVR server (no trailing slash). e.g. https://yourapp.replit.dev")]
        public string ServerUrl = "https://yourapp.replit.dev";

        [Header("Session")]
        [Tooltip("Room code provided by the admin. Can be set programmatically via StartSession().")]
        public string RoomCode = "";

        [Header("Video")]
        [Tooltip("Camera to stream. Leave null to use the device's primary camera.")]
        public Camera StreamCamera;

        [Tooltip("RenderTexture to capture for streaming. Optional - if null, uses webcam.")]
        public RenderTexture CaptureTexture;

        [Header("Events")]
        public Action OnConnected;
        public Action OnDisconnected;
        public Action<string> OnChatMessageReceived;
        public Action<string> OnPointToReceived;

        // WebRTC
        private RTCPeerConnection _peerConnection;
        private MediaStream _localStream;
        private VideoStreamTrack _videoTrack;
        private AudioStreamTrack _audioTrack;

        // WebSocket signaling
        private WebSocket _ws;
        private bool _isConnected = false;
        private string _remoteSocketId = "";

        private static readonly RTCConfiguration IceConfig = new RTCConfiguration
        {
            iceServers = new RTCIceServer[]
            {
                new RTCIceServer { urls = new string[] { "stun:stun.l.google.com:19302" } },
                new RTCIceServer { urls = new string[] { "stun:stun1.l.google.com:19302" } },
            }
        };

        private void Start()
        {
            WebRTC.Initialize();
            StartCoroutine(WebRTC.Update());
        }

        private void OnDestroy()
        {
            DisconnectAsync();
            WebRTC.Dispose();
        }

        private void Update()
        {
            _ws?.DispatchMessageQueue();
        }

        /// <summary>
        /// Call this to start a streaming session with a given room code.
        /// </summary>
        public void StartSession(string roomCode)
        {
            RoomCode = roomCode;
            ConnectToSignalingServer();
        }

        private async void ConnectToSignalingServer()
        {
            string wsUrl = ServerUrl
                .Replace("https://", "wss://")
                .Replace("http://", "ws://");
            wsUrl += "/socket.io/?EIO=4&transport=websocket";

            Debug.Log($"[TEVR] Connecting to signaling server: {wsUrl}");

            _ws = new WebSocket(wsUrl);

            _ws.OnOpen += OnWebSocketOpen;
            _ws.OnMessage += OnWebSocketMessage;
            _ws.OnError += (err) => Debug.LogError($"[TEVR] WebSocket error: {err}");
            _ws.OnClose += (code) =>
            {
                Debug.Log($"[TEVR] WebSocket closed: {code}");
                _isConnected = false;
                OnDisconnected?.Invoke();
            };

            await _ws.Connect();
        }

        private void OnWebSocketOpen()
        {
            Debug.Log("[TEVR] WebSocket connected, joining room...");
            SendSocketEvent("join-room", new { roomCode = RoomCode, role = "headset" });
        }

        private void OnWebSocketMessage(byte[] data)
        {
            string text = System.Text.Encoding.UTF8.GetString(data);

            // Socket.io protocol: messages start with a numeric prefix
            // "42" = event message
            if (!text.StartsWith("42")) return;

            string json = text.Substring(2); // strip "42"
            var parsed = ParseSocketEvent(json);
            if (parsed == null) return;

            string eventName = parsed.Item1;
            string payload = parsed.Item2;

            switch (eventName)
            {
                case "peer-joined":
                    var peerJoined = JsonUtility.FromJson<PeerJoinedPayload>(payload);
                    _remoteSocketId = peerJoined.socketId;
                    Debug.Log($"[TEVR] Peer joined: {peerJoined.role} ({peerJoined.socketId})");
                    break;

                case "offer":
                    var offerPayload = JsonUtility.FromJson<OfferPayload>(payload);
                    _remoteSocketId = offerPayload.fromSocketId;
                    StartCoroutine(HandleRemoteOffer(offerPayload.offer));
                    break;

                case "answer":
                    var answerPayload = JsonUtility.FromJson<AnswerPayload>(payload);
                    StartCoroutine(HandleRemoteAnswer(answerPayload.answer));
                    break;

                case "ice-candidate":
                    var icePayload = JsonUtility.FromJson<IceCandidatePayload>(payload);
                    AddRemoteIceCandidate(icePayload.candidate);
                    break;

                case "chat-message":
                    var chatPayload = JsonUtility.FromJson<ChatMessagePayload>(payload);
                    OnChatMessageReceived?.Invoke(chatPayload.message);
                    break;

                case "point-to":
                    var pointPayload = JsonUtility.FromJson<PointToPayload>(payload);
                    OnPointToReceived?.Invoke(pointPayload.objectName);
                    break;
            }
        }

        private IEnumerator SetupPeerConnection()
        {
            _peerConnection = new RTCPeerConnection(ref IceConfig);

            _peerConnection.OnIceCandidate = (candidate) =>
            {
                SendSocketEvent("ice-candidate", new
                {
                    roomCode = RoomCode,
                    candidate = new { candidate = candidate.Candidate, sdpMid = candidate.SdpMid, sdpMLineIndex = candidate.SdpMLineIndex },
                    targetSocketId = _remoteSocketId
                });
            };

            _peerConnection.OnIceConnectionChange = (state) =>
            {
                Debug.Log($"[TEVR] ICE connection state: {state}");
                if (state == RTCIceConnectionState.Connected)
                {
                    _isConnected = true;
                    OnConnected?.Invoke();
                }
            };

            // Capture and add video track
            if (CaptureTexture != null)
            {
                _videoTrack = new VideoStreamTrack(CaptureTexture);
            }
            else
            {
                _videoTrack = StreamCamera != null
                    ? StreamCamera.CaptureStreamTrack(1280, 720)
                    : new VideoStreamTrack(WebCamTexture.devices.Length > 0
                        ? new WebCamTexture(WebCamTexture.devices[0].name)
                        : null);
            }

            _localStream = new MediaStream();
            _localStream.AddTrack(_videoTrack);

            // Add audio track
            _audioTrack = new AudioStreamTrack();
            _localStream.AddTrack(_audioTrack);

            foreach (var track in _localStream.GetTracks())
            {
                _peerConnection.AddTrack(track, _localStream);
            }

            yield return null;
        }

        private IEnumerator HandleRemoteOffer(RTCSessionDescription offer)
        {
            yield return SetupPeerConnection();

            var setRemoteDesc = _peerConnection.SetRemoteDescription(ref offer);
            yield return setRemoteDesc;

            if (setRemoteDesc.IsError)
            {
                Debug.LogError($"[TEVR] SetRemoteDescription failed: {setRemoteDesc.Error.message}");
                yield break;
            }

            var answerOp = _peerConnection.CreateAnswer();
            yield return answerOp;

            if (answerOp.IsError)
            {
                Debug.LogError($"[TEVR] CreateAnswer failed: {answerOp.Error.message}");
                yield break;
            }

            var answer = answerOp.Desc;
            var setLocalDesc = _peerConnection.SetLocalDescription(ref answer);
            yield return setLocalDesc;

            SendSocketEvent("answer", new
            {
                roomCode = RoomCode,
                answer = new { type = "answer", sdp = answer.sdp },
                targetSocketId = _remoteSocketId
            });

            Debug.Log("[TEVR] Sent answer to admin");
        }

        private IEnumerator HandleRemoteAnswer(RTCSessionDescription answer)
        {
            var setRemote = _peerConnection.SetRemoteDescription(ref answer);
            yield return setRemote;

            if (setRemote.IsError)
                Debug.LogError($"[TEVR] SetRemoteDescription (answer) failed: {setRemote.Error.message}");
        }

        private void AddRemoteIceCandidate(RTCIceCandidateInit candidateInit)
        {
            var candidate = new RTCIceCandidate(candidateInit);
            _peerConnection?.AddIceCandidate(candidate);
        }

        /// <summary>
        /// Send a chat message to the remote admin.
        /// </summary>
        public void SendChatMessage(string message)
        {
            SendSocketEvent("chat-message", new { roomCode = RoomCode, message, senderRole = "tech" });
        }

        private void SendSocketEvent(string eventName, object payload)
        {
            if (_ws?.State != WebSocketState.Open) return;
            string json = $"42[\"{eventName}\",{JsonUtility.ToJson(payload)}]";
            _ws.SendText(json);
        }

        private async void DisconnectAsync()
        {
            _peerConnection?.Close();
            _peerConnection?.Dispose();
            _localStream?.Dispose();
            _videoTrack?.Dispose();
            _audioTrack?.Dispose();
            if (_ws != null) await _ws.Close();
        }

        // ---- Parsing helpers ----

        private Tuple<string, string> ParseSocketEvent(string json)
        {
            // Socket.io format: ["eventName", {...payload}]
            json = json.Trim();
            if (!json.StartsWith("[")) return null;
            int nameStart = json.IndexOf('"') + 1;
            int nameEnd = json.IndexOf('"', nameStart);
            if (nameStart < 0 || nameEnd < 0) return null;
            string eventName = json.Substring(nameStart, nameEnd - nameStart);
            int payloadStart = json.IndexOf(',') + 1;
            if (payloadStart <= 0) return new Tuple<string, string>(eventName, "{}");
            string payload = json.Substring(payloadStart, json.Length - payloadStart - 1).Trim();
            return new Tuple<string, string>(eventName, payload);
        }

        // ---- Payload types ----

        [Serializable] private class PeerJoinedPayload { public string role; public string socketId; }
        [Serializable] private class OfferPayload { public RTCSessionDescription offer; public string fromSocketId; }
        [Serializable] private class AnswerPayload { public RTCSessionDescription answer; }
        [Serializable] private class IceCandidatePayload { public RTCIceCandidateInit candidate; }
        [Serializable] private class ChatMessagePayload { public string message; public string senderRole; }
        [Serializable] private class PointToPayload { public string objectName; }
    }
}
