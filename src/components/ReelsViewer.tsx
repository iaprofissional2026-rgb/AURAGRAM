import React, { useState, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  Volume2, 
  VolumeX, 
  Music, 
  Disc, 
  Share2, 
  Plus, 
  Check,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Reel, User } from '../types';
import { sounds } from '../utils/audioSynth';

interface ReelsViewerProps {
  reels: Reel[];
  currentUser: User;
  onLikeReel: (reelId: string) => void;
  onSaveReel: (reelId: string) => void;
  onCommentReel: (reelId: string, text: string) => void;
}

export const ReelsViewer: React.FC<ReelsViewerProps> = ({
  reels,
  currentUser,
  onLikeReel,
  onSaveReel,
  onCommentReel,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const activeReel = reels[activeIndex];
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTapRef = useRef<number>(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!activeReel.isLiked) {
        onLikeReel(activeReel.id);
      }
      sounds.playLikePop();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const toggleFollow = (authorId: string) => {
    setFollowingMap((prev) => ({
      ...prev,
      [authorId]: !prev[authorId],
    }));
  };

  const handleNext = () => {
    if (activeIndex < reels.length - 1) {
      setActiveIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) {
      setActiveIndex((i) => i - 1);
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    onCommentReel(activeReel.id, commentInput.trim());
    setCommentInput('');
  };

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] max-w-[460px] mx-auto flex items-center justify-center select-none">
      {/* Navigation Buttons for desktop */}
      <div className="hidden md:flex flex-col gap-3 absolute -right-16 top-1/2 -translate-y-1/2 z-30">
        <button
          onClick={handlePrev}
          disabled={activeIndex === 0}
          className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white disabled:opacity-30 hover:bg-zinc-800 transition-colors"
          title="Reel Anterior"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          onClick={handleNext}
          disabled={activeIndex === reels.length - 1}
          className="p-3 rounded-full bg-zinc-900 border border-zinc-800 text-white disabled:opacity-30 hover:bg-zinc-800 transition-colors"
          title="Próximo Reel"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>

      {/* Reel Card */}
      <div 
        onClick={handleDoubleTap}
        className="relative w-full h-full max-h-[820px] rounded-2xl md:rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col justify-between"
      >
        {/* Video Player */}
        <video
          ref={videoRef}
          key={activeReel.videoUrl}
          src={activeReel.videoUrl}
          autoPlay
          loop
          muted={isMuted}
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Double-tap heart animation */}
        {showHeartBurst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-ping">
            <Heart className="w-28 h-28 text-rose-500 fill-rose-500 drop-shadow-2xl" />
          </div>
        )}

        {/* Top Sound Toggle */}
        <div className="relative z-20 p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-white drop-shadow-md">Reels</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="p-2.5 rounded-full bg-black/50 text-white backdrop-blur-md hover:bg-black/70 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Right Side Action Bar */}
        <div className="absolute right-3 bottom-20 z-30 flex flex-col items-center gap-4">
          {/* Like */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              sounds.playLikePop();
              onLikeReel(activeReel.id);
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white group-hover:scale-110 transition-transform">
              <Heart 
                className={`w-7 h-7 transition-colors ${
                  activeReel.isLiked ? 'text-rose-500 fill-rose-500' : 'text-white'
                }`} 
              />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow">
              {activeReel.likesCount.toLocaleString()}
            </span>
          </button>

          {/* Comments */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowComments(true);
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white group-hover:scale-110 transition-transform">
              <MessageCircle className="w-7 h-7" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow">
              {activeReel.commentsCount}
            </span>
          </button>

          {/* Share */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (navigator.share) {
                navigator.share({ title: 'Reel AuraGram', url: window.location.href });
              }
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white group-hover:scale-110 transition-transform">
              <Send className="w-7 h-7 -rotate-12" />
            </div>
            <span className="text-[11px] font-bold text-white drop-shadow">
              {activeReel.sharesCount}
            </span>
          </button>

          {/* Save */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSaveReel(activeReel.id);
            }}
            className="p-3 rounded-full bg-black/40 backdrop-blur-md text-white hover:scale-110 transition-transform"
          >
            <Bookmark className={`w-7 h-7 ${activeReel.isSaved ? 'text-white fill-white' : ''}`} />
          </button>

          {/* Spinning Vinyl Music Disc */}
          <div className="w-10 h-10 rounded-full bg-black/80 border-2 border-white/40 flex items-center justify-center p-1.5 animate-spin duration-[4000ms]">
            <Disc className="w-full h-full text-pink-400" />
          </div>
        </div>

        {/* Bottom Details & Author */}
        <div className="relative z-20 p-4 pb-6 bg-gradient-to-t from-black via-black/80 to-transparent pr-16">
          {/* Author info */}
          <div className="flex items-center gap-3 mb-2.5">
            <img
              src={activeReel.author.avatar}
              alt={activeReel.author.username}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-white/70"
            />
            <span className="text-xs font-bold text-white">
              @{activeReel.author.username}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFollow(activeReel.author.id);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                followingMap[activeReel.author.id]
                  ? 'bg-transparent text-white/80 border-white/30'
                  : 'bg-white text-black border-white hover:bg-zinc-200'
              }`}
            >
              {followingMap[activeReel.author.id] ? 'Seguindo' : 'Seguir'}
            </button>
          </div>

          {/* Caption */}
          <p className="text-xs text-white/90 leading-relaxed mb-3 line-clamp-2">
            {activeReel.caption}
          </p>

          {/* Music Track */}
          <div className="flex items-center gap-2 text-xs text-white/80">
            <Music className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
            <span className="truncate max-w-[220px]">{activeReel.musicTrack}</span>
          </div>
        </div>
      </div>

      {/* Reel Comments Drawer */}
      {showComments && (
        <div 
          onClick={() => setShowComments(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[460px] bg-zinc-950 rounded-t-3xl border-t border-zinc-800 p-4 max-h-[60vh] flex flex-col"
          >
            <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <span className="text-sm font-bold text-white">Comentários ({activeReel.comments.length})</span>
              <button onClick={() => setShowComments(false)} className="text-xs text-zinc-400">Fechar</button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-3">
              {activeReel.comments.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 text-xs">
                  <img src={c.userAvatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
                  <div className="flex-1">
                    <span className="font-bold text-white mr-1.5">{c.username}</span>
                    <span className="text-zinc-300">{c.text}</span>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{c.createdAt}</div>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-zinc-800">
              <input
                type="text"
                placeholder="Adicione um comentário..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 bg-zinc-900 px-3 py-2 rounded-xl text-xs text-white focus:outline-none"
              />
              <button type="submit" className="text-xs font-bold text-pink-500 px-2">
                Enviar
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
