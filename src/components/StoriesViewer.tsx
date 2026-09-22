import React, { useState, useEffect, useRef } from 'react';
import { X, Pause, Play, ChevronLeft, ChevronRight, Send, Heart, Flame, ThumbsUp, Laugh } from 'lucide-react';
import { Story, User } from '../types';
import { sounds } from '../utils/audioSynth';

interface StoriesViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
  onReply: (authorId: string, text: string) => void;
  currentUser: User;
}

export const StoriesViewer: React.FC<StoriesViewerProps> = ({
  stories,
  initialIndex = 0,
  onClose,
  onReply,
  currentUser,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);

  const currentStory = stories[currentIndex];
  const timerRef = useRef<number | null>(null);

  const DURATION_MS = 5000;
  const INTERVAL_MS = 50;

  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        const next = prev + (INTERVAL_MS / DURATION_MS) * 100;
        if (next >= 100) {
          handleNext();
          return 0;
        }
        return next;
      });
    }, INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentIndex, isPaused]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onReply(currentStory.author.id, `Respondeu ao seu story: "${replyText}"`);
    setReplyText('');
    setReplySent(true);
    setTimeout(() => setReplySent(false), 2000);
  };

  const handleSendReaction = (emoji: string) => {
    sounds.playLikePop();
    onReply(currentStory.author.id, `Reagiu ao seu story: ${emoji}`);
    setReplySent(true);
    setTimeout(() => setReplySent(false), 1500);
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center select-none">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Story container */}
      <div 
        className="relative w-full max-w-[420px] h-full max-h-[850px] md:h-[90vh] md:rounded-2xl overflow-hidden bg-zinc-950 flex flex-col justify-between shadow-2xl"
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Progress bars header */}
        <div className="absolute top-0 left-0 right-0 z-30 p-3 pt-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex gap-1.5 mb-3">
            {stories.map((s, idx) => (
              <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all ease-linear"
                  style={{
                    width:
                      idx < currentIndex
                        ? '100%'
                        : idx === currentIndex
                        ? `${progress}%`
                        : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Author info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src={currentStory.author.avatar}
                alt={currentStory.author.name}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-white/50"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  {currentStory.author.username}
                </span>
                <span className="text-[10px] text-white/70">{currentStory.createdAt}</span>
              </div>
            </div>

            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-full bg-black/40 text-white/80 hover:text-white"
            >
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Media content */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {currentStory.mediaType === 'video' ? (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              playsInline
              loop
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className={`w-full h-full object-cover ${currentStory.filter ? `filter-${currentStory.filter}` : ''}`}
            />
          )}

          {/* Text sticker overlay */}
          {currentStory.textSticker && (
            <div className="absolute bottom-24 left-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 text-center shadow-lg pointer-events-none">
              <p className="text-sm font-semibold text-white tracking-wide">
                {currentStory.textSticker}
              </p>
            </div>
          )}

          {/* Tap touch zones for prev / next */}
          <div
            onClick={handlePrev}
            className="absolute left-0 top-16 bottom-24 w-1/3 z-20 cursor-pointer"
          />
          <div
            onClick={handleNext}
            className="absolute right-0 top-16 bottom-24 w-1/3 z-20 cursor-pointer"
          />
        </div>

        {/* Story reply footer & quick reactions */}
        <div className="relative z-30 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
          {/* Reaction chips */}
          <div className="flex items-center justify-around mb-2">
            {[
              { emoji: '🔥', icon: <Flame className="w-4 h-4 text-orange-400" /> },
              { emoji: '❤️', icon: <Heart className="w-4 h-4 text-rose-500 fill-rose-500" /> },
              { emoji: '👏', icon: <ThumbsUp className="w-4 h-4 text-amber-400" /> },
              { emoji: '😂', icon: <Laugh className="w-4 h-4 text-yellow-400" /> },
            ].map(({ emoji, icon }) => (
              <button
                key={emoji}
                onClick={() => handleSendReaction(emoji)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 active:scale-125 transition-transform"
                title={`Reagir com ${emoji}`}
              >
                {icon}
              </button>
            ))}
          </div>

          <form onSubmit={handleSendReply} className="flex items-center gap-2">
            <input
              type="text"
              placeholder={`Responder a ${currentStory.author.username}...`}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1 bg-white/10 hover:bg-white/15 focus:bg-white/20 text-xs text-white placeholder:text-white/60 px-4 py-2.5 rounded-full border border-white/20 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={!replyText.trim()}
              className="p-2.5 rounded-full bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-40 transition-opacity"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>

          {replySent && (
            <div className="text-center text-[11px] text-emerald-400 font-medium mt-1 animate-pulse">
              ✓ Mensagem enviada!
            </div>
          )}
        </div>
      </div>

      {/* Nav Chevrons for desktop */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrev}
          className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {currentIndex < stories.length - 1 && (
        <button
          onClick={handleNext}
          className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
    </div>
  );
};
