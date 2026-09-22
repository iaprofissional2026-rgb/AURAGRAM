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
  ArrowLeft
} from 'lucide-react';
import { User, ChatMessage } from '../types';
import { sounds } from '../utils/audioSynth';
import { compressImage } from '../utils/imageCompress';

interface DirectChatProps {
  currentUser: User;
  contacts: User[];
  messagesMap: Record<string, ChatMessage[]>;
  onSendMessage: (recipientId: string, message: Omit<ChatMessage, 'id' | 'timestamp' | 'read'>) => void;
  onStartCall: (contact: User, type: 'voice' | 'video') => void;
  initialSelectedUser?: User | null;
}

export const DirectChat: React.FC<DirectChatProps> = ({
  currentUser,
  contacts,
  messagesMap,
  onSendMessage,
  onStartCall,
  initialSelectedUser,
}) => {
  const [selectedContact, setSelectedContact] = useState<User>(initialSelectedUser || contacts[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordIntervalRef = useRef<number | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const currentMessages = messagesMap[selectedContact?.id] || [];

  // Auto scroll to bottom of chat
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
  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(selectedContact.id, {
      senderId: currentUser.id,
      recipientId: selectedContact.id,
      type: 'text',
      content: inputText.trim(),
    });

    sounds.playLikePop();
    setInputText('');
  };

  // Send Image Attachment
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedContact) return;

    try {
      const compressed = await compressImage(file, 1080, 0.82);
      onSendMessage(selectedContact.id, {
        senderId: currentUser.id,
        recipientId: selectedContact.id,
        type: 'image',
        content: compressed,
      });
      sounds.playLikePop();
    } catch (err) {
      console.warn('Error compressing chat image', err);
    }
  };

  // Start Real Microphone Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onSendMessage(selectedContact.id, {
            senderId: currentUser.id,
            recipientId: selectedContact.id,
            type: 'voice',
            content: reader.result as string,
            audioDuration: recordDuration,
          });
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = window.setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone recording error', err);
    }
  };

  // Stop Recording & Send
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
    }
  };

  // Cancel Recording without sending
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
    }
  };

  // Play audio voice note
  const togglePlayAudio = (msgId: string, audioUrl: string) => {
    if (playingAudioId === msgId) {
      activeAudioRef.current?.pause();
      setPlayingAudioId(null);
    } else {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;
      audio.play();
      setPlayingAudioId(msgId);
      audio.onended = () => setPlayingAudioId(null);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-5rem)] md:h-[calc(100vh-3rem)] max-w-6xl mx-auto flex rounded-2xl md:rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Left Contacts Sidebar */}
      <aside className={`w-full md:w-80 lg:w-96 border-r border-zinc-800 flex flex-col bg-black/40 ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
        {/* User DM Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white tracking-tight">
              @{currentUser.username}
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
          </div>
          <span className="text-[11px] font-medium text-pink-400 bg-pink-500/10 px-2.5 py-1 rounded-full border border-pink-500/20">
            Aura Direct
          </span>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-2 px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar usuários cadastrados..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs text-white placeholder:text-zinc-500 w-full focus:outline-none"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
          {filteredContacts.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 space-y-2">
              <Sparkles className="w-8 h-8 text-pink-500/40 mx-auto" />
              <p className="text-xs font-medium text-zinc-400">Nenhum usuário encontrado</p>
              <p className="text-[11px] text-zinc-500">
                Novos usuários cadastrados aparecerão aqui em tempo real.
              </p>
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
                  className={`w-full p-3.5 flex items-center gap-3 text-left transition-colors ${
                    isSelected ? 'bg-zinc-800/60' : 'hover:bg-zinc-900/50'
                  }`}
                >
                  <div className="relative shrink-0">
                    <img
                      src={contact.avatar}
                      alt={contact.name}
                      className="w-12 h-12 rounded-full object-cover ring-2 ring-zinc-800"
                    />
                    {contact.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-black" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-white truncate">
                        {contact.name}
                      </span>
                      {lastMsg && (
                        <span className="text-[10px] text-zinc-500 shrink-0">
                          {lastMsg.timestamp}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate">
                      {lastMsg 
                        ? (lastMsg.type === 'voice' 
                            ? '🎤 Mensagem de voz' 
                            : lastMsg.type === 'image' 
                            ? '📷 Foto' 
                            : lastMsg.content)
                        : `@${contact.username}`}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Conversation Window */}
      {selectedContact ? (
        <div className={`flex-1 flex flex-col bg-zinc-950 ${selectedContact ? 'flex' : 'hidden md:flex'}`}>
          {/* Chat Top Header with Real Calling Actions */}
          <header className="px-4 md:px-6 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSelectedContact(null as any)}
                className="md:hidden p-2 -ml-2 rounded-xl text-zinc-400 hover:text-white"
                title="Voltar aos contatos"
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
                  <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-black" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {selectedContact.name}
                  <span className="text-[10px] text-zinc-500 font-normal">@{selectedContact.username}</span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  {selectedContact.isOnline ? 'Online agora' : 'Disponível no AuraGram'}
                </p>
              </div>
            </div>

            {/* Calling Buttons: Voice & Video Call! */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onStartCall(selectedContact, 'voice')}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-800 transition-colors shadow-sm"
                title="Iniciar Chamada de Voz"
              >
                <Phone className="w-5 h-5 text-emerald-400" />
              </button>

              <button
                onClick={() => onStartCall(selectedContact, 'video')}
                className="p-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 transition-colors shadow-sm flex items-center gap-1.5"
                title="Iniciar Chamada de Vídeo HD"
              >
                <Video className="w-5 h-5" />
                <span className="text-xs font-bold hidden lg:inline">Vídeo</span>
              </button>
            </div>
          </header>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {currentMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 p-6 text-zinc-500">
                <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-pink-400">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Nenhuma mensagem ainda</h4>
                  <p className="text-xs text-zinc-400 max-w-xs mt-1">
                    Envie um oi para {selectedContact.name} ou inicie uma chamada de voz e vídeo instantânea!
                  </p>
                </div>
              </div>
            ) : (
              currentMessages.map((msg) => {
                const isMine = msg.senderId === currentUser.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isMine && (
                      <img
                        src={selectedContact.avatar}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover shrink-0 mb-1"
                      />
                    )}

                    <div
                      className={`max-w-[70%] rounded-2xl p-3 text-xs leading-relaxed shadow-md ${
                        isMine
                          ? 'bg-pink-600 text-white rounded-br-none'
                          : 'bg-zinc-800 text-zinc-200 rounded-bl-none'
                      }`}
                    >
                      {msg.type === 'text' && <p>{msg.content}</p>}

                      {msg.type === 'image' && (
                        <div className="rounded-xl overflow-hidden mb-1">
                          <img
                            src={msg.content}
                            alt="Anexo"
                            className="w-full max-h-64 object-cover"
                          />
                        </div>
                      )}

                      {msg.type === 'voice' && (
                        <div className="flex items-center gap-3 py-1 min-w-[200px]">
                          <button
                            onClick={() => togglePlayAudio(msg.id, msg.content)}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white"
                          >
                            {playingAudioId === msg.id ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4 ml-0.5" />
                            )}
                          </button>
                          <div className="flex-1 flex items-center gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                              <div
                                key={i}
                                className="w-1 bg-white/60 rounded-full"
                                style={{ height: `${(i % 4 + 2) * 5}px` }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-white/80 font-mono">
                            {msg.audioDuration ? `${msg.audioDuration}s` : 'Áudio'}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] opacity-70">
                        <span>{msg.timestamp}</span>
                        {isMine && <CheckCheck className="w-3 h-3 text-white" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Recording Banner (if active) */}
          {isRecording && (
            <div className="p-3 bg-rose-500/10 border-t border-rose-500/30 flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                <span className="text-xs font-bold text-rose-400">Gravando áudio...</span>
                <span className="text-xs font-mono text-white">{recordDuration}s</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={cancelRecording}
                  className="text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={stopRecording}
                  className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  Enviar Áudio
                </button>
              </div>
            </div>
          )}

          {/* Input Footer */}
          <footer className="p-4 border-t border-zinc-800 bg-zinc-900/30">
            <form onSubmit={handleSendText} className="flex items-center gap-2">
              {/* Photo Upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Enviar Imagem"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              {/* Emoji quick */}
              <button
                type="button"
                onClick={() => setInputText((prev) => prev + '❤️')}
                className="p-2.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                title="Inserir Emoji"
              >
                <Smile className="w-5 h-5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                placeholder="Enviar mensagem..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 px-4 py-3 rounded-2xl focus:outline-none focus:border-pink-500"
              />

              {/* Voice Note Button OR Send Button */}
              {inputText.trim() ? (
                <button
                  type="submit"
                  className="p-3 rounded-2xl auragram-gradient text-white hover:opacity-90 active:scale-95 transition-all shadow-md shadow-pink-500/20"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-pink-400 border border-zinc-800 transition-colors"
                  title="Gravar Mensagem de Voz"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </form>
          </footer>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500">
          Selecione uma conversa para começar
        </div>
      )}
    </div>
  );
};
