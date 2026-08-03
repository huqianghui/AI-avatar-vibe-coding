import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type {
  VoiceConnectionState,
  AudioState,
  TranscriptSegment,
} from "@/types/voice-live";
import {
  fetchAnonymousWebrtcSession,
  type WebrtcSessionResponse,
} from "@/api/public-avatar";
import {
  createVoiceLogger,
  setSessionCorrelationId,
  getEventSummary,
  resetEventSummary,
} from "@/lib/voice-logger";

const log = createVoiceLogger("AnonymousVoiceLiveWebRTC");

/**
 * Thrown ONLY when `getUserMedia` itself fails (mic permission denied / no
 * mic hardware). Lets callers distinguish "the user must grant microphone
 * access" from service-side failures (backend 404/5xx, WebRTC/signaling
 * errors) which must NOT be presented as a mic-permission problem.
 */
export class MicAccessError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MicAccessError";
  }
}

/**
 * Options for {@link useAnonymousVoiceLive}. Intentionally does NOT include
 * a `systemPrompt` field: the anonymous path has no client-suppliable
 * prompt override — the agent/knowledge-base is always resolved server-side
 * from the active `PublicKnowledgeConfig` row (ANON-04 / T-32-12).
 */
export interface AnonymousVoiceLiveOptions {
  /** Locale for voice selection; must match the backend's `WebrtcSessionRequest.locale` pattern ("zh-CN" | "en-US"). */
  locale?: string;
  onTranscript?: (segment: TranscriptSegment) => void;
  onAudioDelta?: (base64Audio: string) => void;
  onConnectionStateChange?: (state: VoiceConnectionState) => void;
  onAudioStateChange?: (state: AudioState) => void;
  onResponseDone?: () => void;
  onError?: (error: Error) => void;
  /** Attached via `ontrack` when Azure Voice Live sends an avatar video track
   * (Phase 37, PERSONA-05) -- optional because not every caller needs
   * digital-human video. */
  videoRef?: RefObject<HTMLVideoElement | null>;
}

/**
 * Anonymous-token-authenticated variant of `useVoiceLiveWebRTC` (Phase 32,
 * ANON-04). Exposes the EXACT SAME return-shape key set — `connect`,
 * `disconnect`, `toggleMute`, `sendTextMessage`, `sendAudio`, `send`,
 * `isMuted`, `connectionState`, `audioState`, `avatarSdpCallbackRef` — so
 * Plan 04's avatar page can swap between the authenticated and anonymous
 * hooks with zero prop-shape changes.
 *
 * Deviation note (documented in 32-03-SUMMARY.md): this hook duplicates the
 * minimal WebRTC/RTCPeerConnection connection-bootstrap logic from
 * `use-voice-live-webrtc.ts` (SDP offer/answer over a signaling WebSocket,
 * `voice-live-events` data channel wiring, 3-attempt reconnect with
 * exponential backoff) rather than importing a shared helper, because that
 * logic is not currently factored out of the authenticated hook into a
 * reusable module. The only functional difference from the authenticated
 * hook is Step 1: session issuance calls `fetchAnonymousWebrtcSession`
 * (`X-Anon-Session` header, no JWT) instead of `fetchWebRTCSession`.
 */
export function useAnonymousVoiceLive(
  sessionToken: string,
  options: AnonymousVoiceLiveOptions = {},
) {
  const [connectionState, setConnectionState] =
    useState<VoiceConnectionState>("disconnected");
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  /** Resolved persona identity from the most recent `connect()` call (Phase
   * 37, PERSONA-05) -- intentionally NOT reset on disconnect/cleanup so the
   * static-preview layer doesn't flash to the audio-orb mid-reconnect. */
  const [avatarCharacter, setAvatarCharacter] = useState<string | undefined>(
    undefined,
  );
  const [avatarStyle, setAvatarStyle] = useState<string | undefined>(
    undefined,
  );
  /** True once a real avatar video track has arrived via `ontrack` (Phase 37,
   * PERSONA-05). Reset on `disconnect()`. */
  const [isAvatarConnected, setIsAvatarConnected] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const signalingWsRef = useRef<WebSocket | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const lastConnectLocaleRef = useRef<string | undefined>(undefined);
  /** Persona id from the most recent `connect()` call (Phase 36, PERSONA-03)
   * -- the auto-reconnect path below re-invokes `connect()` with this so a
   * dropped connection resumes with the same persona rather than silently
   * falling back to the default. */
  const lastConnectPersonaIdRef = useRef<string | undefined>(undefined);
  const connectionStateRef = useRef<VoiceConnectionState>("disconnected");
  const transcriptIdCounter = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const sessionTokenRef = useRef(sessionToken);
  sessionTokenRef.current = sessionToken;

  /** Ref for external avatar SDP answer callback (interface compatibility, unused for WebRTC audio). */
  const avatarSdpCallbackRef = useRef<((serverSdp: string) => void) | null>(
    null,
  );

  /** Clean up all WebRTC resources. */
  const cleanup = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (signalingWsRef.current) {
      signalingWsRef.current.close();
      signalingWsRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      micStreamRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current.remove();
      remoteAudioRef.current = null;
    }
  }, []);

  /** Handle data channel messages (transcripts, VAD, response lifecycle). */
  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(event.data as string) as Record<string, unknown>;
    } catch {
      log.warn("Non-JSON data channel message, ignoring");
      return;
    }

    const msgType = msg.type as string | undefined;
    if (msgType) {
      log.event(msgType);
    }

    switch (msgType) {
      case "input_audio_buffer.speech_started":
        setAudioState("listening");
        optionsRef.current.onAudioStateChange?.("listening");
        break;

      case "input_audio_buffer.speech_stopped":
        setAudioState("idle");
        optionsRef.current.onAudioStateChange?.("idle");
        break;

      case "conversation.item.input_audio_transcription.completed":
        if (msg.transcript) {
          optionsRef.current.onTranscript?.({
            id: `user-${++transcriptIdCounter.current}`,
            role: "user",
            content: msg.transcript as string,
            isFinal: true,
            timestamp: Date.now(),
          });
        }
        break;

      case "response.created":
        setAudioState("speaking");
        optionsRef.current.onAudioStateChange?.("speaking");
        break;

      case "response.audio_transcript.delta":
        if (msg.delta) {
          optionsRef.current.onTranscript?.({
            id: `assistant-${msg.response_id as string}-${msg.item_id as string}`,
            role: "assistant",
            content: msg.delta as string,
            isFinal: false,
            timestamp: Date.now(),
          });
        }
        break;

      case "response.audio_transcript.done":
        if (msg.transcript) {
          optionsRef.current.onTranscript?.({
            id: `assistant-${msg.response_id as string}-${msg.item_id as string}`,
            role: "assistant",
            content: msg.transcript as string,
            isFinal: true,
            timestamp: Date.now(),
          });
        }
        break;

      case "response.text.delta":
        if (msg.delta) {
          optionsRef.current.onTranscript?.({
            id: `assistant-text-${msg.response_id as string}-${msg.item_id as string}`,
            role: "assistant",
            content: msg.delta as string,
            isFinal: false,
            timestamp: Date.now(),
          });
        }
        break;

      case "response.text.done":
        if (msg.text) {
          optionsRef.current.onTranscript?.({
            id: `assistant-text-${msg.response_id as string}-${msg.item_id as string}`,
            role: "assistant",
            content: msg.text as string,
            isFinal: true,
            timestamp: Date.now(),
          });
        }
        break;

      case "response.done":
        setAudioState("idle");
        optionsRef.current.onAudioStateChange?.("idle");
        optionsRef.current.onResponseDone?.();
        break;

      case "error":
        log.error("DataChannel error event: %o", msg.error);
        optionsRef.current.onError?.(
          new Error(
            (msg.error as Record<string, unknown>)?.message as string ||
              "Unknown data channel error",
          ),
        );
        break;
    }
  }, []);

  /**
   * Connect to Azure Voice Live via direct WebRTC, using the anonymous
   * session token instead of a JWT.
   * @returns avatarEnabled (always false for WebRTC), model name, and empty ICE servers.
   */
  const connect = useCallback(
    async (locale?: string, personaId?: string) => {
      const effectiveLocale = locale ?? optionsRef.current.locale ?? "zh-CN";
      const sid = crypto.randomUUID().slice(0, 8);
      setSessionCorrelationId(sid);
      resetEventSummary();
      log.info("connect() locale=%s sid=%s personaId=%s", effectiveLocale, sid, personaId ?? "(none)");

      lastConnectLocaleRef.current = effectiveLocale;
      lastConnectPersonaIdRef.current = personaId;
      reconnectAttemptRef.current = 0;
      intentionalCloseRef.current = false;
      setConnectionState("connecting");
      connectionStateRef.current = "connecting";
      optionsRef.current.onConnectionStateChange?.("connecting");

      // Step 1: Get session config from backend (anonymous token broker)
      let session: WebrtcSessionResponse;
      try {
        session = await fetchAnonymousWebrtcSession(
          sessionTokenRef.current,
          effectiveLocale,
          personaId,
        );
        log.info(
          "Anonymous WebRTC session config received: mode=%s model=%s",
          session.mode,
          session.model,
        );
        setAvatarCharacter(session.character ?? undefined);
        setAvatarStyle(session.style ?? undefined);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to fetch anonymous WebRTC session config");
        log.error("fetchAnonymousWebrtcSession failed: %o", err);
        setConnectionState("error");
        connectionStateRef.current = "error";
        optionsRef.current.onConnectionStateChange?.("error");
        optionsRef.current.onError?.(error);
        throw error;
      }

      // Step 2: Get microphone access
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStreamRef.current = micStream;
        log.info("Microphone access granted");
      } catch (err) {
        const error = new MicAccessError(
          err instanceof Error ? err.message : "Microphone access denied",
          { cause: err },
        );
        log.error("getUserMedia failed: %o", err);
        setConnectionState("error");
        connectionStateRef.current = "error";
        optionsRef.current.onConnectionStateChange?.("error");
        optionsRef.current.onError?.(error);
        throw error;
      }

      // Step 3: Create RTCPeerConnection (no ICE servers needed -- Azure handles TURN)
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Step 4: Add mic tracks for bidirectional audio (sendrecv)
      micStream.getTracks().forEach((track) => {
        pc.addTrack(track, micStream);
      });

      // Step 4b: Negotiate a receive-only video transceiver so a real avatar
      // video track from Azure Voice Live (if sent) is not silently dropped
      // (Phase 37, PERSONA-05).
      pc.addTransceiver("video", { direction: "recvonly" });

      // Step 5: Create data channel BEFORE createOffer
      const dc = pc.createDataChannel("voice-live-events");
      dataChannelRef.current = dc;

      // Step 6: Set up data channel message handler
      dc.onmessage = handleDataChannelMessage;
      dc.onopen = () => {
        log.info("Data channel open");
      };
      dc.onclose = () => {
        log.info("Data channel closed");
      };

      // Step 7: Set up remote audio/video playback via ontrack
      pc.ontrack = (event) => {
        if (event.track.kind === "video") {
          if (optionsRef.current.videoRef?.current) {
            optionsRef.current.videoRef.current.srcObject = event.streams[0] ?? null;
            optionsRef.current.videoRef.current.play().catch((playErr: unknown) => {
              log.warn("Avatar video play() failed: %o", playErr);
            });
          }
          setIsAvatarConnected(true);
          log.info("Remote avatar video track received");
        } else if (event.track.kind === "audio") {
          const audio = document.createElement("audio");
          audio.srcObject = event.streams[0] ?? null;
          audio.autoplay = true;
          audio.style.display = "none";
          document.body.appendChild(audio);
          audio.play().catch((playErr: unknown) => {
            log.warn("Remote audio play() failed: %o", playErr);
          });
          remoteAudioRef.current = audio;
          log.info("Remote audio track received and playing");
        }
      };

      // Reconnection logic (mirrors authenticated hook's D-09 behavior): on connection state failure
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        log.info("RTCPeerConnection state: %s", state);

        if (
          (state === "disconnected" || state === "failed") &&
          !intentionalCloseRef.current
        ) {
          const MAX_RECONNECT = 3;
          const DELAYS = [1000, 2000, 4000];

          if (reconnectAttemptRef.current < MAX_RECONNECT) {
            reconnectAttemptRef.current++;
            const delay = DELAYS[reconnectAttemptRef.current - 1] ?? 4000;
            log.info(
              "WebRTC disconnect detected, reconnecting in %dms (attempt %d/%d)",
              delay,
              reconnectAttemptRef.current,
              MAX_RECONNECT,
            );
            setConnectionState("reconnecting");
            connectionStateRef.current = "reconnecting";
            optionsRef.current.onConnectionStateChange?.("reconnecting");

            cleanup();
            reconnectTimerRef.current = setTimeout(() => {
              void connect(lastConnectLocaleRef.current, lastConnectPersonaIdRef.current).catch(
                () => {
                  // Reconnect attempt failed -- will be retried by next state change
                },
              );
            }, delay);
          } else if (reconnectAttemptRef.current >= MAX_RECONNECT) {
            log.error("WebRTC connection failed after 3 attempts");
            setConnectionState("error");
            connectionStateRef.current = "error";
            optionsRef.current.onConnectionStateChange?.("error");
            optionsRef.current.onError?.(
              new Error("WebRTC connection failed after 3 attempts"),
            );
          }
        }
      };

      // Step 8: Create SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      log.info("SDP offer created and set as local description");

      // Step 9: Wait for ICE gathering complete (or timeout after 5 seconds)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
          return;
        }
        let resolved = false;
        const onGatheringChange = () => {
          if (pc.iceGatheringState === "complete" && !resolved) {
            resolved = true;
            pc.removeEventListener("icegatheringstatechange", onGatheringChange);
            resolve();
          }
        };
        pc.addEventListener("icegatheringstatechange", onGatheringChange);
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            pc.removeEventListener("icegatheringstatechange", onGatheringChange);
            log.warn("ICE gathering timeout (5s), proceeding with available candidates");
            resolve();
          }
        }, 5000);
      });

      // Step 10: Open signaling WebSocket to Azure
      // Browser WebSocket cannot set custom headers, so we append the API key
      // as a query parameter to the signaling URL (Azure documented pattern).
      const separator = session.signaling_url.includes("?") ? "&" : "?";
      const signalingUrl = `${session.signaling_url}${separator}api-key=${encodeURIComponent(session.auth_token)}`;

      return new Promise<{
        avatarEnabled: boolean;
        model: string;
        mode: "agent" | "model";
        iceServers: RTCIceServer[];
      }>((resolve, reject) => {
        const ws = new WebSocket(signalingUrl);
        signalingWsRef.current = ws;

        let resolved = false;

        ws.onopen = () => {
          // Step 11: Send SDP offer to Azure
          log.info("Signaling WebSocket open, sending rtc.call.sdp.create");
          ws.send(
            JSON.stringify({
              type: "rtc.call.sdp.create",
              sdp_offer: pc.localDescription?.sdp,
            }),
          );
        };

        ws.onmessage = (event: MessageEvent) => {
          let msg: Record<string, unknown>;
          try {
            msg = JSON.parse(event.data as string) as Record<string, unknown>;
          } catch {
            log.warn("Non-JSON signaling message, ignoring");
            return;
          }

          const msgType = msg.type as string | undefined;
          if (msgType) {
            log.event(msgType);
          }

          switch (msgType) {
            // Step 12: Handle SDP answer from Azure
            case "rtc.call.sdp.created": {
              const sdpAnswer = msg.sdp_answer as string;
              if (sdpAnswer) {
                log.info("SDP answer received, setting remote description");
                // Step 13: Set remote description
                pc.setRemoteDescription({ type: "answer", sdp: sdpAnswer })
                  .then(() => {
                    log.info("Remote description set successfully");

                    // Step 14: Send session.update with session config
                    const sessionUpdate = {
                      type: "session.update",
                      session: session.session_config,
                    };
                    ws.send(JSON.stringify(sessionUpdate));
                    log.info("session.update sent via signaling WebSocket");

                    // Step 15: Mark as connected
                    setConnectionState("connected");
                    connectionStateRef.current = "connected";
                    setAudioState("idle");
                    optionsRef.current.onConnectionStateChange?.("connected");

                    if (!resolved) {
                      resolved = true;
                      resolve({
                        avatarEnabled: false,
                        model: session.model,
                        mode: session.mode === "agent" ? "agent" : "model",
                        iceServers: [],
                      });
                    }
                  })
                  .catch((err: unknown) => {
                    log.error("setRemoteDescription failed: %o", err);
                    if (!resolved) {
                      resolved = true;
                      const error =
                        err instanceof Error ? err : new Error("Failed to set remote SDP");
                      setConnectionState("error");
                      connectionStateRef.current = "error";
                      optionsRef.current.onConnectionStateChange?.("error");
                      optionsRef.current.onError?.(error);
                      reject(error);
                    }
                  });
              }
              break;
            }

            case "error": {
              log.error("Signaling error: %o", msg.error);
              if (!resolved) {
                resolved = true;
                const error = new Error(
                  (msg.error as Record<string, unknown>)?.message as string ||
                    "Signaling error",
                );
                setConnectionState("error");
                connectionStateRef.current = "error";
                optionsRef.current.onConnectionStateChange?.("error");
                optionsRef.current.onError?.(error);
                reject(error);
              }
              break;
            }
          }
        };

        ws.onerror = () => {
          log.error("Signaling WebSocket error");
          if (!resolved) {
            resolved = true;
            const error = new Error("Signaling WebSocket connection failed");
            setConnectionState("error");
            connectionStateRef.current = "error";
            optionsRef.current.onConnectionStateChange?.("error");
            optionsRef.current.onError?.(error);
            reject(error);
          }
        };

        ws.onclose = (closeEvent: CloseEvent) => {
          log.info(
            "Signaling WebSocket closed: code=%d reason=%s",
            closeEvent.code,
            closeEvent.reason || "(none)",
          );
          log.info("Event summary: %o", getEventSummary());
        };

        // Timeout for connection establishment
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            const error = new Error("WebRTC connection timeout (30s)");
            setConnectionState("error");
            connectionStateRef.current = "error";
            optionsRef.current.onConnectionStateChange?.("error");
            optionsRef.current.onError?.(error);
            reject(error);
          }
        }, 30_000);
      });
    },
    [cleanup, handleDataChannelMessage],
  );

  /** Disconnect and clean up all WebRTC resources. */
  const disconnect = useCallback(async () => {
    log.info("disconnect() called, intentional close");
    intentionalCloseRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    cleanup();
    setConnectionState("disconnected");
    connectionStateRef.current = "disconnected";
    setAudioState("idle");
    setIsMuted(false);
    setIsAvatarConnected(false);
    optionsRef.current.onConnectionStateChange?.("disconnected");
  }, [cleanup]);

  /** Toggle microphone mute by enabling/disabling mic tracks. */
  const toggleMute = useCallback(() => {
    setIsMuted((prev: boolean) => {
      const next = !prev;
      log.info("toggleMute: muted=%s", next);
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => {
          track.enabled = !next;
        });
      }
      setAudioState(next ? "muted" : "idle");
      optionsRef.current.onAudioStateChange?.(next ? "muted" : "idle");
      return next;
    });
  }, []);

  /** Send a raw message via the signaling WebSocket. */
  const send = useCallback((data: unknown) => {
    if (signalingWsRef.current?.readyState === WebSocket.OPEN) {
      signalingWsRef.current.send(
        typeof data === "string" ? data : JSON.stringify(data),
      );
    } else {
      log.warn(
        "send() dropped: signalingWs readyState=%s",
        signalingWsRef.current ? signalingWsRef.current.readyState : "null",
      );
    }
  }, []);

  /** Send text message to the conversation via signaling WebSocket. */
  const sendTextMessage = useCallback(
    async (text: string) => {
      log.info("sendTextMessage: len=%d", text.length);
      send({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      });
      send({ type: "response.create" });
    },
    [send],
  );

  /**
   * Send audio data -- no-op for WebRTC transport.
   * Audio goes via RTP track directly, not manual base64 sending.
   */
  const sendAudio = useCallback((_base64Audio: string) => {
    log.debug("sendAudio() called but no-op for WebRTC transport (audio via RTP)");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      cleanup();
    };
  }, [cleanup]);

  return {
    connect,
    disconnect,
    toggleMute,
    sendTextMessage,
    sendAudio,
    send,
    isMuted,
    connectionState,
    audioState,
    avatarSdpCallbackRef,
    avatarCharacter,
    avatarStyle,
    isAvatarConnected,
  };
}
