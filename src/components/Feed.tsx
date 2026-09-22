import React from 'react';
import { Plus, Sparkles, Check, Heart } from 'lucide-react';
import { Post, Story, User } from '../types';
import { PostCard } from './PostCard';

interface FeedProps {
  currentUser: User;
  stories: Story[];
  posts: Post[];
  suggestedUsers: User[];
  onOpenStoryCreator: () => void;
  onOpenStoriesViewer: (storyIndex: number) => void;
  onLikePost: (postId: string) => void;
  onCommentPost: (postId: string, text: string) => void;
  onSavePost: (postId: string) => void;
  onFollowUser: (userId: string) => void;
  followingMap: Record<string, boolean>;
}

export const Feed: React.FC<FeedProps> = ({
  currentUser,
  stories,
  posts,
  suggestedUsers,
  onOpenStoryCreator,
  onOpenStoriesViewer,
  onLikePost,
  onCommentPost,
  onSavePost,
  onFollowUser,
  followingMap,
}) => {
  return (
    <div className="max-w-5xl mx-auto flex justify-center gap-8 px-2 md:px-4 py-4">
      {/* Left / Center: Main Feed Content */}
      <main className="w-full max-w-[480px]">
        {/* Horizontal Stories Carousel */}
        <section 
          aria-label="Stories"
          className="bg-black md:bg-zinc-950 md:border md:border-zinc-800/80 md:rounded-2xl p-3.5 mb-5 flex items-center gap-4 overflow-x-auto no-scrollbar"
        >
          {/* Add your story button */}
          <button
            onClick={onOpenStoryCreator}
            className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-full p-0.5 border-2 border-dashed border-pink-500/60 group-hover:border-pink-500 transition-colors">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-pink-500 text-white flex items-center justify-center ring-2 ring-black shadow-md group-hover:scale-110 transition-transform">
                <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              </div>
            </div>
            <span className="text-[11px] text-zinc-300 font-medium truncate max-w-[68px]">
              Seu Story
            </span>
          </button>

          {/* Friends' stories */}
          {stories.map((story, idx) => (
            <button
              key={story.id}
              onClick={() => onOpenStoriesViewer(idx)}
              className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
            >
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 group-hover:scale-105 transition-transform shadow-sm">
                <img
                  src={story.author.avatar}
                  alt={story.author.username}
                  className="w-full h-full rounded-full object-cover ring-2 ring-black"
                />
              </div>
              <span className="text-[11px] text-zinc-300 font-medium truncate max-w-[68px]">
                {story.author.username}
              </span>
            </button>
          ))}
        </section>

        {/* Posts Stream */}
        <section aria-label="Feed de Publicações" className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={currentUser}
              onLike={onLikePost}
              onComment={onCommentPost}
              onSave={onSavePost}
            />
          ))}
        </section>
      </main>

      {/* Right Desktop Sidebar (Instagram Suggestions) */}
      <aside className="hidden lg:block w-80 space-y-6 pt-2">
        {/* User profile card */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="w-12 h-12 rounded-full object-cover ring-2 ring-pink-500/40"
            />
            <div>
              <p className="text-xs font-bold text-white">@{currentUser.username}</p>
              <p className="text-[11px] text-zinc-400">{currentUser.name}</p>
            </div>
          </div>
          <span className="text-xs font-semibold text-pink-500">Aura Pro</span>
        </div>

        {/* Suggestions header */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-400">Sugestões para você</span>
            <button className="text-xs font-semibold text-white hover:text-pink-400">
              Ver tudo
            </button>
          </div>

          {/* Suggested accounts */}
          <div className="space-y-3">
            {suggestedUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={user.avatar}
                    alt={user.username}
                    className="w-9 h-9 rounded-full object-cover"
                  />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                        {user.username}
                      </span>
                      {user.isVerified && (
                        <span className="w-3 h-3 rounded-full bg-blue-500 text-[8px] text-white flex items-center justify-center font-bold">
                          ✓
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-400">Novo no AuraGram</span>
                  </div>
                </div>

                <button
                  onClick={() => onFollowUser(user.id)}
                  className={`text-xs font-semibold transition-colors ${
                    followingMap[user.id]
                      ? 'text-zinc-500 hover:text-zinc-400'
                      : 'text-pink-500 hover:text-pink-400'
                  }`}
                >
                  {followingMap[user.id] ? 'Seguindo' : 'Seguir'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-[11px] text-zinc-600 space-y-2 pt-4 border-t border-zinc-900">
          <p>Sobre · Ajuda · Imprensa · API · Carreiras · Privacidade · Termos</p>
          <p>© 2026 AURAGRAM • DESENVOLVIDO COM RECURSOS EM TEMPO REAL</p>
        </div>
      </aside>
    </div>
  );
};
