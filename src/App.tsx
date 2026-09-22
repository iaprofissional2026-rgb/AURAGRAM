/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut, 
  FirebaseUser,
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  arrayUnion, 
  arrayRemove, 
  serverTimestamp, 
  increment,
  addDoc
} from './firebase';
import { 
  CONTACTS, 
  INITIAL_POSTS, 
  INITIAL_STORIES, 
  INITIAL_REELS, 
  INITIAL_NOTIFICATIONS 
} from './initialData';
import { User, Post, Story, Reel, ChatMessage, NotificationItem, CallState } from './types';
import { AuthScreen } from './components/AuthScreen';
import { Navigation } from './components/Navigation';
import { Feed } from './components/Feed';
import { ReelsViewer } from './components/ReelsViewer';
import { DirectChat } from './components/DirectChat';
import { ExploreView } from './components/ExploreView';
import { ProfileView } from './components/ProfileView';
import { StoriesViewer } from './components/StoriesViewer';
import { StoryCreator } from './components/StoryCreator';
import { CreatePostModal } from './components/CreatePostModal';
import { CallingModal } from './components/CallingModal';
import { NotificationsModal } from './components/NotificationsModal';
import { PostDetailModal } from './components/PostDetailModal';
import { Sparkles, Loader2 } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function App() {
  // Real Firebase Auth & User State
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);

  // Real-time collections state
  const [registeredUsers, setRegisteredUsers] = useState<User[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<Story[]>(INITIAL_STORIES);
  const [reels, setReels] = useState<Reel[]>(INITIAL_REELS);
  const [messagesMap, setMessagesMap] = useState<Record<string, ChatMessage[]>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  // App UI State
  const [currentTab, setCurrentTab] = useState<string>('feed');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [isCreatingStory, setIsCreatingStory] = useState<boolean>(false);
  const [isCreatingPost, setIsCreatingPost] = useState<boolean>(false);
  const [selectedPostForDetail, setSelectedPostForDetail] = useState<Post | null>(null);
  const [selectedChatContact, setSelectedChatContact] = useState<User | null>(null);
  const [selectedViewedUser, setSelectedViewedUser] = useState<User | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState<boolean>(false);

  // Real-Time WebRTC Call State
  const [callState, setCallState] = useState<CallState>({
    active: false,
    type: 'video',
    contact: null,
    status: 'calling',
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    duration: 0,
  });

  // Dark mode class sync
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // 1. Firebase Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setIsAuthLoading(true);
      if (fbUser) {
        setAuthUser(fbUser);
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userDocRef);
          if (userSnap.exists()) {
            setCurrentUser(userSnap.data() as User);
          } else {
            // Profile document auto-creation
            const rawUsername = fbUser.email 
              ? fbUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_') 
              : `user_${fbUser.uid.slice(0, 5)}`;
            const newProfile: User = {
              id: fbUser.uid,
              username: rawUsername,
              name: fbUser.displayName || 'Novo Usuário',
              email: fbUser.email || '',
              avatar: fbUser.photoURL || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80`,
              bio: '✨ Conectado no AuraGram!',
              followersCount: 0,
              followingCount: 0,
              postsCount: 0,
              isVerified: false,
              isOnline: true,
              following: [],
              createdAt: new Date().toISOString(),
            };
            await setDoc(userDocRef, newProfile);
            setCurrentUser(newProfile);
          }
        } catch (err) {
          console.warn('Error fetching or initializing user document', err);
        }
      } else {
        setAuthUser(null);
        setCurrentUser(null);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Real-time listener for current user's profile document
  useEffect(() => {
    if (!authUser?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', authUser.uid), (snap) => {
      if (snap.exists()) {
        setCurrentUser(snap.data() as User);
      }
    });
    return () => unsub();
  }, [authUser?.uid]);

  // 3. Real-time listener for ALL registered users in Firestore
  useEffect(() => {
    if (!authUser) return;
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersList: User[] = [];
      snapshot.forEach((d) => {
        usersList.push(d.data() as User);
      });
      setRegisteredUsers(usersList);
    }, (err) => {
      console.warn('Error listening to users collection', err);
    });

    return () => unsub();
  }, [authUser]);

  // 4. Real-time listener for Posts from Firestore
  useEffect(() => {
    if (!authUser) return;
    const postsQuery = query(
      collection(db, 'posts'), 
      orderBy('createdAtTimestamp', 'desc'), 
      limit(50)
    );

    const unsub = onSnapshot(postsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const livePosts: Post[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          livePosts.push({
            id: d.id,
            author: data.author,
            mediaUrl: data.mediaUrl,
            mediaType: data.mediaType || 'image',
            caption: data.caption || '',
            location: data.location,
            musicTrack: data.musicTrack,
            filter: data.filter,
            likesCount: data.likesCount ?? (data.likes?.length || 0),
            isLiked: data.likes ? data.likes.includes(authUser.uid) : false,
            commentsCount: data.commentsCount ?? (data.comments?.length || 0),
            comments: data.comments || [],
            isSaved: data.savedBy ? data.savedBy.includes(authUser.uid) : false,
            createdAt: data.createdAt || 'recente',
            createdAtTimestamp: data.createdAtTimestamp,
            likes: data.likes || [],
          });
        });
        setPosts(livePosts);
      } else {
        // Fallback to initial creator showcase posts if DB has no posts yet
        setPosts(INITIAL_POSTS);
      }
    }, (err) => {
      console.warn('Error listening to posts collection', err);
      setPosts(INITIAL_POSTS);
    });

    return () => unsub();
  }, [authUser]);

  // 5. Real-time listener for Stories
  useEffect(() => {
    if (!authUser) return;
    const unsub = onSnapshot(collection(db, 'stories'), (snapshot) => {
      if (!snapshot.empty) {
        const liveStories: Story[] = [];
        snapshot.forEach((d) => {
          liveStories.push({ id: d.id, ...d.data() } as Story);
        });
        // Prepend live stories to initial showcase stories
        setStories([...liveStories, ...INITIAL_STORIES.filter(s => !liveStories.some(ls => ls.id === s.id))]);
      } else {
        setStories(INITIAL_STORIES);
      }
    }, (err) => {
      console.warn('Error listening to stories', err);
    });

    return () => unsub();
  }, [authUser]);

  // 6. Real-time listener for Direct Messages
  useEffect(() => {
    if (!authUser?.uid) return;

    const messagesQuery = query(
      collection(db, 'messages'),
      where('participants', 'array-contains', authUser.uid)
    );

    const unsub = onSnapshot(messagesQuery, (snapshot) => {
      const map: Record<string, ChatMessage[]> = {};
      snapshot.forEach((d) => {
        const data = d.data();
        const otherUserId = data.participants.find((id: string) => id !== authUser.uid);
        if (otherUserId) {
          if (!map[otherUserId]) map[otherUserId] = [];
          map[otherUserId].push({
            id: d.id,
            senderId: data.senderId,
            recipientId: data.recipientId,
            type: data.type || 'text',
            content: data.content,
            timestamp: data.timestamp || 'agora',
            read: data.read ?? true,
            audioDuration: data.audioDuration,
          });
        }
      });
      setMessagesMap(map);
    }, (err) => {
      console.warn('Error listening to messages', err);
    });

    return () => unsub();
  }, [authUser?.uid]);

  // Compute contacts: all other real registered users + mock seed contacts to explore
  const otherRegisteredUsers = registeredUsers.filter((u) => u.id !== currentUser?.id);
  const contacts = otherRegisteredUsers.length > 0 
    ? otherRegisteredUsers 
    : CONTACTS;

  // Toggle Like on Post (Firestore Sync)
  const handleLikePost = async (postId: string) => {
    if (!currentUser) return;
    const targetPost = posts.find((p) => p.id === postId);
    const isCurrentlyLiked = targetPost?.isLiked;

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            isLiked: !isCurrentlyLiked,
            likesCount: isCurrentlyLiked ? Math.max(0, post.likesCount - 1) : post.likesCount + 1,
          };
        }
        return post;
      })
    );

    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        await updateDoc(postRef, {
          likes: isCurrentlyLiked ? arrayRemove(currentUser.id) : arrayUnion(currentUser.id),
          likesCount: increment(isCurrentlyLiked ? -1 : 1),
        });
      }
    } catch (err) {
      console.warn('Error updating post like in Firestore', err);
    }
  };

  // Add Comment to Post (Firestore Sync)
  const handleCommentPost = async (postId: string, text: string) => {
    if (!currentUser || !text.trim()) return;

    const newComment = {
      id: `comment_${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      userAvatar: currentUser.avatar,
      text: text.trim(),
      createdAt: 'agora mesmo',
      likesCount: 0,
      isLiked: false,
    };

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            commentsCount: post.commentsCount + 1,
            comments: [newComment, ...post.comments],
          };
        }
        return post;
      })
    );

    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        await updateDoc(postRef, {
          comments: arrayUnion(newComment),
          commentsCount: increment(1),
        });
      }
    } catch (err) {
      console.warn('Error adding comment to Firestore', err);
    }
  };

  // Save / Bookmark Post
  const handleSavePost = async (postId: string) => {
    if (!currentUser) return;
    const targetPost = posts.find((p) => p.id === postId);
    const isSaved = !targetPost?.isSaved;

    setPosts((prev) =>
      prev.map((post) => {
        if (post.id === postId) {
          return { ...post, isSaved };
        }
        return post;
      })
    );

    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      if (postSnap.exists()) {
        await updateDoc(postRef, {
          savedBy: isSaved ? arrayUnion(currentUser.id) : arrayRemove(currentUser.id),
        });
      }
    } catch (err) {
      console.warn('Error updating saved post', err);
    }
  };

  // Toggle Like on Reel
  const handleLikeReel = (reelId: string) => {
    setReels((prev) =>
      prev.map((reel) => {
        if (reel.id === reelId) {
          const isLiked = !reel.isLiked;
          return {
            ...reel,
            isLiked,
            likesCount: isLiked ? reel.likesCount + 1 : reel.likesCount - 1,
          };
        }
        return reel;
      })
    );
  };

  // Save Reel
  const handleSaveReel = (reelId: string) => {
    setReels((prev) =>
      prev.map((reel) => {
        if (reel.id === reelId) {
          return { ...reel, isSaved: !reel.isSaved };
        }
        return reel;
      })
    );
  };

  // Comment on Reel
  const handleCommentReel = (reelId: string, text: string) => {
    if (!currentUser) return;
    const newComment = {
      id: `rc_${Date.now()}`,
      userId: currentUser.id,
      username: currentUser.username,
      userAvatar: currentUser.avatar,
      text,
      createdAt: 'agora',
      likesCount: 0,
      isLiked: false,
    };

    setReels((prev) =>
      prev.map((reel) => {
        if (reel.id === reelId) {
          return {
            ...reel,
            commentsCount: reel.commentsCount + 1,
            comments: [newComment, ...reel.comments],
          };
        }
        return reel;
      })
    );
  };

  // Follow / Unfollow User (Firestore Sync)
  const handleFollowUser = async (targetUserId: string) => {
    if (!currentUser) return;
    const isCurrentlyFollowing = currentUser.following?.includes(targetUserId) || false;

    // Optimistic UI update
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const nextFollowing = isCurrentlyFollowing
        ? (prev.following || []).filter((id) => id !== targetUserId)
        : [...(prev.following || []), targetUserId];
      return {
        ...prev,
        following: nextFollowing,
        followingCount: isCurrentlyFollowing ? Math.max(0, prev.followingCount - 1) : prev.followingCount + 1,
      };
    });

    if (!isCurrentlyFollowing) {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
      });
    }

    try {
      // Update current user doc
      await updateDoc(doc(db, 'users', currentUser.id), {
        following: isCurrentlyFollowing ? arrayRemove(targetUserId) : arrayUnion(targetUserId),
        followingCount: increment(isCurrentlyFollowing ? -1 : 1),
      });

      // Update target user doc if registered
      const targetDocRef = doc(db, 'users', targetUserId);
      const targetSnap = await getDoc(targetDocRef);
      if (targetSnap.exists()) {
        await updateDoc(targetDocRef, {
          followersCount: increment(isCurrentlyFollowing ? -1 : 1),
        });
      }
    } catch (err) {
      console.warn('Error syncing follow status to Firestore', err);
    }
  };

  // Publish New Post to Firestore
  const handlePublishPost = async (newPost: Post) => {
    if (!currentUser) return;

    // Optimistic UI update
    setPosts((prev) => [newPost, ...prev]);
    setCurrentUser((prev) => prev ? ({ ...prev, postsCount: prev.postsCount + 1 }) : prev);

    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
    });
    setCurrentTab('feed');

    try {
      await setDoc(doc(db, 'posts', newPost.id), {
        ...newPost,
        authorId: currentUser.id,
        createdAtTimestamp: serverTimestamp(),
        likes: [currentUser.id],
      });

      await updateDoc(doc(db, 'users', currentUser.id), {
        postsCount: increment(1),
      });
    } catch (err) {
      console.warn('Error saving post to Firestore', err);
    }
  };

  // Publish New Story to Firestore
  const handlePublishStory = async (newStory: Story) => {
    if (!currentUser) return;

    setStories((prev) => [newStory, ...prev]);
    confetti({
      particleCount: 50,
      spread: 50,
      origin: { y: 0.5 },
    });

    try {
      await setDoc(doc(db, 'stories', newStory.id), {
        ...newStory,
        authorId: currentUser.id,
        createdAtTimestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Error publishing story to Firestore', err);
    }
  };

  // Send Direct Message to Firestore
  const handleSendMessage = async (
    recipientId: string,
    messageData: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>
  ) => {
    if (!currentUser) return;

    const date = new Date();
    const timestamp = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    const localId = `msg_${Date.now()}`;

    const newMsg: ChatMessage = {
      id: localId,
      timestamp,
      read: true,
      ...messageData,
    };

    // Optimistic UI update
    setMessagesMap((prev) => ({
      ...prev,
      [recipientId]: [...(prev[recipientId] || []), newMsg],
    }));

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUser.id,
        recipientId,
        participants: [currentUser.id, recipientId],
        type: messageData.type,
        content: messageData.content,
        audioDuration: messageData.audioDuration || null,
        timestamp,
        createdAt: serverTimestamp(),
        read: false,
      });
    } catch (err) {
      console.warn('Error saving message to Firestore', err);
    }
  };

  // Update Profile in Firestore
  const handleUpdateProfile = async (updatedUser: User) => {
    setCurrentUser(updatedUser);
    try {
      await updateDoc(doc(db, 'users', updatedUser.id), {
        name: updatedUser.name,
        username: updatedUser.username,
        bio: updatedUser.bio,
        website: updatedUser.website || '',
        avatar: updatedUser.avatar,
      });
      confetti({ particleCount: 30, spread: 50 });
    } catch (err) {
      console.warn('Error updating profile in Firestore', err);
    }
  };

  // Real Logout from Firebase Auth
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAuthUser(null);
      setCurrentUser(null);
      setCurrentTab('feed');
      setSelectedViewedUser(null);
    } catch (err) {
      console.warn('Error during signOut', err);
    }
  };

  // Start Real Video or Voice Call
  const handleStartCall = (contact: User, type: 'voice' | 'video') => {
    setCallState({
      active: true,
      type,
      contact,
      status: 'calling',
      isMuted: false,
      isCameraOff: false,
      isScreenSharing: false,
      duration: 0,
    });
  };

  const handleOpenQuickCall = () => {
    const defaultContact = contacts[0] || CONTACTS[0];
    handleStartCall(defaultContact, 'video');
  };

  const handleEndCall = () => {
    setCallState((prev) => ({
      ...prev,
      active: false,
      status: 'ended',
    }));
  };

  const handleReplyStory = (authorId: string, text: string) => {
    if (!currentUser) return;
    handleSendMessage(authorId, {
      senderId: currentUser.id,
      recipientId: authorId,
      type: 'text',
      content: text,
    });
  };

  // Following map helper
  const followingMap = (currentUser?.following || []).reduce<Record<string, boolean>>(
    (acc, id) => {
      acc[id] = true;
      return acc;
    },
    {}
  );

  // Filter saved and user posts
  const savedPosts = posts.filter((p) => p.isSaved);
  const userPosts = currentUser ? posts.filter((p) => p.author.id === currentUser.id) : [];

  // Unread badge count
  const unreadMessagesCount = Object.values(messagesMap).reduce((acc, msgs) => {
    return acc + msgs.filter((m) => !m.read && m.senderId !== currentUser?.id).length;
  }, 0);

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  // 1. Loading Screen while Firebase Auth initializes
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl auragram-gradient flex items-center justify-center shadow-2xl shadow-pink-500/30 animate-pulse mb-6">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-black font-display text-white tracking-tight">
          Aura<span className="text-pink-500">Gram</span>
        </h1>
        <p className="text-xs text-zinc-500 mt-2 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
          Conectando ao Firebase...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated Screen: Instagram-style Login, Register, Recovery
  if (!authUser || !currentUser) {
    return (
      <AuthScreen 
        onAuthSuccess={(user) => {
          setCurrentUser(user);
        }} 
      />
    );
  }

  // 3. Authenticated Application
  return (
    <div className="min-h-screen bg-black text-white selection:bg-pink-500 selection:text-white flex flex-col md:flex-row">
      {/* Navigation (Sidebar Desktop & Top/Bottom Bar Mobile) */}
      <Navigation
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          if (tab === 'notifications') {
            setShowNotificationsModal(true);
          } else {
            if (tab === 'profile') {
              setSelectedViewedUser(null);
            }
            setCurrentTab(tab);
          }
        }}
        currentUser={currentUser}
        unreadMessagesCount={unreadMessagesCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenCreateModal={() => setIsCreatingPost(true)}
        onOpenQuickCall={handleOpenQuickCall}
        isDarkMode={isDarkMode}
        toggleDarkMode={() => setIsDarkMode(!isDarkMode)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:ml-64 lg:ml-72 min-h-screen pt-14 md:pt-4 pb-20 md:pb-8">
        {currentTab === 'feed' && (
          <Feed
            currentUser={currentUser}
            stories={stories}
            posts={posts}
            suggestedUsers={contacts}
            onOpenStoryCreator={() => setIsCreatingStory(true)}
            onOpenStoriesViewer={(idx) => setActiveStoryIndex(idx)}
            onLikePost={handleLikePost}
            onCommentPost={handleCommentPost}
            onSavePost={handleSavePost}
            onFollowUser={handleFollowUser}
            followingMap={followingMap}
          />
        )}

        {currentTab === 'reels' && (
          <ReelsViewer
            reels={reels}
            currentUser={currentUser}
            onLikeReel={handleLikeReel}
            onSaveReel={handleSaveReel}
            onCommentReel={handleCommentReel}
          />
        )}

        {currentTab === 'messages' && (
          <div className="px-2 md:px-6">
            <DirectChat
              currentUser={currentUser}
              contacts={contacts}
              messagesMap={messagesMap}
              onSendMessage={handleSendMessage}
              onStartCall={handleStartCall}
              initialSelectedUser={selectedChatContact}
            />
          </div>
        )}

        {currentTab === 'explore' && (
          <ExploreView
            posts={posts}
            reels={reels}
            users={registeredUsers}
            onSelectPost={(post) => setSelectedPostForDetail(post)}
            onSelectUser={(user) => {
              setSelectedViewedUser(user);
              setCurrentTab('profile');
            }}
            onStartChat={(user) => {
              setSelectedChatContact(user);
              setCurrentTab('messages');
            }}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            viewedUser={selectedViewedUser}
            onBackToMyProfile={() => setSelectedViewedUser(null)}
            onUpdateProfile={handleUpdateProfile}
            userPosts={userPosts}
            savedPosts={savedPosts}
            userReels={reels}
            onSelectPost={(post) => setSelectedPostForDetail(post)}
            onLogout={handleLogout}
            onFollowUser={handleFollowUser}
            isFollowing={selectedViewedUser ? (currentUser.following || []).includes(selectedViewedUser.id) : false}
            onStartChat={(user) => {
              setSelectedChatContact(user);
              setCurrentTab('messages');
            }}
          />
        )}
      </div>

      {/* Stories Viewer Full Screen Overlay */}
      {activeStoryIndex !== null && (
        <StoriesViewer
          stories={stories}
          initialIndex={activeStoryIndex}
          onClose={() => setActiveStoryIndex(null)}
          onReply={handleReplyStory}
          currentUser={currentUser}
        />
      )}

      {/* Story Creator Modal (Camera / Upload) */}
      {isCreatingStory && (
        <StoryCreator
          currentUser={currentUser}
          onPublishStory={handlePublishStory}
          onClose={() => setIsCreatingStory(false)}
        />
      )}

      {/* Create Post Studio Modal */}
      {isCreatingPost && (
        <CreatePostModal
          currentUser={currentUser}
          onClose={() => setIsCreatingPost(false)}
          onPublishPost={handlePublishPost}
        />
      )}

      {/* Post Detail Modal (when clicked in explore or profile) */}
      {selectedPostForDetail && (
        <PostDetailModal
          post={selectedPostForDetail}
          currentUser={currentUser}
          onClose={() => setSelectedPostForDetail(null)}
          onLike={handleLikePost}
          onComment={handleCommentPost}
          onSave={handleSavePost}
        />
      )}

      {/* Notifications Drawer */}
      {showNotificationsModal && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setShowNotificationsModal(false)}
        />
      )}

      {/* REAL Live WebRTC Video / Voice Call Modal */}
      {callState.active && (
        <CallingModal
          callState={callState}
          onEndCall={handleEndCall}
          onToggleMute={() => setCallState((prev) => ({ ...prev, isMuted: !prev.isMuted }))}
          onToggleCamera={() => setCallState((prev) => ({ ...prev, isCameraOff: !prev.isCameraOff }))}
        />
      )}
    </div>
  );
}
