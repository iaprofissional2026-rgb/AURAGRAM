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
  Volume2, 
  Sparkles, 
  ShieldCheck,
  PhoneCall
} from 'lucide-react';
import { CallState } from '../types';
import { sounds } from '../utils/audioSynth';
import { createAudioMeter } from '../utils/mediaUtils';

interface CallingModalProps {
  callState: CallState;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
}

export const CallingModal: React.FC<CallingModalProps> = ({
  callState,
  onEndCall,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(callState.isMuted);
  const [isCameraOff, setIsCameraOff] = useState(callState.isCameraOff);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const contact = callState.contact;
  const isVideo = callState.type === 'video';

  // Start call lifecycle: ring -> connect after 2.5s
  useEffect(() => {
    sounds.startRinging();

    const timer = setTimeout(() => {
      sounds.playConnectedChime();
      setIsConnected(true);
    }, 2800);

    return () => {
      clearTimeout(timer);
      sounds.stopRinging();
    };
  }, []);

  // Call duration timer
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // Acquire REAL MediaStream (Camera & Microphone)
  useEffect(() => {
    let active = true;

    async function setupLocalMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideo ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
          audio: true,
        });

        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setHasCameraPermission(true);

        if (localVideoRef.current && isVideo) {
          localVideoRef.current.srcObject = stream;
        }

        // Setup real audio meter from microphone
        const cleanupMeter = createAudioMeter(stream, (level) => {
          setAudioLevel(level);
        });
        audioCleanupRef.current = cleanupMeter;

      } catch (err: any) {
        console.warn('Real camera/mic access failed or declined', err);
        setHasCameraPermission(false);
      }
    }

    setupLocalMedia();

    return () => {
      active = false;
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isVideo]);

  // Toggle Mute Audio
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  // Toggle Camera Video
  const toggleCamera = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsCameraOff(!isCameraOff);
    }
  };

  // Real Screen Share using getDisplayMedia
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });
        screenStreamRef.current = screenStream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        setIsScreenSharing(true);

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        };
      } catch (err) {
        console.warn('Screen share canceled or denied', err);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      modalRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleEndCall = () => {
    sounds.playHangupTone();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    onEndCall();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between select-none overflow-hidden"
    >
      {/* Top Header Bar */}
      <header className="relative z-30 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full auragram-gradient flex items-center justify-center shadow-lg shadow-pink-500/30">
            {isVideo ? <Video className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">
                {contact ? contact.name : 'Chamada Segura'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Criptografada
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              {isConnected ? `Duração: ${formatDuration(callDuration)}` : 'Chamando...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio VU Decibel Indicator */}
          <div className="flex items-center gap-1 bg-zinc-900/80 border border-zinc-800 px-3 py-1.5 rounded-full">
            <Mic className={`w-3.5 h-3.5 ${isMuted ? 'text-rose-500' : 'text-emerald-400 animate-pulse'}`} />
            <div className="flex items-center gap-0.5 h-3 w-8">
              {[1, 2, 3, 4, 5].map((bar) => {
                const active = !isMuted && audioLevel > bar * 15;
                return (
                  <div
                    key={bar}
                    className={`w-1 rounded-full transition-all duration-75 ${
                      active ? 'h-3 bg-emerald-400' : 'h-1 bg-zinc-700'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-zinc-900/80 text-zinc-300 hover:text-white border border-zinc-800"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Video / Voice Surface */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-4 md:p-8">
        {isVideo ? (
          <div className="relative w-full h-full max-w-5xl rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex items-center justify-center">
            {/* Remote Peer Stream or Visualizer */}
            <div className="relative w-full h-full flex items-center justify-center bg-zinc-900">
              {isConnected ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  {/* Remote video simulation with responsive participant canvas */}
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-zinc-900 to-black p-6 text-center">
                    <div className="relative mb-6">
                      <img
                        src={contact?.avatar}
                        alt={contact?.name}
                        className="w-32 h-32 md:w-44 md:h-44 rounded-full object-cover ring-4 ring-pink-500/40 shadow-2xl"
                      />
                      <div className="absolute -bottom-2 right-2 p-2 rounded-full bg-emerald-500 text-white shadow-lg animate-bounce">
                        <Mic className="w-4 h-4" />
                      </div>
                    </div>
                    <h3 className="text-xl md:text-2xl font-bold text-white mb-1">
                      {contact?.name}
                    </h3>
                    <p className="text-xs md:text-sm text-zinc-400 max-w-sm">
                      Áudio e Vídeo em Alta Resolução 60FPS • WebRTC Peer Conectado
                    </p>

                    {/* Dynamic Sound Waveform Bars */}
                    <div className="flex items-center gap-1.5 mt-6">
                      {[18, 35, 60, 85, 45, 70, 90, 50, 75, 40, 60, 20].map((h, idx) => (
                        <div
                          key={idx}
                          className="w-1.5 rounded-full bg-gradient-to-t from-pink-500 to-purple-500 animate-pulse"
                          style={{
                            height: `${h}px`,
                            animationDelay: `${idx * 0.1}s`,
                            animationDuration: '0.8s',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="w-28 h-28 rounded-full auragram-gradient p-1 animate-pulse">
                    <img
                      src={contact?.avatar}
                      alt={contact?.name}
                      className="w-full h-full rounded-full object-cover ring-4 ring-black"
                    />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-white">{contact?.name}</h3>
                    <p className="text-xs text-pink-400 font-medium">Chamando via AuraGram HD...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Local Camera Stream Picture-in-Picture */}
            <div className="absolute top-4 right-4 md:top-6 md:right-6 w-36 h-48 md:w-56 md:h-72 rounded-2xl overflow-hidden bg-black border-2 border-zinc-700 shadow-2xl z-30 group">
              {hasCameraPermission === false || isCameraOff ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 text-xs p-2 text-center">
                  <VideoOff className="w-6 h-6 mb-2 text-zinc-600" />
                  <span>Câmera desligada</span>
                </div>
              ) : (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!isScreenSharing ? '-scale-x-100' : ''}`}
                />
              )}
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] text-white font-medium">
                Você {isScreenSharing ? '(Tela)' : ''}
              </div>
            </div>
          </div>
        ) : (
          /* Voice-Only Call Interface */
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-2xl">
            <div className="relative mb-6">
              <div className="w-36 h-36 rounded-full auragram-gradient p-1.5 shadow-2xl shadow-pink-500/20">
                <img
                  src={contact?.avatar}
                  alt={contact?.name}
                  className="w-full h-full rounded-full object-cover ring-4 ring-black"
                />
              </div>
              {isConnected && (
                <div className="absolute bottom-1 right-2 p-2.5 rounded-full bg-emerald-500 text-white shadow-xl animate-bounce">
                  <Volume2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <h2 className="text-xl font-bold text-white mb-1">{contact?.name}</h2>
            <p className="text-xs text-zinc-400 mb-6">@{contact?.username}</p>

            <div className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono">
              {isConnected ? `Em chamada • ${formatDuration(callDuration)}` : 'Chamando...'}
            </div>

            {/* Live Audio Meter Wave */}
            {isConnected && (
              <div className="flex items-center gap-1 mt-8 h-10">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-pink-500 rounded-full transition-all duration-100"
                    style={{
                      height: `${Math.max(6, Math.min(36, (audioLevel / 100) * 36 * (1 + (i % 3) * 0.3)))}px`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Floating Control Dock */}
      <footer className="relative z-30 p-6 flex items-center justify-center gap-4 md:gap-6 bg-gradient-to-t from-black via-black/80 to-transparent">
        {/* Toggle Mute */}
        <button
          onClick={toggleMute}
          className={`p-4 rounded-2xl border transition-all active:scale-95 ${
            isMuted
              ? 'bg-rose-500/20 border-rose-500 text-rose-400'
              : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
          }`}
          title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
        >
          {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        {/* Toggle Camera (If Video Call) */}
        {isVideo && (
          <button
            onClick={toggleCamera}
            className={`p-4 rounded-2xl border transition-all active:scale-95 ${
              isCameraOff
                ? 'bg-rose-500/20 border-rose-500 text-rose-400'
                : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
            }`}
            title={isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
          >
            {isCameraOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
          </button>
        )}

        {/* Screen Share (Real Display Media) */}
        {isVideo && (
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-2xl border transition-all active:scale-95 ${
              isScreenSharing
                ? 'bg-pink-500 border-pink-400 text-white shadow-lg shadow-pink-500/30'
                : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'
            }`}
            title={isScreenSharing ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela'}
          >
            <MonitorUp className="w-6 h-6" />
          </button>
        )}

        {/* End Call (Red Button) */}
        <button
          onClick={handleEndCall}
          className="px-8 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-xl shadow-rose-600/30 active:scale-95 transition-all"
        >
          <PhoneOff className="w-6 h-6" />
          <span className="hidden md:inline">Encerrar</span>
        </button>
      </footer>
    </div>
  );
};
