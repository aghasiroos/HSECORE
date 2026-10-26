/**
 * Central File Utilities for HSECORE
 * Provides consistent file size formatting, validation, and Base64 DataURL reading across all modules.
 */

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => reject(new Error(`خطا در خواندن فایل «${file.name}»`));
    reader.readAsDataURL(file);
  });
}

export interface FileValidationOptions {
  maxSizeBytes?: number;
  allowedExtensions?: string[];
  allowPdf?: boolean;
  allowImages?: boolean;
}

export function validateFileTypeAndSize(
  file: File,
  options: FileValidationOptions = {}
): { valid: boolean; error?: string; isPdf: boolean; isImage: boolean; extension: string } {
  const maxSizeBytes = options.maxSizeBytes ?? 15 * 1024 * 1024;
  const allowPdf = options.allowPdf ?? true;
  const allowImages = options.allowImages ?? true;

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const isPdf = extension === 'pdf' || file.type === 'application/pdf';
  const isImage =
    ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(extension) ||
    file.type.startsWith('image/');

  if (options.allowedExtensions && options.allowedExtensions.length > 0) {
    if (!options.allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `فرمت فایل «${file.name}» مجاز نمی‌باشد.`,
        isPdf,
        isImage,
        extension,
      };
    }
  } else {
    if ((!allowPdf || !isPdf) && (!allowImages || !isImage)) {
      return {
        valid: false,
        error: `فرمت فایل «${file.name}» مجاز نمی‌باشد. تنها اسناد PDF و تصاویر معتبر پشتیبانی می‌شوند.`,
        isPdf,
        isImage,
        extension,
      };
    }
  }

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `حجم فایل «${file.name}» (${formatFileSize(file.size)}) بیش از سقف مجاز (${formatFileSize(maxSizeBytes)}) است.`,
      isPdf,
      isImage,
      extension,
    };
  }

  return { valid: true, isPdf, isImage, extension };
}

/**
 * Exports CSV content or 2D rows array as a UTF-8 BOM CSV file download.
 */
export function downloadCsvFile(
  filename: string,
  contentOrRows: string | (string | number | null | undefined)[][],
  headers?: string[]
): void {
  let rawCsv = '';
  if (typeof contentOrRows === 'string') {
    rawCsv = contentOrRows.startsWith('\uFEFF') ? contentOrRows.slice(1) : contentOrRows;
  } else {
    const lines: string[] = [];
    if (headers && headers.length > 0) {
      lines.push(headers.join(','));
    }
    for (const row of contentOrRows) {
      lines.push(
        row
          .map((cell) => {
            const str = String(cell ?? '');
            return str.startsWith('"') && str.endsWith('"')
              ? str
              : `"${str.replace(/"/g, '""')}"`;
          })
          .join(',')
      );
    }
    rawCsv = lines.join('\n');
  }

  const blob = new Blob(['\uFEFF' + rawCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Compresses an image file on the client side using HTMLCanvasElement.
 */
export function compressImageFile(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<{ dataUrl: string; sizeBytes: number; sizeFormatted: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('خطا در خواندن فایل'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => {
        const fallbackUrl = (reader.result as string) || '';
        resolve({
          dataUrl: fallbackUrl,
          sizeBytes: file.size,
          sizeFormatted: `${(file.size / 1024).toFixed(0)} KB`,
        });
      };
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const fallbackUrl = (reader.result as string) || '';
          resolve({
            dataUrl: fallbackUrl,
            sizeBytes: file.size,
            sizeFormatted: `${(file.size / 1024).toFixed(0)} KB`,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
        const approxSizeKb = Math.round(approxBytes / 1024);
        resolve({
          dataUrl: compressedDataUrl,
          sizeBytes: approxBytes,
          sizeFormatted: `${approxSizeKb} KB`,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

