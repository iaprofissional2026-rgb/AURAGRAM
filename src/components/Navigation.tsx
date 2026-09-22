import React from 'react';
import { 
  Home, 
  Search, 
  Compass, 
  Film, 
  MessageCircle, 
  Heart, 
  PlusSquare, 
  User, 
  Video, 
  Sun, 
  Moon, 
  Sparkles,
  Camera
} from 'lucide-react';
import { User as UserType } from '../types';

interface NavigationProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  currentUser: UserType;
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  onOpenCreateModal: () => void;
  onOpenQuickCall: () => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  setCurrentTab,
  currentUser,
  unreadMessagesCount,
  unreadNotificationsCount,
  onOpenCreateModal,
  onOpenQuickCall,
  isDarkMode,
  toggleDarkMode,
}) => {
  return (
    <>
      {/* Desktop Sidebar Navigation (Instagram Style) */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 lg:w-72 bg-black border-r border-zinc-800/80 px-4 py-6 z-40 select-none">
        {/* Brand Wordmark */}
        <div className="px-3 mb-8 flex items-center justify-between">
          <button 
            onClick={() => setCurrentTab('feed')}
            className="flex items-center gap-2 text-left group"
          >
            <div className="w-9 h-9 rounded-xl auragram-gradient flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight font-display text-white">
                Aura<span className="text-pink-500">Gram</span>
              </span>
              <span className="block text-[10px] text-zinc-400 font-medium tracking-wide">
                Social • Live Video
              </span>
            </div>
          </button>
        </div>

        {/* Primary Navigation Links */}
        <nav className="flex-1 space-y-1.5">
          <button
            onClick={() => setCurrentTab('feed')}
            className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'feed' 
                ? 'bg-zinc-800/70 text-white font-semibold' 
                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <Home className={`w-6 h-6 ${currentTab === 'feed' ? 'stroke-[2.5px] text-pink-500' : ''}`} />
            <span>Página Inicial</span>
          </button>

          <button
            onClick={() => setCurrentTab('explore')}
            className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'explore' 
                ? 'bg-zinc-800/70 text-white font-semibold' 
                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <Compass className={`w-6 h-6 ${currentTab === 'explore' ? 'stroke-[2.5px] text-pink-500' : ''}`} />
            <span>Explorar</span>
          </button>

          <button
            onClick={() => setCurrentTab('reels')}
            className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'reels' 
                ? 'bg-zinc-800/70 text-white font-semibold' 
                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <Film className={`w-6 h-6 ${currentTab === 'reels' ? 'stroke-[2.5px] text-pink-500' : ''}`} />
            <span>Reels</span>
          </button>

          <button
            onClick={() => setCurrentTab('messages')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'messages' 
                ? 'bg-zinc-800/70 text-white font-semibold' 
                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <MessageCircle className={`w-6 h-6 ${currentTab === 'messages' ? 'stroke-[2.5px] text-pink-500' : ''}`} />
                {unreadMessagesCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-4 h-4 rounded-full bg-pink-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                    {unreadMessagesCount}
                  </span>
                )}
              </div>
              <span>Mensagens</span>
            </div>
          </button>

          <button
            onClick={() => setCurrentTab('notifications')}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'notifications' 
                ? 'bg-zinc-800/70 text-white font-semibold' 
                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <Heart className={`w-6 h-6 ${currentTab === 'notifications' ? 'stroke-[2.5px] text-pink-500' : ''}`} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-pink-500 ring-2 ring-black" />
                )}
              </div>
              <span>Notificações</span>
            </div>
          </button>

          {/* Create Post Studio Button */}
          <button
            onClick={onOpenCreateModal}
            className="w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white transition-all group"
          >
            <PlusSquare className="w-6 h-6 group-hover:scale-110 transition-transform text-pink-400" />
            <span className="font-semibold text-white">Criar Publicação</span>
          </button>

          {/* Quick Messages / Call Navigation */}
          <button
            onClick={() => setCurrentTab('messages')}
            className="w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 hover:border-pink-500/60 transition-all group shadow-sm"
          >
            <Video className="w-6 h-6 text-pink-400 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Conversas & Chamadas</span>
          </button>

          <button
            onClick={() => setCurrentTab('profile')}
            className={`w-full flex items-center gap-4 px-3.5 py-3 rounded-xl text-sm font-medium transition-all ${
              currentTab === 'profile' 
                ? 'bg-zinc-800/70 text-white font-semibold' 
                : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
            }`}
          >
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className={`w-7 h-7 rounded-full object-cover ring-2 ${currentTab === 'profile' ? 'ring-pink-500' : 'ring-transparent'}`} 
            />
            <span className="truncate">Perfil</span>
          </button>
        </nav>

        {/* Bottom Bar: Theme toggle and User mini card */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/60 rounded-xl border border-zinc-800">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">@{currentUser.username}</p>
                <p className="text-[11px] text-zinc-400 truncate">Ilimitado & Grátis</p>
              </div>
            </div>
            <button
              onClick={toggleDarkMode}
              title={isDarkMode ? "Modo Claro" : "Modo Escuro"}
              className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top App Bar (Header) */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 px-4 flex items-center justify-between z-40">
        <button 
          onClick={() => setCurrentTab('feed')}
          className="flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-lg auragram-gradient flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-xl font-black font-display tracking-tight text-white">
            Aura<span className="text-pink-500">Gram</span>
          </span>
        </button>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setCurrentTab('notifications')}
            aria-label="Notificações"
            className="p-2 text-zinc-300 hover:text-pink-500 relative transition-colors"
          >
            <Heart className="w-6 h-6" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-pink-500" />
            )}
          </button>

          <button 
            onClick={() => setCurrentTab('messages')}
            aria-label="Mensagens"
            className="p-2 text-zinc-300 hover:text-pink-500 relative transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
            {unreadMessagesCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-pink-500 text-[9px] font-bold text-white flex items-center justify-center">
                {unreadMessagesCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-black/95 backdrop-blur-lg border-t border-zinc-800/80 px-2 flex items-center justify-around z-40 pb-safe">
        <button
          onClick={() => setCurrentTab('feed')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
            currentTab === 'feed' ? 'text-pink-500' : 'text-zinc-400'
          }`}
        >
          <Home className="w-6 h-6" />
        </button>

        <button
          onClick={() => setCurrentTab('explore')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
            currentTab === 'explore' ? 'text-pink-500' : 'text-zinc-400'
          }`}
        >
          <Search className="w-6 h-6" />
        </button>

        <button
          onClick={onOpenCreateModal}
          className="flex items-center justify-center w-11 h-11 rounded-2xl auragram-gradient text-white shadow-lg shadow-pink-500/30 active:scale-95 transition-transform"
        >
          <PlusSquare className="w-6 h-6" />
        </button>

        <button
          onClick={() => setCurrentTab('reels')}
          className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors ${
            currentTab === 'reels' ? 'text-pink-500' : 'text-zinc-400'
          }`}
        >
          <Film className="w-6 h-6" />
        </button>

        <button
          onClick={() => setCurrentTab('profile')}
          className="flex items-center justify-center w-12 h-12 rounded-xl"
        >
          <img 
            src={currentUser.avatar} 
            alt={currentUser.name} 
            className={`w-7 h-7 rounded-full object-cover ring-2 ${
              currentTab === 'profile' ? 'ring-pink-500' : 'ring-transparent'
            }`} 
          />
        </button>
      </nav>
    </>
  );
};
