import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Phone, 
  Video, 
  Send, 
  Image as ImageIcon, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Smile, 
  Info, 
  CheckCheck,
  Sparkles,
  ArrowLeft,
  Heart,
  Flame,
  Laugh,
  X,
  Plus,
  UserPlus,
  Lock,
  Trash2,
  Radio,
  RotateCcw,
  Volume2,
  Film,
  ExternalLink,
  FileText
} from 'lucide-react';
import { User, ChatMessage } from '../types';
import { sounds } from '../utils/audioSynth';
import { compressImage } from '../utils/imageCompress';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderMessageContentWithLinks(text: string, isMe: boolean) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 font-semibold underline underline-offset-2 break-all ${
            isMe ? 'text-pink-100 hover:text-white' : 'text-pink-400 hover:text-pink-300'
          }`}
        >
          <span>{part}</span>
          <ExternalLink className="w-3.5 h-3.5 inline-block shrink-0" />
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

interface DirectChatProps {
  currentUser: User;
  contacts: User[];
  messagesMap: Record<string, ChatMessage[]>;
  onSendMessage: (recipientId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>) => void;
  onStartCall: (contact: User, type: 'voice' | 'video') => void;
  initialSelectedUser?: User | null;
  onReactMessage?: (messageId: string, emoji: string) => void;
  followingMap?: Record<string, boolean>;
  onFollowUser?: (userId: string) => void;
}

const QUICK_EMOJIS = ['❤️', '🔥', '😂', '😍', '👏', '😮', '😢', '🙌'];

export const DirectChat: React.FC<DirectChatProps> = ({
  currentUser,
  contacts,
  messagesMap,
  onSendMessage,
  onStartCall,
  initialSelectedUser,
  onReactMessage,
  followingMap = {},
  onFollowUser,
}) => {
  const [selectedContact, setSelectedContact] = useState<User | null>(initialSelectedUser || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  
  // High-Definition Voice Note Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordedAudioPreview, setRecordedAudioPreview] = useState<{ url: string; blob: Blob; duration: number } | null>(null);
  const [visualizerBars, setVisualizerBars] = useState<number[]>([15, 25, 40, 20, 50, 30, 60, 45, 35, 55, 20, 35]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);

  const currentMessages = selectedContact ? (messagesMap[selectedContact.id] || []) : [];

  // Check if currentUser is following selectedContact in the app
  const isFollowing = Boolean(
    selectedContact && (
      followingMap[selectedContact.id] || 
      (currentUser.following || []).includes(selectedContact.id)
    )
  );

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length, selectedContact?.id]);

  // Update selected contact if prop changes
  useEffect(() => {
    if (initialSelectedUser) {
      setSelectedContact(initialSelectedUser);
    }
  }, [initialSelectedUser]);

  // Filter contacts by search
  const filteredContacts = contacts.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Send Text Message
  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedContact || !inputText.trim()) return;

    // Auto follow if not already following so user profile and contacts remain linked
    if (!isFollowing && onFollowUser) {
      onFollowUser(selectedContact.id);
    }

    onSendMessage(selectedContact.id, {
      senderId: currentUser.id,
      recipientId: selectedContact.id,
      type: 'text',
      content: inputText.trim(),
    });

    sounds.playLikePop();
    setInputText('');
    setShowEmojiPicker(false);
  };

  // Send Quick Heart Like (Instagram feature when input is empty)
  const handleSendHeart = () => {
    if (!selectedContact) return;
    if (!isFollowing && onFollowUser) {
      onFollowUser(selectedContact.id);
    }
    onSendMessage(selectedContact.id, {
      senderId: currentUser.id,
      recipientId: selectedContact.id,
      type: 'text',
      content: '❤️',
    });
    sounds.playLikePop();
  };

  // Double tap to like message
  const handleDoubleTapMessage = (msg: ChatMessage) => {
    sounds.playLikePop();
    if (onReactMessage) {
      onReactMessage(msg.id, '❤️');
    }
  };

  // React with specific emoji
  const handleSelectReaction = (msgId: string, emoji: string) => {
    sounds.playLikePop();
    if (onReactMessage) {
      onReactMessage(msgId, emoji);
    }
    setHoveredMessageId(null);
  };

  // Send Image, Video, or Audio Attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;

    if (!isFollowing && onFollowUser) {
      onFollowUser(selectedContact.id);
    }

    try {
      if (file.type.startsWith('image/')) {
        // Compress image for high quality and fast delivery
        const compressed = await compressImage(file, 1280, 0.85);
        onSendMessage(selectedContact.id, {
          senderId: currentUser.id,
          recipientId: selectedContact.id,
          type: 'image',
          content: compressed,
          mediaName: file.name,
          mediaSize: formatFileSize(file.size),
        });
        sounds.playLikePop();
      } else if (file.type.startsWith('video/')) {
        // High-definition video message
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result && typeof reader.result === 'string') {
            onSendMessage(selectedContact.id, {
              senderId: currentUser.id,
              recipientId: selectedContact.id,
              type: 'video',
              content: reader.result,
              mediaName: file.name,
              mediaSize: formatFileSize(file.size),
            });
            sounds.playLikePop();
          }
        };
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('audio/')) {
        // Audio file message
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result && typeof reader.result === 'string') {
            onSendMessage(selectedContact.id, {
              senderId: currentUser.id,
              recipientId: selectedContact.id,
              type: 'voice',
              content: reader.result,
              mediaName: file.name,
              mediaSize: formatFileSize(file.size),
            });
            sounds.playLikePop();
          }
        };
        reader.readAsDataURL(file);
      } else {
        // Generic document / file
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result && typeof reader.result === 'string') {
            onSendMessage(selectedContact.id, {
              senderId: currentUser.id,
              recipientId: selectedContact.id,
              type: 'file',
              content: reader.result,
              mediaName: file.name,
              mediaSize: formatFileSize(file.size),
            });
            sounds.playLikePop();
          }
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.warn('Error handling uploaded chat file', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Cleanup audio tracks and visualizer loop
  const cleanupRecordingHardware = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
  };

  // High-Definition Studio Audio Recording
  const startRecording = async () => {
    try {
      if (!isFollowing && onFollowUser && selectedContact) {
        onFollowUser(selectedContact.id);
      }
      // Clear previous preview if any
      setRecordedAudioPreview(null);

      // Studio quality constraints: 48kHz, stereo, echo cancellation & noise suppression
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
          channelCount: 2,
        },
      });
      audioStreamRef.current = stream;

      // Real-time Web Audio Analyser for reactive voice frequency bars
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVisualizer = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          const bars: number[] = [];
          for (let i = 0; i < 12; i++) {
            const val = dataArray[i * 2] || 0;
            bars.push(Math.max(15, Math.min(95, Math.round((val / 255) * 100))));
          }
          setVisualizerBars(bars);
          animFrameRef.current = requestAnimationFrame(updateVisualizer);
        };
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
      } catch (e) {
        console.warn('AudioContext visualizer setup failed', e);
      }

      // Detect optimal Opus audio mimeType
      const mimeType = [
        'audio/webm;codecs=opus',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        'audio/webm',
      ].find((type) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) || '';

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64000, // Studio speech clarity Opus
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = window.setInterval(() => {
        setRecordDuration((prev) => {
          if (prev >= 60) {
            // Auto-stop at 60 seconds (1 minute max safeguard)
            stopAndPrepareAudio();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('Microphone recording error', err);
      sounds.playHangupTone();
    }
  };

  // Stop recording and create audio preview for review
  const stopAndPrepareAudio = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    const dur = recordDuration;
    mediaRecorderRef.current.onstop = () => {
      const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mime });
      const previewUrl = URL.createObjectURL(audioBlob);
      setRecordedAudioPreview({
        url: previewUrl,
        blob: audioBlob,
        duration: Math.max(1, dur),
      });
      cleanupRecordingHardware();
    };
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Direct send while recording
  const sendRecordingImmediately = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    const dur = recordDuration;
    mediaRecorderRef.current.onstop = () => {
      const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mime });
      dispatchAudioBlob(audioBlob, dur);
      cleanupRecordingHardware();
    };
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // Send from preview
  const sendRecordedPreview = () => {
    if (!recordedAudioPreview) return;
    dispatchAudioBlob(recordedAudioPreview.blob, recordedAudioPreview.duration);
    setRecordedAudioPreview(null);
  };

  // Discard and cancel recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordedAudioPreview(null);
    cleanupRecordingHardware();
  };

  // Dispatch audio blob as message to Firestore
  const dispatchAudioBlob = (audioBlob: Blob, duration: number) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (selectedContact) {
        onSendMessage(selectedContact.id, {
          senderId: currentUser.id,
          recipientId: selectedContact.id,
          type: 'voice',
          content: reader.result as string,
          audioDuration: Math.max(1, duration),
        });
        sounds.playLikePop();
      }
    };
    reader.readAsDataURL(audioBlob);
  };

  return (
    <div className="w-full h-[calc(100dvh-7.5rem)] md:h-[calc(100dvh-2.5rem)] max-w-6xl mx-auto flex rounded-2xl md:rounded-3xl border border-zinc-800/80 bg-zinc-950 overflow-hidden shadow-2xl relative">
      {/* Hidden File Picker: supports images, videos, audio notes and files */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Image Lightbox Preview Modal */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={previewImage} 
            alt="Expanded view" 
            className="max-w-full max-h-[88vh] rounded-2xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Left Contacts Sidebar (Instagram Direct style) */}
      <aside className={`w-full md:w-80 lg:w-96 border-r border-zinc-800/80 flex flex-col bg-zinc-950/80 backdrop-blur-xl ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        {/* User DM Header */}
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white tracking-tight">
              {currentUser.username}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
            Mensagens
          </span>
        </div>

        {/* Instagram Notes / Quick Stories Bubble Row */}
        <div className="px-4 py-3 border-b border-zinc-800/60 overflow-x-auto flex items-center gap-4 no-scrollbar">
          {/* Current User Note */}
          <div className="flex flex-col items-center flex-shrink-0 cursor-pointer group">
            <div className="relative">
              <img 
                src={currentUser.avatar} 
                alt="Você" 
                className="w-14 h-14 rounded-full object-cover ring-2 ring-zinc-800"
              />
              <div className="absolute -top-1.5 -right-1 bg-zinc-800 text-[10px] text-zinc-300 px-1.5 py-0.5 rounded-full border border-zinc-700 shadow flex items-center gap-0.5">
                <Plus className="w-2.5 h-2.5" />
                <span>Nota</span>
              </div>
            </div>
            <span className="text-[11px] text-zinc-400 mt-1.5 truncate max-w-[60px]">Sua nota</span>
          </div>

          {/* Other Users Notes / Active Heads */}
          {contacts.slice(0, 6).map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedContact(c)}
              className="flex flex-col items-center flex-shrink-0 cursor-pointer group"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full auragram-gradient p-0.5 group-hover:scale-105 transition-transform">
                  <img
                    src={c.avatar}
                    alt={c.name}
                    className="w-full h-full rounded-full object-cover ring-2 ring-black"
                  />
                </div>
                {c.isOnline && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-black" />
                )}
              </div>
              <span className="text-[11px] text-zinc-300 mt-1.5 truncate max-w-[60px]">
                {c.username}
              </span>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800/80">
            <Search className="w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Pesquisar contatos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/50">
          {filteredContacts.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">
              Nenhum contato encontrado
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const msgs = messagesMap[contact.id] || [];
              const lastMsg = msgs[msgs.length - 1];
              const isSelected = selectedContact?.id === contact.id;

              return (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact)}
                  className={`w-full p-3.5 flex items-center gap-3.5 transition-all text-left ${
                    isSelected ? 'bg-zinc-900/90 border-l-4 border-pink-500' : 'hover:bg-zinc-900/40'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-13 h-13 rounded-full object-cover ring-1 ring-zinc-800"
                    />
                    {contact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-950" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-white truncate">
                        {contact.name}
                      </span>
                      {lastMsg && (
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {lastMsg.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate">
                      {lastMsg ? (
                        lastMsg.type === 'image' ? (
                          '📷 Foto enviada'
                        ) : lastMsg.type === 'voice' ? (
                          '🎙️ Mensagem de voz'
                        ) : (
                          lastMsg.content
                        )
                      ) : (
                        `@${contact.username} • Diga olá!`
                      )}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right Messages View (Instagram Direct Canvas) */}
      {selectedContact ? (
        <main className="flex-1 flex flex-col bg-zinc-950 relative overflow-hidden">
          
          {/* Direct Header */}
          <header className="h-16 border-b border-zinc-800/80 px-4 flex items-center justify-between bg-zinc-950/80 backdrop-blur-xl z-20">
            <div className="flex items-center gap-3">
              {/* Mobile Back Button */}
              <button
                onClick={() => setSelectedContact(null)}
                className="md:hidden p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="relative">
                <img
                  src={selectedContact.avatar}
                  alt={selectedContact.name}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-pink-500/40"
                />
                {selectedContact.isOnline && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-black" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">
                    {selectedContact.name}
                  </span>
                  <span className="text-xs text-zinc-400">@{selectedContact.username}</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium block">
                  {selectedContact.isOnline ? 'Online agora' : 'Ativo recentemente'}
                </span>
              </div>
            </div>

            {/* Calling Action Buttons (Phone & Video) */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Voice Call */}
              <button
                onClick={() => {
                  if (!isFollowing) {
                    alert(`Você só pode ligar para quem estiver seguindo no AuraGram! Siga @${selectedContact.username} para ligar.`);
                    return;
                  }
                  onStartCall(selectedContact, 'voice');
                }}
                className={`p-2.5 rounded-full transition-all relative ${
                  isFollowing
                    ? 'text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95'
                    : 'text-zinc-500 hover:text-zinc-400 hover:bg-zinc-900/60'
                }`}
                title={isFollowing ? "Iniciar Ligação de Voz" : "Siga para ligar"}
              >
                <Phone className={`w-5 h-5 ${isFollowing ? 'text-emerald-400' : 'text-zinc-500'}`} />
                {!isFollowing && (
                  <span className="absolute -top-1 -right-1 p-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>

              {/* Video Call */}
              <button
                onClick={() => {
                  if (!isFollowing) {
                    alert(`Você só pode ligar para quem estiver seguindo no AuraGram! Siga @${selectedContact.username} para ligar.`);
                    return;
                  }
                  onStartCall(selectedContact, 'video');
                }}
                className={`p-2.5 rounded-full transition-all relative ${
                  isFollowing
                    ? 'text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95'
                    : 'text-zinc-500 hover:text-zinc-400 hover:bg-zinc-900/60'
                }`}
                title={isFollowing ? "Iniciar Chamada de Vídeo" : "Siga para ligar"}
              >
                <Video className={`w-5 h-5 ${isFollowing ? 'text-pink-400' : 'text-zinc-500'}`} />
                {!isFollowing && (
                  <span className="absolute -top-1 -right-1 p-0.5 rounded-full bg-zinc-800 text-zinc-400">
                    <Lock className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>

              {/* Contact Info */}
              <button
                className="p-2.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                title="Informações da conversa"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* Messages Flow */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Conversation Starter Banner */}
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full auragram-gradient p-1 mb-3 shadow-xl">
                <img
                  src={selectedContact.avatar}
                  alt={selectedContact.name}
                  className="w-full h-full rounded-full object-cover ring-2 ring-black"
                />
              </div>
              <h3 className="text-base font-bold text-white">{selectedContact.name}</h3>
              <p className="text-xs text-zinc-400 mb-1">@{selectedContact.username} • AuraGram</p>
              <p className="text-xs text-zinc-500 max-w-xs">{selectedContact.bio || 'Conectado no AuraGram'}</p>
            </div>

            {/* Messages List */}
            {currentMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              const isHovered = hoveredMessageId === msg.id;

              return (
                <div
                  key={msg.id}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                  className={`flex flex-col group relative ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex items-end gap-2 max-w-[82%] sm:max-w-[70%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* Other User Avatar */}
                    {!isMe && (
                      <img
                        src={selectedContact.avatar}
                        alt={selectedContact.name}
                        className="w-7 h-7 rounded-full object-cover mb-1 ring-1 ring-zinc-800 flex-shrink-0"
                      />
                    )}

                    {/* Message Bubble */}
                    <div
                      onDoubleClick={() => handleDoubleTapMessage(msg)}
                      className={`relative px-4 py-2.5 rounded-3xl transition-all shadow-sm ${
                        isMe
                          ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-rose-600 text-white rounded-br-sm'
                          : 'bg-zinc-800/90 text-zinc-100 rounded-bl-sm border border-zinc-700/40'
                      }`}
                    >
                      {/* Image Message */}
                      {msg.type === 'image' && (
                        <div className="rounded-2xl overflow-hidden cursor-pointer my-1">
                          <img
                            src={msg.content}
                            alt="Attachment"
                            onClick={() => setPreviewImage(msg.content)}
                            className="max-h-72 w-full object-cover rounded-2xl hover:opacity-95 transition-opacity"
                          />
                          {msg.mediaName && (
                            <p className="text-[11px] opacity-80 mt-1 truncate">{msg.mediaName} {msg.mediaSize && `(${msg.mediaSize})`}</p>
                          )}
                        </div>
                      )}

                      {/* Video Message */}
                      {msg.type === 'video' && (
                        <div className="rounded-2xl overflow-hidden my-1 max-w-full">
                          <video
                            src={msg.content}
                            controls
                            playsInline
                            className="max-h-72 w-full rounded-2xl bg-black object-contain"
                          />
                          {msg.mediaName && (
                            <p className="text-[11px] opacity-80 mt-1 truncate">{msg.mediaName} {msg.mediaSize && `(${msg.mediaSize})`}</p>
                          )}
                        </div>
                      )}

                      {/* Generic File Attachment */}
                      {msg.type === 'file' && (
                        <a
                          href={msg.content}
                          download={msg.mediaName || 'arquivo'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2.5 p-2.5 rounded-2xl my-1 transition-colors ${
                            isMe ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-zinc-700/60 hover:bg-zinc-700 text-zinc-100'
                          }`}
                        >
                          <div className="p-2 rounded-xl bg-pink-500/20 text-pink-300">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold truncate">{msg.mediaName || 'Arquivo Anexo'}</p>
                            <p className="text-[10px] opacity-70">{msg.mediaSize || 'Baixar arquivo'}</p>
                          </div>
                        </a>
                      )}

                      {/* High-Definition Voice Note Audio Player */}
                      {msg.type === 'voice' && (
                        <VoiceMessagePlayer
                          audioUrl={msg.content}
                          duration={msg.audioDuration}
                          isMe={isMe}
                        />
                      )}

                      {/* Text Message Content with Clickable Links */}
                      {msg.type === 'text' && (
                        <p className="text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap">
                          {renderMessageContentWithLinks(msg.content, isMe)}
                        </p>
                      )}

                      {/* Reaction Badge (Instagram floating heart/emoji badge) */}
                      {(msg.reaction || (msg.reactions && Object.values(msg.reactions).length > 0)) && (
                        <div className={`absolute -bottom-2 ${isMe ? 'left-2' : 'right-2'} bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 rounded-full text-xs shadow-md flex items-center gap-0.5 animate-bounce-subtle`}>
                          <span>{msg.reaction || Object.values(msg.reactions || {})[0]}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Reaction Popup (Instagram style on hover) */}
                    {isHovered && (
                      <div className={`hidden sm:flex items-center gap-1 bg-zinc-900 border border-zinc-700/80 px-2 py-1 rounded-full shadow-xl z-10 ${isMe ? 'mr-1' : 'ml-1'}`}>
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => handleSelectReaction(msg.id, emoji)}
                            className="hover:scale-125 transition-transform text-sm p-0.5"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Timestamp & Status */}
                  <span className={`text-[10px] text-zinc-500 mt-1 px-1 flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span>{msg.timestamp}</span>
                    {isMe && <CheckCheck className="w-3 h-3 text-pink-400" />}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Interactive Instagram Input Bar */}
          <footer className="p-3 sm:p-4 border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-xl relative">
            
            {/* Quick Emoji Picker Popover */}
            {showEmojiPicker && (
              <div className="absolute bottom-20 left-4 bg-zinc-900 border border-zinc-700/90 rounded-2xl p-3 shadow-2xl z-30 flex flex-wrap gap-2 max-w-xs animate-fade-in">
                {['❤️', '🔥', '😂', '😍', '👏', '😮', '😢', '🙌', '✨', '💯', '🚀', '🎉', '💃', '🕶️'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setInputText((prev) => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="text-xl p-1.5 hover:bg-zinc-800 rounded-xl transition-all"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar or Follow Restriction */}
            {!isFollowing ? (
              <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-900/90 border border-pink-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-white">Siga @{selectedContact.username} para conversar</p>
                    <p className="text-xs text-zinc-400">Só é possível enviar mensagens e fazer chamadas para quem você segue no app.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onFollowUser?.(selectedContact.id)}
                  className="px-5 py-2.5 rounded-xl auragram-gradient text-white text-xs font-bold shadow-lg shadow-pink-500/25 hover:scale-105 active:scale-95 transition-all shrink-0 w-full sm:w-auto"
                >
                  Seguir @{selectedContact.username}
                </button>
              </div>
            ) : recordedAudioPreview ? (
              /* Recorded Voice Note Preview before Sending */
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-zinc-900/95 rounded-full border border-pink-500/40 shadow-xl backdrop-blur-md animate-fade-in">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="p-2 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors shrink-0"
                  title="Descartar áudio"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                <div className="flex-1 px-2 overflow-hidden">
                  <VoiceMessagePlayer
                    audioUrl={recordedAudioPreview.url}
                    duration={recordedAudioPreview.duration}
                    isMe={false}
                  />
                </div>

                <button
                  type="button"
                  onClick={sendRecordedPreview}
                  className="p-2.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-95 text-white shadow-lg transition-transform active:scale-95 shrink-0"
                  title="Enviar áudio gravado"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : isRecording ? (
              /* Studio Voice Recording Bar with Live Frequency Visualizer */
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-zinc-900 rounded-full border border-rose-500/50 shadow-2xl animate-fade-in">
                {/* Recording indicator & timer */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                  </span>
                  <div className="flex flex-col">
                    <span className="text-xs font-mono font-bold text-white">
                      {Math.floor(recordDuration / 60)}:{(recordDuration % 60).toString().padStart(2, '0')}
                    </span>
                    <span className="text-[9px] text-rose-400 font-semibold uppercase tracking-wider">
                      Áudio HD
                    </span>
                  </div>
                </div>

                {/* Live frequency visualizer bars */}
                <div className="flex-1 flex items-center justify-center gap-1 h-7 px-2 overflow-hidden">
                  {visualizerBars.map((height, i) => (
                    <div
                      key={i}
                      className="w-1 bg-gradient-to-t from-pink-500 to-rose-400 rounded-full transition-all duration-75"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>

                {/* Actions: Discard, Preview/Review, Direct Send */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={cancelRecording}
                    className="p-2 rounded-full text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                    title="Cancelar gravação"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={stopAndPrepareAudio}
                    className="px-2.5 py-1 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 transition-colors"
                    title="Ouvir antes de enviar"
                  >
                    Prévia
                  </button>

                  <button
                    type="button"
                    onClick={sendRecordingImmediately}
                    className="p-2 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 hover:opacity-90 text-white shadow-lg transition-transform active:scale-95"
                    title="Enviar agora"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Input Bar */
              <form
                onSubmit={handleSendText}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900/90 rounded-full border border-zinc-800 focus-within:border-zinc-700 transition-all"
              >
                {/* Photo / Gallery upload */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
                  title="Enviar foto da galeria"
                >
                  <ImageIcon className="w-5 h-5 text-pink-400" />
                </button>

                {/* Microphone / Audio message button */}
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
                  title="Gravar mensagem de voz"
                >
                  <Mic className="w-5 h-5" />
                </button>

                {/* Text input */}
                <input
                  type="text"
                  placeholder="Mensagem..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none px-2"
                />

                {/* Emoji toggle */}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex-shrink-0"
                  title="Inserir figurinha ou emoji"
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* Heart Button if empty, Send Button if typed (Exact Instagram pattern!) */}
                {inputText.trim().length > 0 ? (
                  <button
                    type="submit"
                    className="p-2 px-3 rounded-full bg-pink-600 hover:bg-pink-500 text-white font-semibold text-xs flex items-center gap-1 shadow-md transition-transform active:scale-95 flex-shrink-0"
                  >
                    <span>Enviar</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendHeart}
                    className="p-2 rounded-full text-rose-500 hover:text-rose-400 hover:scale-110 active:scale-95 transition-all flex-shrink-0"
                    title="Enviar curtida com coração"
                  >
                    <Heart className="w-5 h-5 fill-current" />
                  </button>
                )}
              </form>
            )}
          </footer>
        </main>
      ) : (
        /* Empty State */
        <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 text-center bg-zinc-950">
          <div className="w-24 h-24 rounded-full bg-zinc-900/80 border border-zinc-800 flex items-center justify-center mb-4 text-pink-500">
            <Send className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Suas mensagens</h2>
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            Envie fotos, mensagens privadas e faça chamadas de áudio e vídeo com pessoas reais conectadas.
          </p>
        </div>
      )}
    </div>
  );
};
