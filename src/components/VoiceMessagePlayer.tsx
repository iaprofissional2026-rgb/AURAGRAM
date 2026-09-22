import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, FastForward } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration?: number;
  isMe?: boolean;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration = 0,
  isMe = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pseudo waveform bar heights (deterministic based on audio length / seed)
  const barHeights = [
    24, 40, 60, 35, 75, 90, 50, 65, 80, 45, 70, 85, 
    55, 95, 60, 40, 75, 65, 85, 50, 70, 45, 60, 30
  ];

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.playbackRate = playbackSpeed;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e: any) => {
      console.warn('Audio playback error', e);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audioRef.current = null;
    };
  }, [audioUrl]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Could not play audio', err);
        setIsPlaying(false);
      });
    }
  };

  // Handle Speed Change (1x -> 1.5x -> 2x -> 1x)
  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Seek on waveform click
  const handleSeek = (index: number) => {
    if (!audioRef.current) return;
    const ratio = index / barHeights.length;
    const targetTime = ratio * (audioDuration || 1);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatSec = (sec: number) => {
    const s = Math.floor(sec || 0);
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    return `${mins}:${rem.toString().padStart(2, '0')}`;
  };

  const progressRatio = audioDuration > 0 ? currentTime / audioDuration : 0;

  return (
    <div className="flex flex-col gap-1.5 py-1 min-w-[210px] sm:min-w-[240px]">
      {/* Top Player Row */}
      <div className="flex items-center gap-2.5">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 shadow-md shrink-0 ${
            isMe
              ? 'bg-white text-pink-600 hover:bg-zinc-100'
              : 'bg-gradient-to-tr from-pink-500 to-rose-500 text-white hover:opacity-90'
          }`}
          title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio HD'}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        {/* Waveform Scrubber */}
        <div className="flex-1 flex items-center gap-0.5 sm:gap-1 h-8 cursor-pointer select-none">
          {barHeights.map((h, i) => {
            const barRatio = i / barHeights.length;
            const isFilled = barRatio <= progressRatio;

            return (
              <div
                key={i}
                onClick={() => handleSeek(i)}
                className="flex-1 h-full flex items-center justify-center group"
                title={`Ir para ${formatSec(barRatio * audioDuration)}`}
              >
                <div
                  className={`w-full rounded-full transition-all duration-150 ${
                    isFilled
                      ? isMe 
                        ? 'bg-white' 
                        : 'bg-pink-400'
                      : isMe 
                        ? 'bg-white/35 group-hover:bg-white/60' 
                        : 'bg-zinc-600 group-hover:bg-zinc-500'
                  }`}
                  style={{
                    height: `${Math.max(15, h)}%`,
                    minWidth: '2px',
                    maxWidth: '4px',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Speed Modifier Button */}
        <button
          onClick={toggleSpeed}
          className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-bold font-mono transition-colors shrink-0 ${
            isMe
              ? 'bg-white/20 hover:bg-white/30 text-white'
              : 'bg-zinc-700/80 hover:bg-zinc-700 text-pink-300 border border-pink-500/20'
          }`}
          title="Alterar velocidade de reprodução"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Bottom Info Row: Time & Quality Badge */}
      <div className={`flex items-center justify-between text-[10px] font-medium px-0.5 ${
        isMe ? 'text-white/80' : 'text-zinc-400'
      }`}>
        <span className="font-mono">
          {formatSec(currentTime)} / {formatSec(audioDuration || duration)}
        </span>
        <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-semibold opacity-75">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Áudio HD (Opus)
        </span>
      </div>
    </div>
  );
};
