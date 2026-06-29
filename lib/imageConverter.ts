export async function imageToBitmap(file: File): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = new OffscreenCanvas(128, 64);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get 2d context'));
        return;
      }
      
      // Fill black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, 128, 64);
      
      // Calculate scaling to fit within 128x64 while maintaining aspect ratio
      const scale = Math.min(128 / img.width, 64 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (128 - w) / 2;
      const y = (64 - h) / 2;
      
      ctx.drawImage(img, x, y, w, h);
      
      const imageData = ctx.getImageData(0, 0, 128, 64);
      const data = imageData.data;
      
      // Convert to binary using simple threshold (128)
      // This avoids the "granulation" (dithering) requested by the user
      const width = 128;
      const height = 64;
      const bitmap = new Array(1024).fill(0);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          // Grayscale conversion
          const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
          
          if (brightness > 128) {
            const byteIdx = y * 16 + (x >> 3);
            const bitIdx = 7 - (x & 7);
            bitmap[byteIdx] |= (1 << bitIdx);
          }
        }
      }
      
      resolve(bitmap);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export function generateDefaultBitmap(): number[] {
  const canvas = new OffscreenCanvas(128, 64);
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Array(1024).fill(0);

  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, 128, 64);

  ctx.strokeStyle = 'white';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  
  // Draw rounded rectangle manually
  const x = 2, y = 2, w = 124, h = 60, r = 8;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();

  const imageData = ctx.getImageData(0, 0, 128, 64);
  const data = imageData.data;
  
  const bitmap = new Array(1024).fill(0);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 128; x++) {
      const idx = (y * 128 + x) * 4;
      const r = data[idx];
      if (r > 128) {
        const byteIdx = y * 16 + (x >> 3);
        const bitIdx = 7 - (x & 7);
        bitmap[byteIdx] |= (1 << bitIdx);
      }
    }
  }
  return bitmap;
}
