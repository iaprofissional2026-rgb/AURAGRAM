/**
 * Media Utilities for Camera, Audio Meter, and Canvas Image Processing
 */

// Generate beautiful procedural SVG Data URLs for avatars and media fallback
export function generateSvgDataUrl(type: 'avatar' | 'landscape' | 'urban' | 'cafe' | 'abstract' | 'portrait', title: string, seed = 1): string {
  const gradients: Record<string, [string, string, string]> = {
    avatar: ['#ec4899', '#8b5cf6', '#3b82f6'],
    landscape: ['#f97316', '#e11d48', '#4c1d95'],
    urban: ['#1e1b4b', '#312e81', '#06b6d4'],
    cafe: ['#78350f', '#b45309', '#f59e0b'],
    abstract: ['#10b981', '#06b6d4', '#6366f1'],
    portrait: ['#be185d', '#7c3aed', '#1e1b4b'],
  };

  const [c1, c2, c3] = gradients[type] || gradients.abstract;

  if (type === 'avatar') {
    const initials = title.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${c1}" />
          <stop offset="50%" stop-color="${c2}" />
          <stop offset="100%" stop-color="${c3}" />
        </linearGradient>
      </defs>
      <circle cx="100" cy="100" r="100" fill="url(#g)" />
      <circle cx="100" cy="80" r="36" fill="rgba(255,255,255,0.22)" />
      <path d="M40 180 C40 135 160 135 160 180 Z" fill="rgba(255,255,255,0.22)" />
      <text x="100" y="112" font-family="-apple-system, system-ui, sans-serif" font-weight="700" font-size="44" fill="#ffffff" text-anchor="middle">${initials}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  // Scenery / Editorial photo SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${c1}" />
        <stop offset="50%" stop-color="${c2}" />
        <stop offset="100%" stop-color="${c3}" />
      </linearGradient>
      <radialGradient id="sun" cx="70%" cy="30%" r="50%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8" />
        <stop offset="40%" stop-color="#ffffff" stop-opacity="0.2" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.05 0" />
      </filter>
    </defs>
    <rect width="1080" height="1080" fill="url(#bg)" />
    <rect width="1080" height="1080" fill="#ffffff" filter="url(#noise)" opacity="0.4" />
    <circle cx="750" cy="350" r="300" fill="url(#sun)" />
    
    <!-- Mountain / Architecture silhouette -->
    <path d="M0 720 L240 500 L420 640 L680 420 L940 680 L1080 580 L1080 1080 L0 1080 Z" fill="rgba(0,0,0,0.35)" />
    <path d="M0 840 L320 660 L540 800 L820 620 L1080 820 L1080 1080 L0 1080 Z" fill="rgba(0,0,0,0.45)" />
    
    <!-- Subtle overlay grid & watermark -->
    <text x="60" y="1000" font-family="-apple-system, system-ui, sans-serif" font-weight="800" font-size="52" fill="#ffffff" opacity="0.92" letter-spacing="-0.02em">${title}</text>
    <text x="60" y="1035" font-family="-apple-system, system-ui, sans-serif" font-weight="500" font-size="24" fill="#ffffff" opacity="0.75">Shot on AuraGram Pro • 4K HDR</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

// Hook or class for real microphone audio level monitoring
export function createAudioMeter(stream: MediaStream, onLevelChange: (level: number) => void) {
  let audioCtx: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let analyser: AnalyserNode | null = null;
  let animId: number | null = null;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioCtx();
    source = audioCtx.createMediaStreamSource(stream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const checkVolume = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(100, Math.round((average / 128) * 100));
      onLevelChange(normalized);
      animId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  } catch (err) {
    console.warn('Audio meter initialization failed', err);
  }

  return () => {
    if (animId) cancelAnimationFrame(animId);
    if (source) source.disconnect();
    if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
  };
}
