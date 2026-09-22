import React, { useState } from 'react';
import { Heart, MessageCircle, UserPlus, Check, Sparkles, X } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationsModalProps {
  notifications: NotificationItem[];
  onClose: () => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  notifications,
  onClose,
}) => {
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const toggleFollow = (userId: string) => {
    setFollowingMap((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
            <h3 className="text-sm font-bold text-white">Notificações</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 py-2 space-y-1">
          {notifications.map((n) => (
            <div key={n.id} className="py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={n.user.avatar}
                    alt={n.user.username}
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-zinc-800"
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-pink-500 text-white shadow-sm">
                    {n.type === 'like' && <Heart className="w-2.5 h-2.5 fill-white" />}
                    {n.type === 'comment' && <MessageCircle className="w-2.5 h-2.5 fill-white" />}
                    {n.type === 'follow' && <UserPlus className="w-2.5 h-2.5 fill-white" />}
                    {n.type === 'mention' && <Sparkles className="w-2.5 h-2.5 fill-white" />}
                  </div>
                </div>

                <div className="text-xs leading-snug">
                  <span className="font-bold text-white mr-1.5">{n.user.username}</span>
                  <span className="text-zinc-300">{n.content}</span>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{n.createdAt}</div>
                </div>
              </div>

              {n.type === 'follow' && (
                <button
                  onClick={() => toggleFollow(n.user.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-colors ${
                    followingMap[n.user.id]
                      ? 'bg-zinc-800 text-zinc-300'
                      : 'auragram-gradient text-white shadow-sm'
                  }`}
                >
                  {followingMap[n.user.id] ? 'Seguindo' : 'Seguir'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
