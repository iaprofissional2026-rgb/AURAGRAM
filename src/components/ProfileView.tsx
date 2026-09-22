import React, { useState, useRef, useEffect } from 'react';
import { 
  Grid, 
  Bookmark, 
  Film, 
  Tag, 
  Settings, 
  Edit3, 
  Camera, 
  ExternalLink, 
  Check, 
  X,
  Heart,
  MessageCircle,
  Sparkles,
  LogOut,
  UserPlus,
  UserCheck,
  MessageSquare
} from 'lucide-react';
import { User, Post, Reel } from '../types';
import { compressImage } from '../utils/imageCompress';

interface ProfileViewProps {
  currentUser: User;
  viewedUser?: User | null;
  onBackToMyProfile?: () => void;
  onUpdateProfile: (updatedUser: User) => void;
  userPosts: Post[];
  savedPosts: Post[];
  userReels: Reel[];
  onSelectPost: (post: Post) => void;
  onLogout?: () => void;
  onFollowUser?: (userId: string) => void;
  isFollowing?: boolean;
  onStartChat?: (user: User) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  viewedUser,
  onBackToMyProfile,
  onUpdateProfile,
  userPosts,
  savedPosts,
  userReels,
  onSelectPost,
  onLogout,
  onFollowUser,
  isFollowing,
  onStartChat,
}) => {
  const displayUser = viewedUser || currentUser;
  const isSelf = displayUser.id === currentUser.id;

  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser.name);
  const [usernameInput, setUsernameInput] = useState(currentUser.username);
  const [bioInput, setBioInput] = useState(currentUser.bio);
  const [websiteInput, setWebsiteInput] = useState(currentUser.website || '');
  const [avatarPreview, setAvatarPreview] = useState(currentUser.avatar);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNameInput(currentUser.name);
    setUsernameInput(currentUser.username);
    setBioInput(currentUser.bio);
    setWebsiteInput(currentUser.website || '');
    setAvatarPreview(currentUser.avatar);
  }, [currentUser]);

  const highlights = [
    { id: 'h1', title: 'Momentos ✨', icon: '🌟' },
    { id: 'h2', title: 'Projetos 🚀', icon: '⚡' },
    { id: 'h3', title: 'Música 🎵', icon: '🎧' },
    { id: 'h4', title: 'Fotos 📸', icon: '🎨' },
  ];

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 400, 0.85);
      setAvatarPreview(compressed);
    } catch (err) {
      console.warn('Avatar compression error', err);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...currentUser,
      name: nameInput.trim(),
      username: usernameInput.trim().toLowerCase(),
      bio: bioInput.trim(),
      website: websiteInput.trim() || undefined,
      avatar: avatarPreview,
    });
    setIsEditing(false);
  };

  const displayedPosts = activeTab === 'saved' && isSelf
    ? savedPosts
    : userPosts.filter((p) => p.author.id === displayUser.id);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Back to my profile banner if viewing someone else */}
      {!isSelf && onBackToMyProfile && (
        <div className="mb-4">
          <button
            onClick={onBackToMyProfile}
            className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            ← Voltar ao Meu Perfil
          </button>
        </div>
      )}

      {/* Profile Header */}
      <header className="flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-12 pb-8 border-b border-zinc-800">
        {/* Avatar with gradient ring */}
        <div className="relative group">
          <div className="w-24 h-24 md:w-36 md:h-36 rounded-full auragram-gradient p-1 shadow-2xl shadow-pink-500/20">
            <img
              src={displayUser.avatar}
              alt={displayUser.name}
              className="w-full h-full rounded-full object-cover ring-4 ring-black"
            />
          </div>
          {isSelf && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2.5 rounded-full bg-pink-500 text-white shadow-lg hover:scale-110 active:scale-95 transition-transform"
              title="Alterar Foto de Perfil"
            >
              <Camera className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Info & Stats */}
        <div className="flex-1 text-center md:text-left space-y-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-1.5">
              @{displayUser.username}
              {displayUser.isVerified && (
                <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                  ✓
                </span>
              )}
            </h1>

            <div className="flex items-center gap-2">
              {isSelf ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-white transition-colors"
                  >
                    Editar Perfil
                  </button>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5"
                      title="Sair da Conta (Logout)"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sair</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {onFollowUser && (
                    <button
                      onClick={() => onFollowUser(displayUser.id)}
                      className={`px-5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isFollowing
                          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                          : 'auragram-gradient text-white shadow-md shadow-pink-500/20'
                      }`}
                    >
                      {isFollowing ? 'Seguindo' : 'Seguir'}
                    </button>
                  )}
                  {onStartChat && (
                    <button
                      onClick={() => onStartChat(displayUser)}
                      className="px-4 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-pink-400" />
                      <span>Mensagem</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Counts */}
          <div className="flex items-center justify-center md:justify-start gap-8 text-xs">
            <div>
              <span className="font-bold text-white text-sm">{displayedPosts.length}</span>
              <span className="text-zinc-400 ml-1.5">publicações</span>
            </div>
            <div>
              <span className="font-bold text-white text-sm">{displayUser.followersCount.toLocaleString()}</span>
              <span className="text-zinc-400 ml-1.5">seguidores</span>
            </div>
            <div>
              <span className="font-bold text-white text-sm">{displayUser.followingCount.toLocaleString()}</span>
              <span className="text-zinc-400 ml-1.5">seguindo</span>
            </div>
          </div>

          {/* Name & Bio */}
          <div className="text-xs space-y-1">
            <h2 className="font-bold text-white text-sm">{displayUser.name}</h2>
            <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{displayUser.bio}</p>
            {displayUser.website && (
              <a
                href={`https://${displayUser.website}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-pink-400 hover:underline font-medium pt-1"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{displayUser.website}</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Story Highlights */}
      <div className="flex items-center gap-4 md:gap-6 py-6 overflow-x-auto no-scrollbar border-b border-zinc-800/80">
        {highlights.map((hl) => (
          <div key={hl.id} className="flex flex-col items-center gap-1.5 shrink-0 cursor-pointer group">
            <div className="w-16 h-16 md:w-18 md:h-18 rounded-full bg-zinc-900 border-2 border-zinc-800 group-hover:border-pink-500 transition-colors flex items-center justify-center text-2xl shadow-sm">
              {hl.icon}
            </div>
            <span className="text-[11px] font-medium text-zinc-300">{hl.title}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-around border-b border-zinc-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('posts')}
          className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
            activeTab === 'posts' ? 'border-pink-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>PUBLICAÇÕES</span>
        </button>

        <button
          onClick={() => setActiveTab('reels')}
          className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
            activeTab === 'reels' ? 'border-pink-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Film className="w-4 h-4" />
          <span>REELS</span>
        </button>

        <button
          onClick={() => setActiveTab('saved')}
          className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
            activeTab === 'saved' ? 'border-pink-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>SALVOS</span>
        </button>

        <button
          onClick={() => setActiveTab('tagged')}
          className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
            activeTab === 'tagged' ? 'border-pink-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Tag className="w-4 h-4" />
          <span>MARCADOS</span>
        </button>
      </div>

      {/* Grid of Posts */}
      <div className="grid grid-cols-3 gap-1 md:gap-4 py-4">
        {activeTab === 'reels' ? (
          userReels.map((reel) => (
            <div
              key={reel.id}
              className="relative aspect-[9/16] bg-zinc-900 rounded-xl overflow-hidden group cursor-pointer"
            >
              <video src={reel.videoUrl} muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 text-white font-bold text-xs">
                <div className="flex items-center gap-1">
                  <Heart className="w-4 h-4 fill-white" />
                  <span>{reel.likesCount}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          displayedPosts.map((post) => (
            <div
              key={post.id}
              onClick={() => onSelectPost(post)}
              className="relative aspect-square bg-zinc-900 rounded-lg md:rounded-2xl overflow-hidden group cursor-pointer"
            >
              {post.mediaType === 'video' ? (
                <video src={post.mediaUrl} muted className="w-full h-full object-cover" />
              ) : (
                <img
                  src={post.mediaUrl}
                  alt={post.caption}
                  className={`w-full h-full object-cover ${post.filter ? `filter-${post.filter}` : ''}`}
                />
              )}

              {/* Hover overlay with likes and comments */}
              <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6 text-white font-bold text-xs">
                <div className="flex items-center gap-1.5">
                  <Heart className="w-4 h-4 fill-white" />
                  <span>{post.likesCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>{post.commentsCount}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 mb-4">
              <h3 className="text-sm font-bold text-white">Editar Perfil</h3>
              <button onClick={() => setIsEditing(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="flex items-center gap-4">
                <img
                  src={avatarPreview}
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-pink-500"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-white hover:bg-zinc-800"
                >
                  Alterar Foto
                </button>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Nome Completo</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Nome de Usuário (@)</label>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Biografia</label>
                <textarea
                  rows={3}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500 resize-none"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Site / Link</label>
                <input
                  type="text"
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder="ex: auragram.app/@voce"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl auragram-gradient text-xs font-bold text-white shadow-lg shadow-pink-500/20"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
