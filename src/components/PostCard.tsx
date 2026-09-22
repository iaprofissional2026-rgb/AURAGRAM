import React, { useState, useRef } from 'react';
import { 
  Heart, 
  MessageCircle, 
  Send, 
  Bookmark, 
  MoreHorizontal, 
  Music, 
  MapPin, 
  Volume2, 
  VolumeX,
  Share2,
  Check,
  Smile
} from 'lucide-react';
import { Post, User } from '../types';
import { sounds } from '../utils/audioSynth';

interface PostCardProps {
  post: Post;
  currentUser: User;
  onLike: (postId: string) => void;
  onComment: (postId: string, text: string) => void;
  onSave: (postId: string) => void;
  onShareToChat?: (post: Post) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUser,
  onLike,
  onComment,
  onSave,
  onShareToChat,
}) => {
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [isMuted, setIsMuted] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [expandedCaption, setExpandedCaption] = useState(false);
  
  const lastTapRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle double tap to like with sound & heart animation
  const handleMediaTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (!post.isLiked) {
        onLike(post.id);
      }
      sounds.playLikePop();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  const handleLikeClick = () => {
    sounds.playLikePop();
    onLike(post.id);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onComment(post.id, newCommentText.trim());
    setNewCommentText('');
    setShowComments(true);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Publicação de @${post.author.username}`,
          text: post.caption,
          url: window.location.href,
        });
        return;
      } catch {}
    }
    // Fallback: Copy link
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  return (
    <article className="bg-black md:bg-zinc-950 md:border md:border-zinc-800/80 md:rounded-2xl mb-4 md:mb-6 overflow-hidden max-w-[470px] mx-auto w-full transition-shadow hover:shadow-lg hover:shadow-zinc-950/50">
      {/* Header */}
      <header className="flex items-center justify-between px-3.5 py-3 border-b border-zinc-800/40">
        <div className="flex items-center gap-3">
          <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600">
            <img
              src={post.author.avatar}
              alt={post.author.username}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-black"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                {post.author.username}
              </span>
              {post.author.isVerified && (
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center font-bold">
                  ✓
                </span>
              )}
              <span className="text-zinc-500 text-xs">·</span>
              <span className="text-[11px] text-zinc-400">{post.createdAt}</span>
            </div>
            {post.location && (
              <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                <MapPin className="w-3 h-3 text-pink-500" />
                <span className="truncate max-w-[200px]">{post.location}</span>
              </div>
            )}
          </div>
        </div>

        <button 
          aria-label="Mais opções"
          className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-900 transition-colors"
        >
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </header>

      {/* Media Container with double-tap support */}
      <div 
        onClick={handleMediaTap}
        className="relative bg-zinc-900 aspect-square w-full select-none cursor-pointer overflow-hidden flex items-center justify-center"
      >
        {post.mediaType === 'video' ? (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={post.mediaUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className={`w-full h-full object-cover ${post.filter ? `filter-${post.filter}` : ''}`}
            />
            <button
              onClick={toggleAudio}
              className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 text-white backdrop-blur-md hover:bg-black/80 transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <img
            src={post.mediaUrl}
            alt={post.caption}
            className={`w-full h-full object-cover transition-transform duration-300 ${post.filter ? `filter-${post.filter}` : ''}`}
            loading="lazy"
          />
        )}

        {/* Double-tap animated heart pop */}
        {showHeartBurst && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none animate-ping">
            <Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-2xl scale-125" />
          </div>
        )}

        {/* Music track tag badge */}
        {post.musicTrack && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-zinc-200 border border-white/10">
            <Music className="w-3 h-3 text-pink-400 animate-pulse" />
            <span className="truncate max-w-[180px]">{post.musicTrack}</span>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <div className="px-3.5 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-4">
            {/* Like */}
            <button
              onClick={handleLikeClick}
              aria-label="Curtir"
              className="transition-transform active:scale-125 text-zinc-200 hover:text-white"
            >
              <Heart 
                className={`w-6 h-6 transition-colors ${
                  post.isLiked ? 'text-rose-500 fill-rose-500' : ''
                }`} 
              />
            </button>

            {/* Comment Toggle */}
            <button
              onClick={() => setShowComments(!showComments)}
              aria-label="Comentar"
              className="text-zinc-200 hover:text-white transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
            </button>

            {/* Share */}
            <button
              onClick={handleShare}
              aria-label="Compartilhar"
              className="text-zinc-200 hover:text-white transition-colors relative"
            >
              {copiedLink ? <Check className="w-6 h-6 text-emerald-400" /> : <Send className="w-6 h-6 -rotate-12" />}
            </button>
          </div>

          {/* Bookmark / Save */}
          <button
            onClick={() => onSave(post.id)}
            aria-label="Salvar"
            className="text-zinc-200 hover:text-white transition-transform active:scale-110"
          >
            <Bookmark className={`w-6 h-6 ${post.isSaved ? 'text-white fill-white' : ''}`} />
          </button>
        </div>

        {/* Likes Count */}
        <p className="text-xs font-bold text-white mb-1.5">
          {post.likesCount.toLocaleString('pt-BR')} curtidas
        </p>

        {/* Caption */}
        <div className="text-xs leading-relaxed text-zinc-200 mb-1.5">
          <span className="font-bold text-white mr-1.5">{post.author.username}</span>
          <span>
            {expandedCaption || post.caption.length <= 90 
              ? post.caption 
              : `${post.caption.slice(0, 90)}... `}
          </span>
          {post.caption.length > 90 && (
            <button
              onClick={() => setExpandedCaption(!expandedCaption)}
              className="text-zinc-500 hover:text-zinc-300 font-medium ml-1"
            >
              {expandedCaption ? 'menos' : 'mais'}
            </button>
          )}
        </div>

        {/* View comments button */}
        {post.commentsCount > 0 && (
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-xs text-zinc-500 hover:text-zinc-300 block mb-2"
          >
            {showComments 
              ? 'Ocultar comentários' 
              : `Ver todos os ${post.commentsCount} comentários`}
          </button>
        )}

        {/* Comments Section */}
        {showComments && (
          <div className="space-y-2 pt-1 pb-2 border-t border-zinc-900">
            {post.comments.map((comment) => (
              <div key={comment.id} className="flex items-start justify-between text-xs py-1">
                <div className="flex items-start gap-2">
                  <img src={comment.userAvatar} alt="" className="w-5 h-5 rounded-full object-cover shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-white mr-1.5">{comment.username}</span>
                    <span className="text-zinc-300">{comment.text}</span>
                    <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-0.5">
                      <span>{comment.createdAt}</span>
                      {(comment.likesCount ?? 0) > 0 && (
                        <span>{comment.likesCount} curtidas</span>
                      )}
                    </div>
                  </div>
                </div>
                <button 
                  aria-label="Curtir comentário"
                  className="text-zinc-500 hover:text-rose-500 p-1"
                >
                  <Heart className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Quick Emoji Bar */}
        <div className="flex items-center gap-2 py-1 overflow-x-auto no-scrollbar">
          {['❤️', '🔥', '🙌', '😍', '👏', '🚀', '💯'].map((emoji) => (
            <button
              key={emoji}
              onClick={() => setNewCommentText((prev) => prev + emoji)}
              className="text-sm hover:scale-125 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Add Comment Input Form */}
        <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-zinc-900/90">
          <Smile className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Adicione um comentário..."
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            className="w-full bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
          />
          {newCommentText.trim() && (
            <button
              type="submit"
              className="text-xs font-semibold text-pink-500 hover:text-pink-400 shrink-0 transition-colors"
            >
              Publicar
            </button>
          )}
        </form>
      </div>
    </article>
  );
};
