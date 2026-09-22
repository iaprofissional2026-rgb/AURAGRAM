export interface User {
  id: string;
  email?: string;
  username: string;
  name: string;
  avatar: string;
  bio: string;
  website?: string;
  followersCount: number;
  followingCount: number;
  postsCount: number;
  isVerified?: boolean;
  isFollowing?: boolean;
  isOnline?: boolean;
  following?: string[];
  createdAt?: string;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userAvatar: string;
  text: string;
  createdAt: string;
  likesCount?: number;
  isLiked?: boolean;
}

export interface Post {
  id: string;
  author: User;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  filter?: string;
  caption: string;
  location?: string;
  musicTrack?: string;
  likesCount: number;
  isLiked: boolean;
  likes?: string[]; // Array of user IDs who liked
  commentsCount: number;
  comments: Comment[];
  isSaved?: boolean;
  createdAt: string;
  createdAtTimestamp?: any;
  tags?: string[];
}

export interface Story {
  id: string;
  author: User;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  textSticker?: string;
  filter?: string;
  caption?: string;
  createdAt: string;
  createdAtTimestamp?: any;
  expiresAt?: number;
  isSeen?: boolean;
}

export interface Reel {
  id: string;
  author: User;
  videoUrl: string;
  thumbnail?: string;
  caption: string;
  musicTrack: string;
  likesCount: number;
  isLiked: boolean;
  likes?: string[];
  commentsCount: number;
  comments: Comment[];
  isSaved?: boolean;
  sharesCount: number;
  tags?: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  participants?: string[];
  type: 'text' | 'image' | 'voice' | 'video' | 'file';
  content: string; // text or media dataUrl
  mediaName?: string;
  mediaSize?: string;
  audioDuration?: number;
  timestamp: string;
  read: boolean;
  createdAtMillis?: number;
  createdAt?: any;
  reaction?: string;
  reactions?: Record<string, string>; // userId -> emoji
}

export interface CallState {
  active: boolean;
  callId?: string;
  isCaller?: boolean;
  type: 'voice' | 'video';
  contact: User | null;
  status: 'calling' | 'ringing' | 'connected' | 'ended';
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  duration: number;
}

export interface IncomingCallNotification {
  callId: string;
  caller: User;
  type: 'voice' | 'video';
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  user: User;
  type: 'like' | 'comment' | 'follow' | 'mention';
  postThumbnail?: string;
  content: string;
  createdAt: string;
  read: boolean;
}
