import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Camera, 
  Upload, 
  Sparkles, 
  Sliders, 
  MapPin, 
  Music, 
  Check, 
  RefreshCw, 
  SlidersHorizontal 
} from 'lucide-react';
import { Post, User } from '../types';
import { sounds } from '../utils/audioSynth';
import { compressImage } from '../utils/imageCompress';

interface CreatePostModalProps {
  currentUser: User;
  onClose: () => void;
  onPublishPost: (newPost: Post) => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  currentUser,
  onClose,
  onPublishPost,
}) => {
  const [step, setStep] = useState<'media' | 'filter' | 'details'>('media');
  const [mediaSource, setMediaSource] = useState<'camera' | 'upload'>('upload');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [filter, setFilter] = useState<string>('none');
  const [brightness, setBrightness] = useState<number>(100);
  const [contrast, setContrast] = useState<number>(100);
  const [saturation, setSaturation] = useState<number>(100);
  const [caption, setCaption] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [musicTrack, setMusicTrack] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filters = [
    { id: 'none', label: 'Normal' },
    { id: 'clarendon', label: 'Clarendon' },
    { id: 'juno', label: 'Juno' },
    { id: 'ludwig', label: 'Ludwig' },
    { id: 'valencia', label: 'Valencia' },
    { id: 'slumber', label: 'Slumber' },
    { id: 'bw', label: 'Monocromático' },
    { id: 'cyberpunk', label: 'Cyber' },
    { id: 'cinematic', label: 'Cinematográfico' },
  ];

  const musicTracks = [
    'Sem música de fundo',
    'The Weeknd • Blinding Lights',
    'Dua Lipa • Levitating',
    'Ludovico Einaudi • Experience',
    'Peggy Gou • (It Goes Like) Nanana',
    'Kavinsky • Nightcall (Synthwave)',
    'FKJ • Ylang Ylang',
  ];

  const suggestedTags = ['#fotografia', '#natureza', '#lifestyle', '#vibes', '#tecnologia', '#brasil'];

  // Start webcam for live capture
  const startCamera = async () => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 1280 }, facingMode: 'user' },
        audio: false,
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
    } catch (err) {
      console.warn('Cannot open camera', err);
    }
  };

  useEffect(() => {
    if (mediaSource === 'camera' && !mediaUrl) {
      startCamera();
    } else if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [mediaSource, mediaUrl]);

  const snapPhoto = async () => {
    if (!videoRef.current) return;
    sounds.playShutter();
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL('image/jpeg', 0.95);
      const compressed = await compressImage(url, 1080, 0.82);
      setMediaUrl(compressed);
      setMediaType('image');
      setStep('filter');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVid = file.type.startsWith('video');
    setMediaType(isVid ? 'video' : 'image');
    if (isVid) {
      const reader = new FileReader();
      reader.onload = () => {
        setMediaUrl(reader.result as string);
        setStep('filter');
      };
      reader.readAsDataURL(file);
    } else {
      try {
        const compressed = await compressImage(file, 1080, 0.82);
        setMediaUrl(compressed);
        setStep('filter');
      } catch (err) {
        console.warn('Error compressing image', err);
      }
    }
  };

  const handlePublish = () => {
    if (!mediaUrl) return;
    const newPost: Post = {
      id: `post_${Date.now()}`,
      author: currentUser,
      mediaUrl: mediaUrl,
      mediaType: mediaType,
      filter: filter !== 'none' ? filter : undefined,
      caption: caption.trim(),
      location: location.trim() || undefined,
      musicTrack: musicTrack && musicTrack !== 'Sem música de fundo' ? musicTrack : undefined,
      likesCount: 1,
      isLiked: true,
      commentsCount: 0,
      comments: [],
      isSaved: false,
      createdAt: 'agora mesmo',
    };
    onPublishPost(newPost);
    onClose();
  };

  const inlineFilterStyle = {
    filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Top Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 'details') setStep('filter');
              else if (step === 'filter') setStep('media');
              else onClose();
            }}
            className="text-xs font-semibold text-zinc-400 hover:text-white"
          >
            {step === 'media' ? 'Cancelar' : 'Voltar'}
          </button>

          <h2 className="text-sm font-bold text-white">
            {step === 'media' && 'Nova Publicação'}
            {step === 'filter' && 'Filtros & Ajustes'}
            {step === 'details' && 'Criar Nova Publicação'}
          </h2>

          {step === 'filter' && (
            <button
              onClick={() => setStep('details')}
              className="text-xs font-bold text-pink-500 hover:text-pink-400"
            >
              Avançar
            </button>
          )}

          {step === 'details' && (
            <button
              onClick={handlePublish}
              className="text-xs font-bold text-pink-500 hover:text-pink-400"
            >
              Compartilhar
            </button>
          )}

          {step === 'media' && <div className="w-12" />}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          {/* Media Preview Box */}
          <div className="flex-1 bg-black min-h-[340px] md:min-h-[480px] flex items-center justify-center relative overflow-hidden">
            {step === 'media' ? (
              mediaSource === 'camera' ? (
                <div className="relative w-full h-full flex flex-col items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                  <div className="absolute bottom-6 flex items-center gap-4">
                    <button
                      onClick={snapPhoto}
                      className="w-16 h-16 rounded-full border-4 border-white p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-xl"
                    >
                      <div className="w-full h-full rounded-full bg-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-pink-500">
                    <Upload className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white mb-1">
                      Arraste fotos e vídeos aqui
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Suporte a PNG, JPG, MP4 em alta resolução
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 rounded-xl auragram-gradient text-white text-xs font-bold shadow-lg shadow-pink-500/20 active:scale-95 transition-transform"
                    >
                      Selecionar do Computador
                    </button>
                    <button
                      onClick={() => setMediaSource('camera')}
                      className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                      <Camera className="w-4 h-4 text-pink-400" />
                      Usar Câmera
                    </button>
                  </div>
                </div>
              )
            ) : (
              /* Filtered preview */
              <div className="relative w-full h-full flex items-center justify-center">
                {mediaType === 'video' ? (
                  <video
                    src={mediaUrl!}
                    autoPlay
                    loop
                    muted
                    playsInline
                    style={inlineFilterStyle}
                    className={`w-full h-full object-contain ${filter !== 'none' ? `filter-${filter}` : ''}`}
                  />
                ) : (
                  <img
                    src={mediaUrl!}
                    alt="Preview"
                    style={inlineFilterStyle}
                    className={`w-full h-full object-contain ${filter !== 'none' ? `filter-${filter}` : ''}`}
                  />
                )}
              </div>
            )}
          </div>

          {/* Right Editing Sidebar (Filters, Adjustments & Details) */}
          {step !== 'media' && (
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-zinc-800 p-5 bg-zinc-950 flex flex-col justify-between space-y-4">
              {step === 'filter' && (
                <div className="space-y-5">
                  <div>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-3">
                      Filtros Criativos
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {filters.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFilter(f.id)}
                          className={`p-2 rounded-xl text-center border text-xs font-semibold transition-all ${
                            filter === f.id
                              ? 'bg-pink-500/20 border-pink-500 text-pink-400'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Adjustments Sliders */}
                  <div className="space-y-3 pt-3 border-t border-zinc-800">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                      Ajustes Manuais
                    </span>
                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                        <span>Brilho</span>
                        <span>{brightness}%</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="140"
                        value={brightness}
                        onChange={(e) => setBrightness(Number(e.target.value))}
                        className="w-full accent-pink-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                        <span>Contraste</span>
                        <span>{contrast}%</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="140"
                        value={contrast}
                        onChange={(e) => setContrast(Number(e.target.value))}
                        className="w-full accent-pink-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-zinc-300 mb-1">
                        <span>Saturação</span>
                        <span>{saturation}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={saturation}
                        onChange={(e) => setSaturation(Number(e.target.value))}
                        className="w-full accent-pink-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step === 'details' && (
                <div className="space-y-4">
                  {/* User info */}
                  <div className="flex items-center gap-3">
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-xs font-bold text-white">{currentUser.username}</p>
                      <p className="text-[10px] text-zinc-400">{currentUser.name}</p>
                    </div>
                  </div>

                  {/* Caption textarea */}
                  <div>
                    <textarea
                      rows={4}
                      placeholder="Escreva uma legenda envolvente..."
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-pink-500 resize-none"
                    />
                  </div>

                  {/* Suggested hashtags quick insert */}
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setCaption((prev) => `${prev} ${tag}`.trim())}
                        className="text-[11px] text-pink-400 bg-pink-500/10 px-2.5 py-1 rounded-lg hover:bg-pink-500/20 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {/* Location Picker */}
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                    <MapPin className="w-4 h-4 text-zinc-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Adicionar localização..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="bg-transparent text-xs text-white placeholder:text-zinc-500 w-full focus:outline-none"
                    />
                  </div>

                  {/* Music Track Picker */}
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
                    <Music className="w-4 h-4 text-pink-400 shrink-0" />
                    <select
                      value={musicTrack}
                      onChange={(e) => setMusicTrack(e.target.value)}
                      className="bg-transparent text-xs text-white w-full focus:outline-none"
                    >
                      {musicTracks.map((m) => (
                        <option key={m} value={m} className="bg-zinc-900 text-white">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
