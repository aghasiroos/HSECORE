import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Eraser, PenTool, Upload, FileSignature, Check } from 'lucide-react';
import { getPersonnelSignature, processSignatureImageFile } from '../../utils/personnelHelper';
import { getCurrentUser } from '../../utils/authHelper';

interface DigitalSignaturePadProps {
  onSave: (base64Signature: string) => void;
  onClear?: () => void;
  initialSignature?: string;
  isFa?: boolean;
  storedSignature?: string;
  signerTarget?: any;
  autoUseStoredSignature?: boolean;
}

export const DigitalSignaturePad: React.FC<DigitalSignaturePadProps> = ({
  onSave,
  onClear,
  initialSignature,
  isFa = true,
  storedSignature,
  signerTarget,
  autoUseStoredSignature = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialSignature);
  const [activeImageSignature, setActiveImageSignature] = useState<string | undefined>(initialSignature);
  const [uploadError, setUploadError] = useState<string>('');
  const hasDrawnRef = useRef(false);

  // Resolve stored signature from explicit prop, signerTarget, or logged-in user
  const resolvedStoredSignature = useMemo(() => {
    if (storedSignature && storedSignature.startsWith('data:image/')) return storedSignature;
    if (signerTarget) {
      const sig = getPersonnelSignature(signerTarget);
      if (sig) return sig;
    }
    const currentUser = getCurrentUser();
    if (currentUser) {
      const sig = getPersonnelSignature(currentUser);
      if (sig) return sig;
    }
    return undefined;
  }, [storedSignature, signerTarget]);

  // Automatically apply stored signature when opening pad if no initialSignature is set
  useEffect(() => {
    if (initialSignature) {
      setActiveImageSignature(initialSignature);
      setHasSignature(true);
    } else if (autoUseStoredSignature && resolvedStoredSignature && !hasDrawnRef.current) {
      setActiveImageSignature(resolvedStoredSignature);
      setHasSignature(true);
      onSave(resolvedStoredSignature);
    }
  }, [initialSignature, resolvedStoredSignature, autoUseStoredSignature]);

  const drawImageCentered = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, canvasWidth: number, canvasHeight: number) => {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    const pad = 12;
    const availW = Math.max(10, canvasWidth - pad * 2);
    const availH = Math.max(10, canvasHeight - pad * 2);
    const scale = Math.min(availW / (img.width || 1), availH / (img.height || 1), 1.5);
    const drawW = (img.width || availW) * scale;
    const drawH = (img.height || availH) * scale;
    const dx = (canvasWidth - drawW) / 2;
    const dy = (canvasHeight - drawH) / 2;
    ctx.drawImage(img, dx, dy, drawW, drawH);
  };

  const setupCanvas = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = Math.max(200, Math.floor(container.clientWidth));
    const height = Math.max(120, Math.floor(container.clientHeight));

    const prevDataUrl =
      hasDrawnRef.current && canvas.width > 0 && canvas.height > 0
        ? canvas.toDataURL('image/png')
        : null;

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.strokeStyle = isDark ? '#38bdf8' : '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const sigToRender = prevDataUrl || (!hasDrawnRef.current ? (activeImageSignature || initialSignature) : null);
    if (sigToRender) {
      const img = new Image();
      img.onload = () => {
        drawImageCentered(ctx, img, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = sigToRender;
    }
  };

  useEffect(() => {
    setupCanvas();

    const resizeObserver = new ResizeObserver(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const nextW = Math.floor(container.clientWidth);
      const nextH = Math.floor(container.clientHeight);
      if (nextW > 0 && nextH > 0 && (Math.abs(canvas.width - nextW) > 4 || Math.abs(canvas.height - nextH) > 4)) {
        setupCanvas();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeImageSignature, initialSignature]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    const mouseEvt = e as React.MouseEvent<HTMLCanvasElement>;
    return {
      x: (mouseEvt.clientX - rect.left) * scaleX,
      y: (mouseEvt.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.strokeStyle = isDark ? '#38bdf8' : '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setActiveImageSignature(undefined);
    hasDrawnRef.current = true;
    setHasSignature(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e.cancelable) e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
    setHasSignature(true);
  };

  const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (e && e.cancelable) e.preventDefault();
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && hasDrawnRef.current) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  const clearCanvas = () => {
    setUploadError('');
    setActiveImageSignature(undefined);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    hasDrawnRef.current = false;
    setHasSignature(false);
    if (onClear) onClear();
  };

  const handleUseStoredSignature = () => {
    if (!resolvedStoredSignature) return;
    setUploadError('');
    hasDrawnRef.current = false;
    setActiveImageSignature(resolvedStoredSignature);
    setHasSignature(true);
    onSave(resolvedStoredSignature);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      const dataUrl = await processSignatureImageFile(file);
      hasDrawnRef.current = false;
      setActiveImageSignature(dataUrl);
      setHasSignature(true);
      onSave(dataUrl);
    } catch (err: any) {
      setUploadError(err?.message || (isFa ? 'فرمت فایل امضا نامعتبر است. فقط PNG یا JPEG مجاز است.' : 'Only PNG or JPEG allowed.'));
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
        <span className="flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          {isFa ? 'کادر ثبت امضای دیجیتال:' : 'Digital Signature Pad:'}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap">
          {resolvedStoredSignature && (
            <button
              type="button"
              onClick={handleUseStoredSignature}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition cursor-pointer ${
                activeImageSignature === resolvedStoredSignature
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
              }`}
              title={isFa ? 'درج نمونه امضای ثبت‌شده پرسنل' : 'Use Stored Personnel Signature'}
            >
              <FileSignature className="w-3.5 h-3.5" />
              <span>{isFa ? 'امضای ثبت‌شده پرسنل' : 'Saved Signature'}</span>
            </button>
          )}

          <label className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition cursor-pointer">
            <Upload className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            <span>{isFa ? 'بارگذاری PNG/JPEG' : 'Upload PNG/JPEG'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={clearCanvas}
            className="px-2 py-1 rounded-lg text-[11px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 cursor-pointer font-bold transition"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>{isFa ? 'پاک کردن' : 'Clear'}</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-1.5">
          {uploadError}
        </div>
      )}

      <div
        ref={containerRef}
        className="relative w-full h-40 sm:h-36 bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden touch-none cursor-crosshair select-none"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full block"
        />
        {!hasSignature && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-400 font-medium select-none px-4 text-center">
            {isFa
              ? 'با ماوس/لمس امضا کنید یا از دکمه «امضای ثبت‌شده پرسنل» / «بارگذاری PNG/JPEG» استفاده نمایید'
              : 'Draw your signature or use your saved PNG/JPEG signature'}
          </div>
        )}
        {hasSignature && activeImageSignature && (
          <div className="absolute bottom-1.5 left-2 pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50/90 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
            <Check className="w-3 h-3" />
            <span>
              {activeImageSignature === resolvedStoredSignature
                ? (isFa ? 'نمونه امضای پرسنلی بارگذاری شد' : 'Personnel signature loaded')
                : (isFa ? 'تصویر امضا بارگذاری شد' : 'Signature image loaded')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

