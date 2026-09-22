import React from 'react';
import { X } from 'lucide-react';
import { Post, User } from '../types';
import { PostCard } from './PostCard';

interface PostDetailModalProps {
  post: Post;
  currentUser: User;
  onClose: () => void;
  onLike: (postId: string) => void;
  onComment: (postId: string, text: string) => void;
  onSave: (postId: string) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({
  post,
  currentUser,
  onClose,
  onLike,
  onComment,
  onSave,
}) => {
  return (
    <div 
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-50"
      >
        <X className="w-6 h-6" />
      </button>

      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg">
        <PostCard
          post={post}
          currentUser={currentUser}
          onLike={onLike}
          onComment={onComment}
          onSave={onSave}
        />
      </div>
    </div>
  );
};
