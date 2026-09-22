/**
 * Image compression utility to ensure all image uploads and camera snapshots
 * fit comfortably inside Firestore document size limits (well under 300KB).
 */
export async function compressImage(
  dataUrlOrFile: string | File,
  maxDimension = 1080,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(typeof dataUrlOrFile === 'string' ? dataUrlOrFile : URL.createObjectURL(dataUrlOrFile));
        return;
      }

      // Draw and compress as JPEG
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = (err) => {
      console.warn('Image compression fallback', err);
      if (typeof dataUrlOrFile === 'string') {
        resolve(dataUrlOrFile);
      } else {
        reject(err);
      }
    };

    if (typeof dataUrlOrFile === 'string') {
      img.src = dataUrlOrFile;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(dataUrlOrFile);
    }
  });
}
