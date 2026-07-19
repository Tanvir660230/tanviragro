export async function compressImage(
  file: File,
  options: { maxWidthOrHeight?: number; maxSizeMB?: number } = {}
): Promise<File> {
  const maxWidthOrHeight = options.maxWidthOrHeight || 800;
  const maxSizeMB = options.maxSizeMB || 0.5;

  return new Promise((resolve, reject) => {
    // If it's not an image, just return the file
    if (!file.type.startsWith("image/")) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = Math.round((height *= maxWidthOrHeight / width));
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = Math.round((width *= maxWidthOrHeight / height));
            height = maxWidthOrHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        
        if (!ctx) {
          return resolve(file); // fallback
        }

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.9;
        const targetSize = maxSizeMB * 1024 * 1024;

        const attemptCompression = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return resolve(file);
              
              if (blob.size > targetSize && quality > 0.1) {
                quality -= 0.1;
                attemptCompression();
              } else {
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              }
            },
            "image/jpeg",
            quality
          );
        };

        attemptCompression();
      };
      
      img.onerror = (error) => reject(error);
    };
    
    reader.onerror = (error) => reject(error);
  });
}
