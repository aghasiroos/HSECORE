import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { 
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, 
  Download, ExternalLink, RefreshCw, AlertCircle, FileText, 
  Maximize, Minimize, Check, Layers, Sparkles
} from 'lucide-react';
import { apiDb } from '../../../services/apiDatabaseClient';

// Configure pdfjs worker reliably using local static worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker || '/pdfjs/pdf.worker.min.mjs';
  }
}

interface Props {
  fileId?: string;
  fileData?: string; // base64 string or URL
  fileName?: string;
  displayName?: string;
  language: 'fa' | 'en';
  onDownload?: () => void;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const sanitized = cleanBase64.replace(/\s+/g, '');
  const binaryString = window.atob(sanitized);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function createBlobUrl(base64: string, mimeType = 'application/pdf'): string {
  try {
    const bytes = base64ToUint8Array(base64);
    const blob = new Blob([bytes], { type: mimeType });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.error('[createBlobUrl] Failed:', e);
    return '';
  }
}

export default function PdfDocumentViewer({
  fileId,
  fileData,
  fileName = 'document.pdf',
  displayName = 'فایل PDF',
  language,
  onDownload
}: Props) {
  const isFa = language === 'fa';
  
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [rotation, setRotation] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'all'>('all'); // 'single' page or 'all' pages scrollable
  const [blobUrl, setBlobUrl] = useState<string>('');
  
  // High-fidelity page image cache when fileId is present
  const [serverPageImages, setServerPageImages] = useState<{ [pageNum: number]: string }>({});
  const [isServerRenderMode, setIsServerRenderMode] = useState<boolean>(Boolean(fileId));

  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const loadedPagesRef = useRef<Set<number>>(new Set());
  const requestedPagesRef = useRef<Set<number>>(new Set());
  const createdUrlsRef = useRef<string[]>([]);

  // Generate Blob URL for opening in new tab or external viewer
  useEffect(() => {
    if (fileData) {
      if (fileData.startsWith('data:')) {
        const url = createBlobUrl(fileData, 'application/pdf');
        setBlobUrl(url);
        return () => {
          if (url) URL.revokeObjectURL(url);
        };
      } else {
        setBlobUrl(fileData);
      }
    }
  }, [fileData]);

  // Load server-rendered page images when fileId is available
  const [loadingPageMap, setLoadingPageMap] = useState<{ [pageNum: number]: boolean }>({});

  const loadServerPage = useCallback(async (pageNum: number) => {
    if (!fileId || loadedPagesRef.current.has(pageNum) || requestedPagesRef.current.has(pageNum)) return;
    requestedPagesRef.current.add(pageNum);
    setLoadingPageMap(prev => ({ ...prev, [pageNum]: true }));
    try {
      const res = await apiDb.fetchPdfPageImageUrl(fileId, pageNum);
      if (res?.url) {
        createdUrlsRef.current.push(res.url);
        loadedPagesRef.current.add(pageNum);
        setServerPageImages(prev => ({ ...prev, [pageNum]: res.url }));
        if (res.totalPages && res.totalPages > 0) {
          setNumPages(res.totalPages);
        }
      }
    } catch (e) {
      console.warn(`[PdfDocumentViewer] Server render page ${pageNum} error, falling back:`, e);
    } finally {
      requestedPagesRef.current.delete(pageNum);
      setLoadingPageMap(prev => ({ ...prev, [pageNum]: false }));
    }
  }, [fileId]);

  // Load PDF Document
  useEffect(() => {
    let isMounted = true;
    loadedPagesRef.current.clear();
    requestedPagesRef.current.clear();

    async function initViewer() {
      setLoading(true);
      setError(null);

      // If fileId is present, start with server rasterization for 100% font perfection
      if (fileId) {
        try {
          const res = await apiDb.fetchPdfPageImageUrl(fileId, 1);
          if (res?.url) {
            if (!isMounted) return;
            createdUrlsRef.current.push(res.url);
            loadedPagesRef.current.add(1);
            setServerPageImages({ 1: res.url });
            const total = res.totalPages || 1;
            setNumPages(total);
            setCurrentPage(1);
            setIsServerRenderMode(true);
            setLoading(false);

            // Preload next visible pages in background
            for (let p = 2; p <= Math.min(total, 15); p++) {
              loadServerPage(p);
            }
            return;
          }
        } catch {
          // Fall back to client-side pdfjs
        }
      }

      if (!fileData) {
        setError('داده‌های فایل PDF در دسترس نمی‌باشد.');
        setLoading(false);
        return;
      }

      try {
        const isBrowser = typeof window !== 'undefined';
        const origin = isBrowser ? window.location.origin : '';
        const cMapUrl = `${origin}/pdfjs/cmaps/`;
        const standardFontDataUrl = `${origin}/pdfjs/standard_fonts/`;

        const commonDocOptions = {
          cMapUrl,
          cMapPacked: true,
          standardFontDataUrl,
          enableXfa: true,
          isEvalSupported: false,
          useSystemFonts: true,
        };

        let loadingTask: pdfjsLib.PDFDocumentLoadingTask;

        if (fileData.startsWith('data:') || (!fileData.startsWith('http') && !fileData.startsWith('blob:') && !fileData.startsWith('/'))) {
          const uint8Data = base64ToUint8Array(fileData);
          loadingTask = pdfjsLib.getDocument({
            data: uint8Data,
            ...commonDocOptions,
          });
        } else {
          loadingTask = pdfjsLib.getDocument({
            url: fileData,
            ...commonDocOptions,
          });
        }

        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setIsServerRenderMode(false);
        setLoading(false);
      } catch (err: any) {
        console.error('[PdfDocumentViewer] Error loading PDF:', err);
        if (isMounted) {
          setError(err?.message || 'خطا در بارگذاری و پردازش فایل PDF');
          setLoading(false);
        }
      }
    }

    initViewer();

    return () => {
      isMounted = false;
      // Revoke created blob URLs
      createdUrlsRef.current.forEach(u => {
        try { URL.revokeObjectURL(u); } catch {}
      });
      createdUrlsRef.current = [];

      if (pdfDocRef.current) {
        try {
          if (typeof (pdfDocRef.current as any).cleanup === 'function') {
            (pdfDocRef.current as any).cleanup();
          } else if (typeof (pdfDocRef.current as any).destroy === 'function') {
            (pdfDocRef.current as any).destroy();
          }
        } catch {}
        pdfDocRef.current = null;
      }
    };
  }, [fileId, fileData, loadServerPage]);

  // Preload visible pages in server render mode when page changes
  useEffect(() => {
    if (!isServerRenderMode || !fileId || numPages <= 0) return;

    if (viewMode === 'single') {
      loadServerPage(currentPage);
      if (currentPage + 1 <= numPages) loadServerPage(currentPage + 1);
    } else {
      for (let i = 1; i <= Math.min(numPages, 20); i++) {
        if (!loadedPagesRef.current.has(i)) {
          loadServerPage(i);
        }
      }
    }
  }, [isServerRenderMode, fileId, numPages, currentPage, viewMode, loadServerPage]);

  // Render a specific page onto canvas (client-side fallback mode)
  const renderPage = useCallback(async (pageNum: number, canvas: HTMLCanvasElement) => {
    if (isServerRenderMode || !pdfDocRef.current || !canvas) return;

    try {
      const page = await pdfDocRef.current.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale, rotation: rotation });

      const outputScale = window.devicePixelRatio || 1;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = Math.floor(viewport.width) + 'px';
      canvas.style.height = Math.floor(viewport.height) + 'px';

      const transform = outputScale !== 1
        ? [outputScale, 0, 0, outputScale, 0, 0]
        : undefined;

      const renderContext: any = {
        canvasContext: context,
        canvas: canvas,
        transform: transform,
        viewport: viewport
      };

      await page.render(renderContext).promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.warn(`[PdfDocumentViewer] Error rendering page ${pageNum}:`, err);
      }
    }
  }, [isServerRenderMode, scale, rotation]);

  // Trigger page renders when pages or display parameters change in client mode
  useEffect(() => {
    if (isServerRenderMode || !pdfDocRef.current || loading || error) return;

    if (viewMode === 'single') {
      const canvas = canvasRefs.current[currentPage];
      if (canvas) {
        renderPage(currentPage, canvas);
      }
    } else {
      for (let i = 1; i <= numPages; i++) {
        const canvas = canvasRefs.current[i];
        if (canvas) {
          renderPage(i, canvas);
        }
      }
    }
  }, [isServerRenderMode, numPages, currentPage, scale, rotation, viewMode, loading, error, renderPage]);

  const scrollToPage = (pageNum: number) => {
    const el = document.getElementById(`pdf-page-${pageNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Toolbar Actions
  const handlePrevPage = () => {
    const next = Math.max(1, currentPage - 1);
    setCurrentPage(next);
    if (isServerRenderMode && fileId) {
      loadServerPage(next);
      if (viewMode === 'all') scrollToPage(next);
    }
  };
  const handleNextPage = () => {
    const next = Math.min(numPages, currentPage + 1);
    setCurrentPage(next);
    if (isServerRenderMode && fileId) {
      loadServerPage(next);
      if (viewMode === 'all') scrollToPage(next);
    }
  };
  const handleZoomIn = () => setScale(s => Math.min(3.0, Number((s + 0.2).toFixed(1))));
  const handleZoomOut = () => setScale(s => Math.max(0.5, Number((s - 0.2).toFixed(1))));
  const handleRotate = () => setRotation(r => (r + 90) % 360);
  const handleFitWidth = () => {
    if (containerRef.current) {
      const containerWidth = containerRef.current.clientWidth - 48;
      const newScale = Math.max(0.6, Math.min(2.5, containerWidth / 800));
      setScale(Number(newScale.toFixed(2)));
    }
  };

  const handleOpenInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
    } else if (fileData) {
      const url = createBlobUrl(fileData, 'application/pdf');
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-slate-900 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
      {/* Top PDF Controls Toolbar */}
      <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Page Navigation */}
        <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-700">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || loading}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 rounded-md hover:bg-slate-700 cursor-pointer transition-colors"
            title={isFa ? 'صفحه قبل' : 'Previous Page'}
          >
            <ChevronRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>

          <div className="flex items-center gap-1 font-mono px-2 text-xs font-semibold">
            <span>{currentPage}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-400">{numPages || '...'}</span>
          </div>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages || loading}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-40 disabled:hover:text-slate-300 rounded-md hover:bg-slate-700 cursor-pointer transition-colors"
            title={isFa ? 'صفحه بعد' : 'Next Page'}
          >
            <ChevronLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          </button>
        </div>

        {/* Center: Zoom & Display Controls */}
        <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700">
          <button
            onClick={handleZoomOut}
            disabled={loading || scale <= 0.5}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-40 rounded-md hover:bg-slate-700 cursor-pointer transition-colors"
            title={isFa ? 'کوچک‌نمایی' : 'Zoom Out'}
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="text-[11px] font-mono font-bold text-slate-300 px-1.5 min-w-[45px] text-center">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={loading || scale >= 3.0}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-40 rounded-md hover:bg-slate-700 cursor-pointer transition-colors"
            title={isFa ? 'بزرگ‌نمایی' : 'Zoom In'}
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-full max-w-[1px] h-4 bg-slate-700 mx-1" />

          <button
            onClick={handleFitWidth}
            disabled={loading}
            className="px-2 py-0.5 text-[11px] font-bold text-slate-300 hover:text-white rounded-md hover:bg-slate-700 cursor-pointer transition-colors"
            title={isFa ? 'تطبیق با عرض صفحه' : 'Fit Width'}
          >
            {isFa ? 'عرض صفحه' : 'Fit'}
          </button>

          <button
            onClick={handleRotate}
            disabled={loading}
            className="p-1 text-slate-300 hover:text-white disabled:opacity-40 rounded-md hover:bg-slate-700 cursor-pointer transition-colors"
            title={isFa ? 'چرخش ۹۰ درجه' : 'Rotate'}
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Engine status indicator badge */}
        {isServerRenderMode && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 text-emerald-300 border border-emerald-700/50 text-[11px] font-bold shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isFa ? 'موتور بومی (اصلاح کامل حروف فارسی)' : 'Native Poppler Engine (Persian Fixed)'}</span>
          </div>
        )}

        {/* View mode toggle: Continuous Scroll vs Single Page */}
        <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setViewMode('all')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'all' 
                ? 'bg-teal-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isFa ? 'تمام صفحات' : 'All Pages'}</span>
          </button>
          <button
            onClick={() => setViewMode('single')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
              viewMode === 'single' 
                ? 'bg-teal-600 text-white shadow-xs' 
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isFa ? 'تک صفحه' : 'Single'}</span>
          </button>
        </div>

        {/* Right: External Open & Download */}
        <div className="flex items-center gap-2">
          {blobUrl && (
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-xs"
              title={isFa ? 'باز کردن در تب جداگانه مرورگر' : 'Open in New Tab'}
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>{isFa ? 'پنجره جدید' : 'New Window'}</span>
            </button>
          )}

          {onDownload && (
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isFa ? 'دانلود' : 'Download'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Document Scroll Viewport */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 sm:p-6 flex flex-col items-center gap-6 bg-slate-950/80 min-h-0 w-full"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center my-auto py-16 text-center">
            <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mb-3" />
            <p className="text-sm font-bold text-slate-200">
              {isFa ? 'در حال رندر و پردازش سند با بالاترین کیفیت...' : 'Rendering PDF document...'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {fileName}
            </p>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center my-auto p-8 max-w-md bg-slate-900 rounded-2xl border border-rose-800/60 text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/70 text-rose-400 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-sm mb-1">
              {isFa ? 'عدم امکان رندر مستقیم در این نما' : 'Could not render PDF directly'}
            </h4>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {error}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {blobUrl && (
                <button
                  onClick={handleOpenInNewTab}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{isFa ? 'باز کردن با نمایشگر مرورگر' : 'Open with browser'}</span>
                </button>
              )}
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>{isFa ? 'دانلود مستقیم فایل' : 'Direct Download'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {!loading && !error && numPages > 0 && (
          <>
            {isServerRenderMode ? (
              // ================================================================
              // Native High-Fidelity Server Mode (Perfect Persian font shaping)
              // ================================================================
              viewMode === 'single' ? (
                <div className="flex flex-col items-center justify-center p-2 w-full">
                  <div
                    className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300 transition-all duration-150"
                    style={{
                      width: `${Math.round(800 * scale)}px`,
                      maxWidth: '100%',
                      transform: rotation ? `rotate(${rotation}deg)` : undefined,
                      transformOrigin: 'center center',
                    }}
                  >
                    {serverPageImages[currentPage] ? (
                      <img
                        src={serverPageImages[currentPage]}
                        alt={`صفحه ${currentPage}`}
                        className="w-full h-auto block select-none"
                      />
                    ) : (
                      <div className="w-full min-h-[500px] bg-slate-900/40 flex flex-col items-center justify-center p-8 text-slate-300">
                        <RefreshCw className="w-8 h-8 animate-spin text-teal-400 mb-2" />
                        <span className="text-xs font-bold font-mono">
                          {isFa ? `در حال پردازش صفحه ${currentPage}...` : `Rendering page ${currentPage}...`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // All pages continuous vertical view
                Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNum) => (
                  <div
                    key={pageNum}
                    id={`pdf-page-${pageNum}`}
                    className="flex flex-col items-center relative group w-full mb-6"
                  >
                    {/* Page number badge */}
                    <div className="sticky top-2 z-10 px-3 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-[11px] font-mono text-slate-200 border border-slate-700/60 shadow-md mb-2">
                      {isFa ? `صفحه ${pageNum} از ${numPages}` : `Page ${pageNum} of ${numPages}`}
                    </div>

                    <div
                      className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300 transition-all duration-150"
                      style={{
                        width: `${Math.round(800 * scale)}px`,
                        maxWidth: '100%',
                        transform: rotation ? `rotate(${rotation}deg)` : undefined,
                        transformOrigin: 'center center',
                      }}
                    >
                      {serverPageImages[pageNum] ? (
                        <img
                          src={serverPageImages[pageNum]}
                          alt={`صفحه ${pageNum}`}
                          className="w-full h-auto block select-none"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full min-h-[500px] bg-slate-900/40 flex flex-col items-center justify-center p-8 text-slate-300">
                          <RefreshCw className="w-8 h-8 animate-spin text-teal-400 mb-2" />
                          <span className="text-xs font-bold font-mono">
                            {isFa ? `در حال پردازش صفحه ${pageNum}...` : `Rendering page ${pageNum}...`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : (
              // ================================================================
              // Client Canvas Fallback Mode
              // ================================================================
              viewMode === 'single' ? (
                <div className="flex flex-col items-center bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300">
                  <canvas
                    ref={(el) => { canvasRefs.current[currentPage] = el; }}
                    className="block max-w-full"
                  />
                </div>
              ) : (
                Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNum) => (
                  <div key={pageNum} className="flex flex-col items-center relative group">
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-xs text-[10px] font-mono text-slate-200 opacity-60 group-hover:opacity-100 transition-opacity z-10">
                      صفحه {pageNum} از {numPages}
                    </div>

                    <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300">
                      <canvas
                        ref={(el) => { canvasRefs.current[pageNum] = el; }}
                        className="block max-w-full"
                      />
                    </div>
                  </div>
                ))
              )
            )}
          </>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="px-4 py-2 bg-slate-850 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
        <span className="truncate max-w-sm">
          {displayName} ({fileName})
        </span>
        <span className="font-mono text-[10px] text-slate-400">
          تعداد کل صفحات: {numPages}
        </span>
      </div>
    </div>
  );
}
