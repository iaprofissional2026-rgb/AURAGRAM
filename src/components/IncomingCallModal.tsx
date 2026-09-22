import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, Sparkles, Volume2 } from 'lucide-react';
import { User, IncomingCallNotification } from '../types';
import { sounds } from '../utils/audioSynth';

interface IncomingCallModalProps {
  incomingCall: IncomingCallNotification;
  onAccept: () => void;
  onDecline: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onDecline,
}) => {
  const isVideo = incomingCall.type === 'video';
  const caller = incomingCall.caller;

  useEffect(() => {
    sounds.startRinging();
    return () => {
      sounds.stopRinging();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-zinc-900/90 border border-zinc-700/80 p-6 flex flex-col items-center text-center shadow-2xl shadow-pink-500/10 relative overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Header tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-400 text-xs font-semibold mb-6">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isVideo ? 'Chamada de Vídeo Recebida' : 'Chamada de Voz Recebida'}</span>
        </div>

        {/* Caller Avatar with Animated Rings */}
        <div className="relative mb-6">
          <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 animate-ping opacity-30" />
          <div className="absolute -inset-1.5 rounded-full auragram-gradient animate-pulse" />
          <img
            src={caller.avatar}
            alt={caller.name}
            className="w-24 h-24 rounded-full object-cover relative z-10 border-4 border-black shadow-xl"
          />
          <div className="absolute bottom-0 right-0 z-20 p-1.5 rounded-full bg-pink-500 text-white shadow-lg">
            {isVideo ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
          </div>
        </div>

        {/* Caller Name & Handle */}
        <h3 className="text-xl font-bold text-white mb-1">
          {caller.name}
        </h3>
        <p className="text-sm text-zinc-400 mb-6">
          @{caller.username} está chamando você...
        </p>

        {/* Ringing indicator */}
        <div className="flex items-center gap-2 text-xs text-pink-400 font-medium mb-8 animate-pulse">
          <Volume2 className="w-4 h-4" />
          <span>Tocando no AuraGram...</span>
        </div>

        {/* Action Buttons: Decline (Red) & Accept (Green) */}
        <div className="flex items-center justify-center gap-8 w-full">
          {/* Decline */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onDecline}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 hover:scale-110 active:scale-95 transition-all"
              title="Recusar Chamada"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-xs font-semibold text-zinc-400">Recusar</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onAccept}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all animate-bounce"
              title="Atender Chamada"
            >
              {isVideo ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
            </button>
            <span className="text-xs font-bold text-emerald-400">Atender</span>
          </div>
        </div>
      </div>
    </div>
  );
};
