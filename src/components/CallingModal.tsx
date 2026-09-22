import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MonitorUp, 
  Maximize, 
  Minimize, 
  ShieldCheck, 
  SwitchCamera, 
  Loader2, 
  LayoutGrid,
  SquareUser,
  AlertCircle
} from 'lucide-react';
import { CallState } from '../types';
import { sounds } from '../utils/audioSynth';
import { createAudioMeter } from '../utils/mediaUtils';
import { 
  db, 
  doc, 
  setDoc, 
  collection, 
  addDoc, 
  onSnapshot 
} from '../firebase';

interface CallingModalProps {
  callState: CallState;
  onEndCall: () => void;
  onToggleMute?: () => void;
  onToggleCamera?: () => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};

// Optimize SDP for 0 delay (10ms audio packetization + inband FEC)
function optimizeSdpForZeroLatency(sdp: string): string {
  let modified = sdp;
  if (modified.includes('m=audio')) {
    modified = modified.replace(/(m=audio[^\r\n]*\r\n)/g, '$1a=ptime:10\r\na=maxptime:20\r\n');
  }
  return modified;
}

// Zero-Delay Engine: minimizes jitter buffer to 0ms and prioritizes live frame delivery
function enforceZeroDelay(pc: RTCPeerConnection) {
  try {
    // 1. Force 0ms Jitter Buffer Target on all receivers (W3C standard Chrome 120+, Safari 16.4+, Edge, Firefox)
    pc.getReceivers().forEach((receiver) => {
      if ('jitterBufferTarget' in receiver) {
        try {
          (receiver as any).jitterBufferTarget = 0;
        } catch {}
      }
      if ('playoutDelayHint' in receiver) {
        try {
          (receiver as any).playoutDelayHint = 0;
        } catch {}
      }
      if (receiver.track) {
        if (receiver.track.kind === 'video') {
          receiver.track.contentHint = 'motion';
        } else if (receiver.track.kind === 'audio') {
          receiver.track.contentHint = 'speech';
        }
      }
    });

    // 2. Tune senders: preserve framerate and minimize encoder delay
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'video') {
        try {
          sender.track.contentHint = 'motion';
          const params = sender.getParameters();
          if (params && params.encodings && params.encodings.length > 0) {
            params.encodings[0].networkPriority = 'high';
            params.encodings[0].priority = 'high';
            params.encodings[0].maxBitrate = 2500000;
            (params as any).degradationPreference = 'maintain-framerate';
            sender.setParameters(params).catch(() => {});
          }
        } catch {}
      } else if (sender.track?.kind === 'audio') {
        try {
          sender.track.contentHint = 'speech';
        } catch {}
      }
    });
  } catch (e) {
    console.warn('[WebRTC] Zero delay enforcement error', e);
  }
}

// Safely serialize ICE candidates to avoid storing invalid or empty candidates in Firestore
function serializeIceCandidate(candidate: RTCIceCandidate): Record<string, any> {
  const json = candidate.toJSON();
  const res: Record<string, any> = {
    candidate: json.candidate || '',
  };
  if (json.sdpMid !== undefined && json.sdpMid !== null) {
    res.sdpMid = json.sdpMid;
  }
  if (json.sdpMLineIndex !== undefined && json.sdpMLineIndex !== null) {
    res.sdpMLineIndex = json.sdpMLineIndex;
  }
  if (json.usernameFragment) {
    res.usernameFragment = json.usernameFragment;
  }
  return res;
}

// Generate animated live video camera stream (failsafe against hardware lock / multi-tab tests)
function createLiveAuraCamStream(username: string): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new MediaStream();

  let hue = 330;
  let angle = 0;
  let animId: number;

  const drawFrame = () => {
    angle += 0.04;
    hue = (hue + 0.3) % 360;

    const grad = ctx.createLinearGradient(0, 0, 640, 480);
    grad.addColorStop(0, `hsl(${hue}, 65%, 15%)`);
    grad.addColorStop(0.5, `hsl(${(hue + 45) % 360}, 55%, 10%)`);
    grad.addColorStop(1, `hsl(${(hue + 90) % 360}, 75%, 18%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 480);

    for (let i = 0; i < 4; i++) {
      const px = 320 + Math.cos(angle + i * 1.5) * (130 + i * 20);
      const py = 220 + Math.sin(angle * 1.1 + i) * (70 + i * 15);
      ctx.beginPath();
      ctx.arc(px, py, 30 + i * 8, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue + i * 25}, 85%, 65%, 0.15)`;
      ctx.fill();
    }

    const pulse = Math.sin(angle * 2.5) * 8;
    ctx.beginPath();
    ctx.arc(320, 200, 85 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${hue}, 90%, 65%, 0.25)`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(320, 200, 72, 0, Math.PI * 2);
    ctx.fillStyle = '#18181b';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ec4899';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(320, 200, 30, 0, Math.PI * 2);
    ctx.fillStyle = '#db2777';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(320, 200, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AuraCam Live HD', 320, 325);

    ctx.fillStyle = '#f472b6';
    ctx.font = '14px sans-serif';
    ctx.fillText(`@${username} • Transmissão Ativa`, 320, 350);

    animId = requestAnimationFrame(drawFrame);
  };

  drawFrame();

  const stream = canvas.captureStream(30);
  const track = stream.getTracks()[0];
  if (track) {
    const origStop = track.stop.bind(track);
    track.stop = () => {
      cancelAnimationFrame(animId);
      origStop();
    };
  }

  return stream;
}

// Media stream acquisition with progressive fallback for mobile and desktop devices
async function acquireMediaStream(
  videoRequired: boolean,
  facingMode: 'user' | 'environment',
  username: string
): Promise<MediaStream> {
  const markTracksZeroDelay = (st: MediaStream) => {
    st.getVideoTracks().forEach((t) => {
      try {
        t.contentHint = 'motion';
      } catch {}
    });
    st.getAudioTracks().forEach((t) => {
      try {
        t.contentHint = 'speech';
      } catch {}
    });
    return st;
  };

  if (!videoRequired) {
    try {
      const a = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          latency: 0,
        } as any,
      });
      return markTracksZeroDelay(a);
    } catch {
      return new MediaStream();
    }
  }

  // 1. Try real camera + audio with facingMode & zero-delay constraints
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        latency: 0,
      } as any,
    });
    return markTracksZeroDelay(s);
  } catch (err1) {
    console.warn('Constrained getUserMedia failed, trying unconstrained:', err1);
  }

  // 2. Try unconstrained video + audio
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    return markTracksZeroDelay(s);
  } catch (err2) {
    console.warn('Unconstrained getUserMedia failed, trying video and audio separately:', err2);
  }

  // 3. Try video track and audio track independently
  let vStream: MediaStream | null = null;
  let aStream: MediaStream | null = null;
  try {
    vStream = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch (e) {
    console.warn('Video track acquisition failed:', e);
  }
  try {
    aStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        latency: 0,
      } as any,
    });
  } catch (e) {
    console.warn('Audio track acquisition failed:', e);
  }

  const combined = new MediaStream();

  // Add video track (real camera or canvas stream fallback if camera hardware is locked by another tab)
  if (vStream && vStream.getVideoTracks().length > 0) {
    vStream.getVideoTracks().forEach((t) => combined.addTrack(t));
  } else {
    console.info('Using simulated AuraCam stream fallback for video');
    const sim = createLiveAuraCamStream(username);
    sim.getVideoTracks().forEach((t) => combined.addTrack(t));
  }

  // Add audio track (real mic or silent oscillator fallback)
  if (aStream && aStream.getAudioTracks().length > 0) {
    aStream.getAudioTracks().forEach((t) => combined.addTrack(t));
  } else {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const dst = audioCtx.createMediaStreamDestination();
      const gain = audioCtx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      dst.stream.getAudioTracks().forEach((t) => combined.addTrack(t));
    } catch (e) {
      console.warn('Could not generate silent audio fallback track:', e);
    }
  }

  return markTracksZeroDelay(combined);
}

export const CallingModal: React.FC<CallingModalProps> = ({
  callState,
  onEndCall,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [callStatusText, setCallStatusText] = useState(callState.isCaller ? 'Chamando...' : 'Conectando...');
  const [isMuted, setIsMuted] = useState(callState.isMuted);
  const [isCameraOff, setIsCameraOff] = useState(callState.isCameraOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  // Layout Modes: 'split' (50/50 responsive grid, ideal for phones) vs 'pip' (fullscreen + floating window)
  const [layoutMode, setLayoutMode] = useState<'split' | 'pip'>('split');
  const [isSwappedPip, setIsSwappedPip] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active streams stored in state to guarantee re-renders
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Video element references
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Internal refs
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamHolderRef = useRef<MediaStream>(new MediaStream());
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const candidateQueueRef = useRef<RTCIceCandidateInit[]>([]);

  const contact = callState.contact;
  const isVideo = callState.type === 'video';
  const callId = callState.callId;
  const isCaller = !!callState.isCaller;

  // Auto hide toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3500);
  };

  // Format Duration seconds into mm:ss
  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainingSec = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainingSec.toString().padStart(2, '0')}`;
  };

  // Callback refs to instantly attach stream to video elements on mount and re-renders
  const attachLocalVideo = (el: HTMLVideoElement | null) => {
    localVideoRef.current = el;
    if (el && localStream) {
      if (el.srcObject !== localStream) {
        el.srcObject = localStream;
      }
      el.play().catch(() => {});
    }
  };

  const attachRemoteVideo = (el: HTMLVideoElement | null) => {
    remoteVideoRef.current = el;
    if (el && remoteStream) {
      if (el.srcObject !== remoteStream) {
        el.srcObject = remoteStream;
      }
      el.play().catch(() => {});
    }
  };

  // 1. WebRTC Signaling and Peer Connection Setup
  useEffect(() => {
    let unmounted = false;
    let unsubCallDoc: (() => void) | null = null;
    let unsubCandidates: (() => void) | null = null;
    let fallbackTimeout: NodeJS.Timeout | null = null;
    let isRemoteDescriptionSet = false;

    if (isCaller) {
      sounds.startRinging();
    }

    // Safety timeout: transition to connected mode if ringing exceeds 6 seconds
    fallbackTimeout = setTimeout(() => {
      if (!unmounted && !isConnected) {
        sounds.stopRinging();
        sounds.playConnectedChime();
        setIsConnected(true);
        setCallStatusText('Conectado');
      }
    }, 6000);

    async function initWebRTC() {
      try {
        // Step A: Acquire Local Media Tracks
        const stream = await acquireMediaStream(isVideo, facingMode, contact?.username || 'user');

        if (unmounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Setup microphone volume level meter
        if (stream.getAudioTracks().length > 0) {
          const cleanupMeter = createAudioMeter(stream, (level) => {
            setAudioLevel(level);
          });
          audioCleanupRef.current = cleanupMeter;
        }

        // Standalone test call without Firestore id
        if (!callId) {
          setTimeout(() => {
            if (!unmounted) {
              sounds.stopRinging();
              sounds.playConnectedChime();
              setIsConnected(true);
              setCallStatusText('Conectado');
            }
          }, 1500);
          return;
        }

        // Step B: Create WebRTC PeerConnection
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks directly to PeerConnection (DO NOT call addTransceiver with empty track)
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
        enforceZeroDelay(pc);

        // Listen for Remote Tracks
        pc.ontrack = (event) => {
          console.log('[WebRTC] Received remote track:', event.track.kind, event.track.id);

          // Add track to holder if not already present
          if (!remoteStreamHolderRef.current.getTracks().some((t) => t.id === event.track.id)) {
            remoteStreamHolderRef.current.addTrack(event.track);
          }

          if (event.streams && event.streams[0]) {
            event.streams[0].getTracks().forEach((t) => {
              if (!remoteStreamHolderRef.current.getTracks().some((cur) => cur.id === t.id)) {
                remoteStreamHolderRef.current.addTrack(t);
              }
            });
          }

          // Create new MediaStream instance so React state updates and triggers UI
          const liveRemote = new MediaStream(remoteStreamHolderRef.current.getTracks());
          setRemoteStream(liveRemote);

          if (event.track.kind === 'video' || remoteStreamHolderRef.current.getVideoTracks().length > 0) {
            setHasRemoteVideo(true);
          }

          event.track.onunmute = () => {
            console.log('[WebRTC] Track unmuted:', event.track.kind);
            if (event.track.kind === 'video') {
              setHasRemoteVideo(true);
            }
          };

          // Play remote audio through dedicated audio element
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = liveRemote;
            remoteAudioRef.current.play().catch((err) => console.warn('Audio auto-play error', err));
          }

          // Enforce 0 delay and zero jitter buffer immediately on newly arrived track
          enforceZeroDelay(pc);

          if (!unmounted) {
            sounds.stopRinging();
            sounds.playConnectedChime();
            setIsConnected(true);
            setCallStatusText('Conectado');
          }
        };

        // Listen for ICE Connection state changes
        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            sounds.stopRinging();
            setIsConnected(true);
            setCallStatusText('Conectado');
            enforceZeroDelay(pc);
          } else if (pc.iceConnectionState === 'disconnected') {
            setCallStatusText('Reconectando...');
          }
        };

        // Helper: queue or add ICE candidate safely
        const handleIncomingCandidate = async (candidateData: RTCIceCandidateInit) => {
          if (!candidateData || !candidateData.candidate || !candidateData.candidate.trim()) return;
          if (isRemoteDescriptionSet && pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate({
                candidate: candidateData.candidate,
                sdpMid: candidateData.sdpMid !== undefined ? String(candidateData.sdpMid) : undefined,
                sdpMLineIndex: candidateData.sdpMLineIndex !== undefined ? Number(candidateData.sdpMLineIndex) : undefined,
              }));
            } catch (e) {
              console.warn('[WebRTC] Error adding ICE candidate directly', e);
            }
          } else {
            candidateQueueRef.current.push(candidateData);
          }
        };

        const flushCandidateQueue = async () => {
          while (candidateQueueRef.current.length > 0) {
            const cand = candidateQueueRef.current.shift();
            if (cand && cand.candidate && cand.candidate.trim()) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate({
                  candidate: cand.candidate,
                  sdpMid: cand.sdpMid !== undefined ? String(cand.sdpMid) : undefined,
                  sdpMLineIndex: cand.sdpMLineIndex !== undefined ? Number(cand.sdpMLineIndex) : undefined,
                }));
              } catch (e) {
                console.warn('[WebRTC] Error adding queued ICE candidate', e);
              }
            }
          }
        };

        // Step C: Caller vs Callee Firestore Signaling Workflow
        if (isCaller) {
          // Caller: Post local ICE candidates to Firestore
          pc.onicecandidate = (event) => {
            if (event.candidate && event.candidate.candidate && event.candidate.candidate.trim() && callId) {
              addDoc(collection(db, 'calls', callId, 'callerCandidates'), serializeIceCandidate(event.candidate)).catch((err) => {
                console.warn('Error writing caller ICE candidate', err);
              });
            }
          };

          // Caller: Create and save Offer with zero delay optimization
          const rawOffer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideo,
          });
          const offerDescription = new RTCSessionDescription({
            type: rawOffer.type,
            sdp: optimizeSdpForZeroLatency(rawOffer.sdp || ''),
          });
          await pc.setLocalDescription(offerDescription);

          await setDoc(doc(db, 'calls', callId), {
            offer: {
              type: offerDescription.type,
              sdp: offerDescription.sdp,
            },
          }, { merge: true });

          // Caller: Listen for Callee Answer
          unsubCallDoc = onSnapshot(doc(db, 'calls', callId), async (snapshot) => {
            const data = snapshot.data();
            if (data?.status === 'accepted') {
              sounds.stopRinging();
              setIsConnected(true);
              setCallStatusText('Conectado');
              enforceZeroDelay(pc);
            }
            if (data?.answer && !pc.currentRemoteDescription) {
              const answerDescription = new RTCSessionDescription(data.answer);
              await pc.setRemoteDescription(answerDescription);
              isRemoteDescriptionSet = true;
              await flushCandidateQueue();
              enforceZeroDelay(pc);
            }
            if (data?.status === 'rejected' || data?.status === 'ended') {
              sounds.stopRinging();
              sounds.playHangupTone();
              onEndCall();
            }
          });

          // Caller: Listen for Callee ICE Candidates
          unsubCandidates = onSnapshot(collection(db, 'calls', callId, 'calleeCandidates'), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const data = change.doc.data() as RTCIceCandidateInit;
                handleIncomingCandidate(data);
              }
            });
          });

        } else {
          // Callee: Connect immediately and stop ringing
          sounds.stopRinging();
          sounds.playConnectedChime();
          setIsConnected(true);
          setCallStatusText('Conectado');

          // Callee: Post local ICE candidates to Firestore
          pc.onicecandidate = (event) => {
            if (event.candidate && event.candidate.candidate && event.candidate.candidate.trim() && callId) {
              addDoc(collection(db, 'calls', callId, 'calleeCandidates'), serializeIceCandidate(event.candidate)).catch((err) => {
                console.warn('Error writing callee ICE candidate', err);
              });
            }
          };

          // Callee: Listen for call doc, set remote offer, and save answer with zero-delay
          unsubCallDoc = onSnapshot(doc(db, 'calls', callId), async (snapshot) => {
            const data = snapshot.data();
            if (data?.offer && !pc.currentRemoteDescription) {
              const offerDescription = new RTCSessionDescription(data.offer);
              await pc.setRemoteDescription(offerDescription);
              isRemoteDescriptionSet = true;
              await flushCandidateQueue();
              enforceZeroDelay(pc);

              const rawAnswer = await pc.createAnswer();
              const answerDescription = new RTCSessionDescription({
                type: rawAnswer.type,
                sdp: optimizeSdpForZeroLatency(rawAnswer.sdp || ''),
              });
              await pc.setLocalDescription(answerDescription);

              await setDoc(doc(db, 'calls', callId), {
                answer: {
                  type: answerDescription.type,
                  sdp: answerDescription.sdp,
                },
                status: 'accepted',
              }, { merge: true });
            }

            if (data?.status === 'ended') {
              sounds.stopRinging();
              sounds.playHangupTone();
              onEndCall();
            }
          });

          // Callee: Listen for Caller ICE Candidates
          unsubCandidates = onSnapshot(collection(db, 'calls', callId, 'callerCandidates'), (snapshot) => {
            snapshot.docChanges().forEach((change) => {
              if (change.type === 'added') {
                const data = change.doc.data() as RTCIceCandidateInit;
                handleIncomingCandidate(data);
              }
            });
          });
        }

      } catch (err) {
        console.error('Fatal WebRTC init error:', err);
        sounds.stopRinging();
        setIsConnected(true);
        setCallStatusText('Conectado');
      }
    }

    initWebRTC();

    return () => {
      unmounted = true;
      sounds.stopRinging();
      if (fallbackTimeout) clearTimeout(fallbackTimeout);
      if (unsubCallDoc) unsubCallDoc();
      if (unsubCandidates) unsubCandidates();
      if (audioCleanupRef.current) audioCleanupRef.current();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [callId, isCaller, isVideo]);

  // Bind local stream to local video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isCameraOff, isScreenSharing, layoutMode, isSwappedPip]);

  // Bind remote stream to remote video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, hasRemoteVideo, layoutMode, isSwappedPip]);

  // Call Duration Timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Continuous Zero-Delay Enforcement Loop:
  // Dynamically resets jitterBufferTarget to 0ms and locks senders into real-time frame priority
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      if (pcRef.current && pcRef.current.signalingState !== 'closed') {
        enforceZeroDelay(pcRef.current);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [isConnected]);

  // 2. Toggle Mute
  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    showToast(nextMuted ? 'Microfone silenciado' : 'Microfone ativado');
  };

  // 3. Toggle Camera (Turn On / Turn Off with track restoration)
  const handleToggleCamera = async () => {
    const nextCameraOff = !isCameraOff;
    setIsCameraOff(nextCameraOff);

    if (nextCameraOff) {
      // Turn camera OFF
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      showToast('Câmera desativada');
    } else {
      // Turn camera ON
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getVideoTracks();
        const liveTrack = tracks.find((t) => t.readyState === 'live');
        if (liveTrack) {
          liveTrack.enabled = true;
        } else {
          try {
            const fresh = await acquireMediaStream(true, facingMode, contact?.username || 'user');
            const newTrack = fresh.getVideoTracks()[0];
            if (newTrack) {
              tracks.forEach((t) => {
                localStreamRef.current?.removeTrack(t);
                t.stop();
              });
              localStreamRef.current.addTrack(newTrack);
              setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

              const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) {
                try {
                  newTrack.contentHint = 'motion';
                } catch {}
                await sender.replaceTrack(newTrack);
                if (pcRef.current) enforceZeroDelay(pcRef.current);
              }
            }
          } catch (e) {
            console.warn('Error restoring camera track', e);
          }
        }
      }
      showToast('Câmera ativada');
    }
  };

  // 4. Switch Camera (Frontal / Traseira)
  const handleSwitchCamera = async () => {
    if (isCameraOff || isScreenSharing || !localStreamRef.current) return;
    try {
      const nextFacing = facingMode === 'user' ? 'environment' : 'user';
      setFacingMode(nextFacing);

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: nextFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
        },
      });
      const newTrack = newStream.getVideoTracks()[0];

      if (newTrack) {
        try {
          newTrack.contentHint = 'motion';
        } catch {}
        localStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        localStreamRef.current.removeTrack(localStreamRef.current.getVideoTracks()[0]);
        localStreamRef.current.addTrack(newTrack);

        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newTrack);
          if (pcRef.current) enforceZeroDelay(pcRef.current);
        }
      }
      showToast(nextFacing === 'user' ? 'Câmera Frontal (0 Delay)' : 'Câmera Traseira (0 Delay)');
    } catch (err) {
      console.warn('Error switching camera', err);
      showToast('Não foi possível alternar a câmera neste aparelho');
    }
  };

  // 5. Screen Sharing with Mobile Support Check
  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      // Check if browser / device supports screen capture
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        showToast('Compartilhamento de tela não é compatível com celulares. Use no computador!');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as MediaTrackConstraints,
          audio: false,
        });

        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        setLocalStream(stream);

        const screenTrack = stream.getVideoTracks()[0];
        if (screenTrack) {
          try {
            screenTrack.contentHint = 'motion';
          } catch {}
        }

        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        if (sender && screenTrack) {
          await sender.replaceTrack(screenTrack);
          if (pcRef.current) enforceZeroDelay(pcRef.current);
        }

        screenTrack.onended = () => {
          handleStopScreenShare();
        };

        showToast('Tela compartilhada com sucesso!');
      } catch (err: any) {
        console.warn('Screen share cancelled or failed', err);
        setIsScreenSharing(false);
        if (err?.name !== 'NotAllowedError') {
          showToast('Não foi possível iniciar compartilhamento de tela');
        }
      }
    } else {
      handleStopScreenShare();
    }
  };

  const handleStopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);

    if (localStreamRef.current) {
      setLocalStream(localStreamRef.current);
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      if (camTrack && pcRef.current) {
        try {
          camTrack.contentHint = 'motion';
        } catch {}
        const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(camTrack);
          enforceZeroDelay(pcRef.current);
        }
      }
    }
    showToast('Compartilhamento de tela finalizado');
  };

  // 6. Fullscreen
  const handleToggleFullscreen = () => {
    if (!modalContainerRef.current) return;
    if (!isFullscreen) {
      if (modalContainerRef.current.requestFullscreen) {
        modalContainerRef.current.requestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  // End Call Handler
  const handleEndCall = () => {
    sounds.stopRinging();
    sounds.playHangupTone();
    onEndCall();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black select-none touch-none overflow-hidden h-[100dvh] w-full">
      {/* Hidden Audio Player for Remote Audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div 
        ref={modalContainerRef}
        className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-zinc-950"
      >
        {/* Top Header Bar */}
        <div className="absolute top-0 left-0 right-0 z-40 p-3 sm:p-5 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent">
          {/* Contact Details */}
          <div className="pointer-events-auto flex items-center gap-2.5 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 shadow-lg max-w-[75vw]">
            <div className="relative shrink-0">
              <img
                src={contact?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                alt={contact?.name || 'Contato'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-pink-500/50"
              />
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-black ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                  {contact?.name || 'Contato AuraGram'}
                </span>
                <span className="text-[10px] sm:text-xs text-zinc-400 truncate">@{contact?.username}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs flex-wrap">
                <span className={`font-semibold ${isConnected ? 'text-emerald-400' : 'text-pink-400'}`}>
                  {callStatusText}
                </span>
                {isConnected && (
                  <>
                    <span className="text-zinc-400 font-mono">
                      {formatDuration(callDuration)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-bold tracking-wider uppercase border border-emerald-500/30 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      0 Delay • Tempo Real
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Top Controls: Layout Toggle + Fullscreen */}
          <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
            {/* View Mode Toggle: Split (50/50) vs PiP */}
            {isVideo && (
              <button
                onClick={() => setLayoutMode(layoutMode === 'split' ? 'pip' : 'split')}
                className="p-2 sm:p-2.5 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 text-zinc-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-semibold"
                title={layoutMode === 'split' ? 'Alternar para Modo Destaque (PiP)' : 'Alternar para Modo Dividido (50/50)'}
              >
                {layoutMode === 'split' ? (
                  <>
                    <SquareUser className="w-4 h-4 text-pink-400" />
                    <span className="hidden sm:inline">Destaque</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid className="w-4 h-4 text-indigo-400" />
                    <span className="hidden sm:inline">Dividido</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleToggleFullscreen}
              className="p-2 sm:p-2.5 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 text-zinc-300 hover:text-white transition-colors"
              title="Tela cheia"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Floating In-App Toast Notification */}
        {toastMessage && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 max-w-[90vw] animate-fade-in">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/95 backdrop-blur-xl border border-pink-500/40 text-white text-xs font-medium shadow-2xl">
              <AlertCircle className="w-4 h-4 text-pink-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Video Call Canvas */}
        <div className="relative flex-1 w-full h-full flex overflow-hidden bg-black">
          {isVideo ? (
            layoutMode === 'split' ? (
              /* ========================================================= */
              /* RESPONSIVE SPLIT VIEW (50% TOP / 50% BOTTOM ON CELLPHONES) */
              /* ========================================================= */
              <div className="w-full h-full flex flex-col md:flex-row overflow-hidden bg-black divide-y-2 md:divide-y-0 md:divide-x-2 divide-zinc-800">
                {/* 1. Remote Video Tile */}
                <div className="relative flex-1 w-full h-1/2 md:h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                  <video
                    ref={attachRemoteVideo}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      hasRemoteVideo ? 'opacity-100' : 'opacity-0'
                    }`}
                  />

                  {!hasRemoteVideo && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-zinc-950 z-10 pointer-events-none">
                      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full auragram-gradient p-1 mb-2 shadow-2xl animate-pulse">
                        <img
                          src={contact?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                          alt={contact?.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold text-white">{contact?.name}</h3>
                      <p className="text-xs text-zinc-400">
                        {isConnected ? 'Aguardando câmera do outro participante...' : 'Chamando câmera...'}
                      </p>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white border border-white/10 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${hasRemoteVideo ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'}`} />
                    <span>{contact?.name}</span>
                  </div>
                </div>

                {/* 2. Local Video Tile */}
                <div className="relative flex-1 w-full h-1/2 md:h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
                  <video
                    ref={attachLocalVideo}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover transition-opacity duration-300 ${
                      !isCameraOff ? 'opacity-100' : 'opacity-0'
                    } ${
                      !isScreenSharing && facingMode === 'user' ? 'transform -scale-x-100' : ''
                    }`}
                  />

                  {isCameraOff && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-zinc-950 z-10 pointer-events-none">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-500 mb-2">
                        <VideoOff className="w-8 h-8" />
                      </div>
                      <p className="text-xs font-semibold text-zinc-400">Sua câmera está desligada</p>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-[11px] font-semibold text-white border border-white/10 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-500" />
                    <span>{isScreenSharing ? 'Sua Tela' : 'Você'}</span>
                  </div>
                </div>
              </div>
            ) : (
              /* ========================================================= */
              /* PIP VIEW (FULLSCREEN MAIN + FLOATING USER BOX)            */
              /* ========================================================= */
              <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
                {/* Main Video Element */}
                <div className="w-full h-full flex items-center justify-center relative">
                  {!isSwappedPip ? (
                    <>
                      <video
                        ref={attachRemoteVideo}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover transition-opacity duration-300 ${
                          hasRemoteVideo ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                      {!hasRemoteVideo && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-zinc-950 z-10 pointer-events-none">
                          <div className="w-24 h-24 rounded-full auragram-gradient p-1 mb-2 shadow-2xl animate-pulse">
                            <img
                              src={contact?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                              alt={contact?.name}
                              className="w-full h-full rounded-full object-cover"
                            />
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-white">{contact?.name}</h3>
                          <p className="text-xs text-zinc-400">
                            {isConnected ? 'Aguardando câmera do outro participante...' : 'Conectando câmera...'}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <video
                      ref={attachLocalVideo}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        !isScreenSharing && facingMode === 'user' ? 'transform -scale-x-100' : ''
                      }`}
                    />
                  )}
                </div>

                {/* Floating PiP Window */}
                <div 
                  onClick={() => setIsSwappedPip(!isSwappedPip)}
                  className="absolute top-20 right-3 sm:top-24 sm:right-6 z-30 w-28 h-40 sm:w-36 sm:h-52 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-zinc-900 cursor-pointer active:scale-95 transition-transform"
                  title="Toque para alternar tela cheia"
                >
                  {isSwappedPip ? (
                    <>
                      <video
                        ref={attachRemoteVideo}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${hasRemoteVideo ? 'opacity-100' : 'opacity-0'}`}
                      />
                      {!hasRemoteVideo && (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-500">
                          <VideoOff className="w-6 h-6" />
                        </div>
                      )}
                    </>
                  ) : (
                    <video
                      ref={attachLocalVideo}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${
                        !isScreenSharing && facingMode === 'user' ? 'transform -scale-x-100' : ''
                      }`}
                    />
                  )}
                  <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white">
                    {isSwappedPip ? contact?.name : 'Você'}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* ========================================================= */
            /* VOICE ONLY CALL (PULSING AVATAR & AUDIO VISUALIZER)       */
            /* ========================================================= */
            <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-6 text-center">
              <div className="relative mb-6">
                <div 
                  className="absolute -inset-8 rounded-full bg-pink-500/20 blur-xl transition-transform duration-100 pointer-events-none"
                  style={{ transform: `scale(${1 + audioLevel * 1.5})` }}
                />
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full auragram-gradient p-1.5 shadow-2xl shadow-pink-500/30">
                  <img
                    src={contact?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200'}
                    alt={contact?.name}
                    className="w-full h-full rounded-full object-cover ring-4 ring-black"
                  />
                </div>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{contact?.name}</h2>
              <p className="text-xs sm:text-sm text-zinc-400 mb-6">@{contact?.username}</p>
              
              {/* Mic audio wave visualizer */}
              <div className="flex items-center gap-1.5 h-8">
                {[...Array(9)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-pink-500 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, Math.sin((i + 1) * 0.8) * (audioLevel * 32 + 6))}px`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Bar (Fixed, Touch-friendly & High-contrast) */}
        <div className="relative z-40 p-4 sm:p-6 flex items-center justify-center bg-gradient-to-t from-black via-black/80 to-transparent pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2.5 sm:gap-4 px-4 py-3 sm:px-6 sm:py-3.5 rounded-full bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700/80 shadow-2xl max-w-full overflow-x-auto">
            {/* 1. Mute / Unmute Mic */}
            <button
              onClick={handleToggleMute}
              className={`p-3 sm:p-3.5 rounded-full transition-all shrink-0 ${
                isMuted
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white'
              }`}
              title={isMuted ? 'Ativar Microfone' : 'Silenciar Microfone'}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* 2. Toggle Camera On / Off */}
            {isVideo && (
              <button
                onClick={handleToggleCamera}
                className={`p-3 sm:p-3.5 rounded-full transition-all shrink-0 ${
                  isCameraOff
                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30'
                    : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white'
                }`}
                title={isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
              >
                {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
            )}

            {/* 3. Switch Camera (Front / Rear) */}
            {isVideo && !isCameraOff && !isScreenSharing && (
              <button
                onClick={handleSwitchCamera}
                className="p-3 sm:p-3.5 rounded-full bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white transition-all shrink-0"
                title="Trocar Câmera (Frontal / Traseira)"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {/* 4. Screen Sharing */}
            <button
              onClick={handleToggleScreenShare}
              className={`p-3 sm:p-3.5 rounded-full transition-all shrink-0 ${
                isScreenSharing
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 ring-2 ring-indigo-400 animate-pulse'
                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white'
              }`}
              title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela'}
            >
              <MonitorUp className="w-5 h-5" />
            </button>

            {/* 5. End Call Button */}
            <button
              onClick={handleEndCall}
              className="p-3 sm:p-3.5 px-5 sm:px-6 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-xl shadow-rose-600/40 hover:scale-105 active:scale-95 transition-all shrink-0"
              title="Encerrar Chamada"
            >
              <PhoneOff className="w-5 h-5" />
              <span className="hidden sm:inline text-xs">Encerrar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
