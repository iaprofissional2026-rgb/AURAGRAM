import React, { useState } from 'react';
import { Search, Heart, MessageCircle, Film, Sparkles, User as UserIcon, MessageSquare } from 'lucide-react';
import { Post, Reel, User } from '../types';

interface ExploreViewProps {
  posts: Post[];
  reels: Reel[];
  users?: User[];
  onSelectPost: (post: Post) => void;
  onSelectUser?: (user: User) => void;
  onStartChat?: (user: User) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  posts,
  reels,
  users = [],
  onSelectPost,
  onSelectUser,
  onStartChat,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Para Você');

  const categories = [
    'Para Você',
    'Em Alta',
    'Fotografia',
    'Tecnologia',
    'Design',
    'Viagem',
    'Gastronomia',
    'Música',
  ];

  const query = searchQuery.trim().toLowerCase();

  // Find matching users in Firestore
  const matchingUsers = query
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(query) ||
          u.name.toLowerCase().includes(query) ||
          u.bio?.toLowerCase().includes(query)
      )
    : [];

  // Filter posts
  const filteredPosts = posts.filter((p) => {
    if (!query) return true;
    return (
      p.caption.toLowerCase().includes(query) ||
      p.author.username.toLowerCase().includes(query) ||
      p.author.name.toLowerCase().includes(query) ||
      p.tags?.some((t) => t.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-2 md:px-4 py-4 space-y-5">
      {/* Search Header */}
      <div className="relative max-w-xl mx-auto">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="text"
          placeholder="Pesquisar pessoas reais, @usuários, legendas..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 pl-11 pr-4 py-3 rounded-2xl focus:outline-none focus:border-pink-500 transition-colors shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Matching Users Card (Real people discovery) */}
      {query && matchingUsers.length > 0 && (
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-pink-500" />
              Pessoas Encontradas ({matchingUsers.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {matchingUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 rounded-xl transition-colors"
              >
                <div
                  onClick={() => onSelectUser && onSelectUser(user)}
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                >
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-10 h-10 rounded-full object-cover ring-1 ring-zinc-700 shrink-0"
                  />
                  <div className="min-w-0 truncate">
                    <p className="text-xs font-bold text-white truncate">@{user.username}</p>
                    <p className="text-[11px] text-zinc-400 truncate">{user.name}</p>
                  </div>
                </div>

                {onStartChat && (
                  <button
                    onClick={() => onStartChat(user)}
                    className="p-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 text-xs font-semibold shrink-0 ml-2 transition-colors flex items-center gap-1"
                    title="Enviar Mensagem"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Conversar</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeCategory === category
                ? 'bg-white text-black shadow-md'
                : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Staggered Explore Media Grid */}
      {filteredPosts.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <Sparkles className="w-10 h-10 text-zinc-600 mx-auto" />
          <h4 className="text-sm font-bold text-zinc-300">Nenhuma publicação encontrada</h4>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Tente buscar por outro termo ou compartilhe a primeira foto da comunidade!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1 md:gap-4">
          {filteredPosts.map((post, idx) => {
            const isLarge = idx % 5 === 1;

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post)}
                className={`group relative bg-zinc-900 overflow-hidden cursor-pointer rounded-lg md:rounded-2xl ${
                  isLarge ? 'row-span-2 col-span-2 aspect-square' : 'aspect-square'
                }`}
              >
                {post.mediaType === 'video' ? (
                  <video
                    src={post.mediaUrl}
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <img
                    src={post.mediaUrl}
                    alt={post.caption}
                    className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                      post.filter ? `filter-${post.filter}` : ''
                    }`}
                    loading="lazy"
                  />
                )}

                {post.mediaType === 'video' && (
                  <div className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-md">
                    <Film className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold text-sm">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-5 h-5 fill-white" />
                    <span>{post.likesCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MessageCircle className="w-5 h-5 fill-white" />
                    <span>{post.commentsCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
