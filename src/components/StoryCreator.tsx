import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Check, RefreshCw, Sparkles, Type } from 'lucide-react';
import { Story, User } from '../types';
import { sounds } from '../utils/audioSynth';
import { compressImage } from '../utils/imageCompress';

interface StoryCreatorProps {
  currentUser: User;
  onPublishStory: (newStory: Story) => void;
  onClose: () => void;
}

export const StoryCreator: React.FC<StoryCreatorProps> = ({
  currentUser,
  onPublishStory,
  onClose,
}) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [selectedFilter, setSelectedFilter] = useState<string>('none');
  const [textSticker, setTextSticker] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize camera stream
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.warn('Camera access denied or unavailable', err);
      setCameraError('Permissão da câmera não concedida ou dispositivo sem câmera.');
    }
  };

  useEffect(() => {
    if (!capturedMedia) {
      startCamera();
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode, capturedMedia]);

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture photo from video feed
  const takePhoto = async () => {
    if (!videoRef.current) return;
    sounds.playShutter();
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mirror if user facing
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const compressed = await compressImage(dataUrl, 1080, 0.82);
      setCapturedMedia(compressed);
      setMediaType('image');
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }
    }
  };

  // Upload custom file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVid = file.type.startsWith('video');
    setMediaType(isVid ? 'video' : 'image');
    if (isVid) {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedMedia(reader.result as string);
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }
      };
      reader.readAsDataURL(file);
    } else {
      try {
        const compressed = await compressImage(file, 1080, 0.82);
        setCapturedMedia(compressed);
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }
      } catch (err) {
        console.warn('Story image compression error', err);
      }
    }
  };

  const handlePublish = () => {
    if (!capturedMedia) return;
    const newStory: Story = {
      id: `story_${Date.now()}`,
      author: currentUser,
      mediaUrl: capturedMedia,
      mediaType: mediaType,
      filter: selectedFilter !== 'none' ? selectedFilter : undefined,
      textSticker: textSticker.trim() || undefined,
      createdAt: 'agora mesmo',
      isSeen: false,
    };
    onPublishStory(newStory);
    onClose();
  };

  const filters = [
    { id: 'none', label: 'Normal' },
    { id: 'clarendon', label: 'Clarendon' },
    { id: 'juno', label: 'Juno' },
    { id: 'valencia', label: 'Valencia' },
    { id: 'cyberpunk', label: 'Cyber' },
    { id: 'bw', label: 'P&B' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex items-center justify-center p-2 md:p-6">
      {/* Hidden canvas & file input */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="relative w-full max-w-[420px] h-[92vh] max-h-[820px] rounded-3xl overflow-hidden bg-zinc-950 flex flex-col justify-between border border-zinc-800 shadow-2xl">
        {/* Top bar controls */}
        <div className="absolute top-0 left-0 right-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="text-sm font-bold text-white tracking-wide">Criar Story</span>

          {capturedMedia ? (
            <button
              onClick={() => setCapturedMedia(null)}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
              title="Tirar outra foto"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={toggleCameraFacing}
              className="p-2 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
              title="Inverter Câmera"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Viewfinder / Preview */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center bg-zinc-900 overflow-hidden">
          {capturedMedia ? (
            <div className="relative w-full h-full">
              {mediaType === 'video' ? (
                <video
                  src={capturedMedia}
                  autoPlay
                  loop
                  playsInline
                  className={`w-full h-full object-cover ${selectedFilter !== 'none' ? `filter-${selectedFilter}` : ''}`}
                />
              ) : (
                <img
                  src={capturedMedia}
                  alt="Preview"
                  className={`w-full h-full object-cover ${selectedFilter !== 'none' ? `filter-${selectedFilter}` : ''}`}
                />
              )}

              {/* Text sticker in preview */}
              {textSticker && (
                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-black/70 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center shadow-xl">
                  <p className="text-base font-bold text-white drop-shadow-md">
                    {textSticker}
                  </p>
                </div>
              )}
            </div>
          ) : cameraError ? (
            <div className="p-6 text-center space-y-4">
              <Camera className="w-12 h-12 text-zinc-500 mx-auto" />
              <p className="text-xs text-zinc-400">{cameraError}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-pink-500 text-white text-xs font-semibold"
              >
                Carregar Foto ou Vídeo
              </button>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`}
            />
          )}
        </div>

        {/* Bottom controls */}
        <div className="relative z-30 p-4 bg-gradient-to-t from-black via-black/80 to-transparent space-y-3">
          {capturedMedia ? (
            <>
              {/* Filter Selection Chips */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFilter(f.id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedFilter === f.id
                        ? 'bg-pink-500 text-white shadow-md'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Text sticker input */}
              <div className="flex items-center gap-2 bg-zinc-900/90 rounded-xl px-3 py-2 border border-zinc-800">
                <Type className="w-4 h-4 text-zinc-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Escrever uma legenda para o story..."
                  value={textSticker}
                  onChange={(e) => setTextSticker(e.target.value)}
                  className="bg-transparent text-xs text-white placeholder:text-zinc-500 w-full focus:outline-none"
                />
              </div>

              {/* Publish Button */}
              <button
                onClick={handlePublish}
                className="w-full py-3 rounded-2xl auragram-gradient text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-pink-500/25 active:scale-[0.98] transition-transform"
              >
                <Check className="w-4 h-4" />
                Compartilhar no Story
              </button>
            </>
          ) : (
            /* Live Camera Shutter & Upload Actions */
            <div className="flex items-center justify-around pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors"
                title="Carregar da Galeria"
              >
                <Upload className="w-5 h-5" />
              </button>

              {/* Big Shutter Button */}
              <button
                onClick={takePhoto}
                className="w-16 h-16 rounded-full border-4 border-white p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
              >
                <div className="w-full h-full rounded-full bg-white" />
              </button>

              <button
                onClick={toggleCameraFacing}
                className="p-3 rounded-full bg-zinc-800/80 text-white hover:bg-zinc-700 transition-colors"
                title="Inverter Câmera"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
