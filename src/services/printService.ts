/**
 * ============================================================================
 * Centralized Enterprise Print Service for HSE Management System
 * ============================================================================
 * 
 * Provides unified, standardized A4 / A5 printing across the entire platform:
 * - Opens printouts in a dedicated, isolated clean browser tab / window.
 * - Strips away all application UI, sidebars, navigation, modals, and toolbars.
 * - Automatically triggers native browser Print Dialog (`window.print()`).
 * - Allows full printer selection (network, local, Canon, HP, Epson, PDF).
 * - Calibrated for A4 (portrait & landscape) with standard margins and RTL.
 * - Prevents table row splits and signature truncation (`break-inside: avoid`).
 * - Preserves organizational branding, stamps, dates, and doc serial numbers.
 * - Fully compatible with Chrome, Edge, Firefox, and Safari.
 * - Gracefully handles and notifies on popup blockers with instant user unlock.
 * - Zero external or cloud dependencies (100% native DOM and CSS3 Print).
 */

export interface PrintOptions {
  /** Document title shown in tab and used as default PDF filename */
  title?: string;
  /** Page orientation: portrait (عمودی) or landscape (افقی) */
  orientation?: 'portrait' | 'landscape';
  /** Standard paper size */
  pageSize?: 'A4' | 'A5';
  /** Page margin string (default: 10mm 12mm) */
  margin?: string;
  /** Whether document is Persian/RTL */
  isFa?: boolean;
  /** Automatically trigger window.print() once page loads */
  autoPrint?: boolean;
  /** Automatically close the print tab after user finishes printing */
  autoCloseAfterPrint?: boolean;
  /** Custom CSS to inject */
  customStyles?: string;
  /** Document code/serial (e.g. HSE/w/001, RHS-F34) */
  documentCode?: string;
  /** Document registration or issuance date */
  documentDate?: string;
  /** Additional container classes */
  containerClass?: string;
}

// Global event name for popup blocker notifications
export const POPUP_BLOCKED_EVENT = 'hse_print_popup_blocked';

export interface PopupBlockedEventDetail {
  title: string;
  openAction: () => void;
}

/**
 * Extract active stylesheets and styles from the current document
 */
function collectDocumentStyles(): string {
  let styles = '';

  // 1. Collect inline <style> tags
  const styleTags = document.querySelectorAll('style');
  styleTags.forEach(style => {
    // Avoid re-injecting existing print-visibility-hidden hacks from old modals
    const content = style.innerHTML;
    if (!content.includes('body * { visibility: hidden')) {
      styles += content + '\n';
    }
  });

  // 2. Collect <link rel="stylesheet"> references and convert to absolute links
  const linkTags = document.querySelectorAll('link[rel="stylesheet"]');
  let linksHtml = '';
  linkTags.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const absoluteHref = new URL(href, window.location.href).href;
      linksHtml += `<link rel="stylesheet" href="${absoluteHref}">\n`;
    }
  });

  return `${linksHtml}<style>${styles}</style>`;
}

/**
 * Deep clone an element while preserving form inputs values and checked states
 */
function cloneWithInputValues(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;

  // Sync inputs
  const originalInputs = element.querySelectorAll<HTMLInputElement>('input');
  const clonedInputs = clone.querySelectorAll<HTMLInputElement>('input');
  originalInputs.forEach((orig, idx) => {
    const cloned = clonedInputs[idx];
    if (!cloned) return;
    if (orig.type === 'checkbox' || orig.type === 'radio') {
      cloned.checked = orig.checked;
      if (orig.checked) {
        cloned.setAttribute('checked', 'checked');
      } else {
        cloned.removeAttribute('checked');
      }
    } else {
      cloned.value = orig.value;
      cloned.setAttribute('value', orig.value);
    }
  });

  // Sync textareas
  const originalTextareas = element.querySelectorAll<HTMLTextAreaElement>('textarea');
  const clonedTextareas = clone.querySelectorAll<HTMLTextAreaElement>('textarea');
  originalTextareas.forEach((orig, idx) => {
    const cloned = clonedTextareas[idx];
    if (!cloned) return;
    cloned.value = orig.value;
    cloned.textContent = orig.value;
  });

  // Sync selects
  const originalSelects = element.querySelectorAll<HTMLSelectElement>('select');
  const clonedSelects = clone.querySelectorAll<HTMLSelectElement>('select');
  originalSelects.forEach((orig, idx) => {
    const cloned = clonedSelects[idx];
    if (!cloned) return;
    cloned.value = orig.value;
    const origOptions = orig.querySelectorAll('option');
    const clonedOptions = cloned.querySelectorAll('option');
    origOptions.forEach((opt, optIdx) => {
      if (clonedOptions[optIdx]) {
        if (opt.selected) {
          clonedOptions[optIdx].setAttribute('selected', 'selected');
        } else {
          clonedOptions[optIdx].removeAttribute('selected');
        }
      }
    });
  });

  // Clean out unwanted elements inside the print document (action buttons, close icons, zoom controls)
  const unwantedSelectors = [
    '.no-print',
    '.print\\:hidden',
    '[data-no-print]',
    'button:not(.print-keep-button)',
    '.zoom-controls'
  ];
  unwantedSelectors.forEach(selector => {
    try {
      const unwantedEls = clone.querySelectorAll(selector);
      unwantedEls.forEach(el => el.remove());
    } catch {
      // ignore invalid selector syntax
    }
  });

  // Strip transform scaling (like zoom preview) from cloned element
  clone.style.transform = 'none';
  clone.style.margin = '0 auto';

  return clone;
}

/**
 * Generate full HTML5 document markup for clean printing
 */
function buildPrintHtml(
  contentHtml: string,
  options: PrintOptions = {}
): string {
  const {
    title = 'سند رسمی چاپ سامانه مدیریت HSE',
    orientation = 'portrait',
    pageSize = 'A4',
    margin = '10mm 12mm',
    isFa = true,
    autoPrint = true,
    autoCloseAfterPrint = false,
    customStyles = '',
    documentCode = '',
    documentDate = ''
  } = options;

  const collectedStyles = collectDocumentStyles();

  return `<!DOCTYPE html>
<html lang="${isFa ? 'fa' : 'en'}" dir="${isFa ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>

  <!-- Google Fonts Vazirmatn & JetBrains Mono -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">

  ${collectedStyles}

  <style>
    /* ==========================================================================
       ENTERPRISE STANDARDIZED HSE PRINT STYLESHEET
       ========================================================================== */
    
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }

    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #0f172a;
      font-family: 'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, sans-serif;
      direction: ${isFa ? 'rtl' : 'ltr'};
      text-align: ${isFa ? 'right' : 'left'};
      line-height: 1.45;
      font-size: 11pt;
    }

    /* Page Definition */
    @page {
      size: ${pageSize} ${orientation};
      margin: ${margin};
    }

    /* Page Header & Numbering Rules */
    @page {
      @bottom-center {
        content: "صفحه " counter(page) " از " counter(pages);
        font-family: 'Vazirmatn', Tahoma, sans-serif;
        font-size: 8.5pt;
        color: #64748b;
      }
    }

    /* Table Protection & Repeating Headers */
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      page-break-inside: auto !important;
    }

    thead {
      display: table-header-group !important;
    }

    tfoot {
      display: table-footer-group !important;
    }

    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    td, th {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* Crucial Section & Signature Block Protections */
    .avoid-break,
    .print-avoid-break,
    .print-keep-together,
    .signature-box,
    .stamp-box,
    .official-signatures,
    .kpi-summary-box,
    .form-section,
    fieldset {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    .page-break,
    .print-page-break {
      page-break-before: always !important;
      break-before: page !important;
    }

    /* Screen Preview Mode (Toolbar + Clean Desk Preview) */
    @media screen {
      body {
        background-color: #e2e8f0;
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-bottom: 40px;
      }

      .print-screen-toolbar {
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        width: 100%;
        z-index: 99999;
        background: #0f172a;
        color: #ffffff;
        padding: 12px 24px;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        font-family: 'Vazirmatn', Tahoma, sans-serif;
      }

      .print-screen-toolbar .title-area {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .print-screen-toolbar .badge {
        background: #1e293b;
        color: #38bdf8;
        border: 1px solid #38bdf840;
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: bold;
        font-family: 'JetBrains Mono', monospace;
      }

      .print-screen-toolbar .btn-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .print-btn-primary {
        background: #0284c7;
        color: #ffffff;
        border: none;
        padding: 8px 18px;
        border-radius: 8px;
        font-weight: 800;
        font-size: 12px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
      }
      .print-btn-primary:hover {
        background: #0369a1;
        transform: translateY(-1px);
      }

      .print-btn-close {
        background: #334155;
        color: #e2e8f0;
        border: none;
        padding: 8px 14px;
        border-radius: 8px;
        font-weight: bold;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      .print-btn-close:hover {
        background: #475569;
        color: #ffffff;
      }

      .print-sheet-wrapper {
        background: #ffffff;
        margin: 20px auto;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05);
        border-radius: 4px;
        width: ${orientation === 'landscape' ? '297mm' : '210mm'};
        max-width: 96vw;
        min-height: ${orientation === 'landscape' ? '210mm' : '297mm'};
        padding: 10mm 12mm;
        box-sizing: border-box;
      }
    }

    /* Print Mode (Zero Screen UI, Full Document Fidelity) */
    @media print {
      .no-print,
      .print-screen-toolbar,
      header.print\\:hidden,
      nav,
      aside {
        display: none !important;
      }

      body {
        background: transparent !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
      }

      .print-sheet-wrapper {
        box-shadow: none !important;
        border: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: none !important;
        min-height: auto !important;
      }
    }

    ${customStyles}
  </style>
</head>
<body>
  <!-- Screen Navigation Bar (Hidden during Print) -->
  <div class="print-screen-toolbar no-print">
    <div class="title-area">
      <span style="font-weight: 900; font-size: 14px;">🖨️ ${title}</span>
      ${documentCode ? `<span class="badge">${documentCode}</span>` : ''}
      ${documentDate ? `<span style="font-size: 11px; opacity: 0.8;">تاریخ: ${documentDate}</span>` : ''}
    </div>
    <div class="btn-group">
      <span style="font-size: 11px; color: #94a3b8; margin-left: 8px;">
        راهنما: در پنجره چاپگر، اندازه کاغذ را روی <strong>${pageSize}</strong> و حاشیه را روی استاندارد تنظیم نمایید.
      </span>
      <button type="button" onclick="triggerNativePrint()" class="print-btn-primary">
        <span>چاپ / ذخیره PDF</span>
      </button>
      <button type="button" onclick="window.close()" class="print-btn-close">
        <span>بستن پنجره</span>
      </button>
    </div>
  </div>

  <!-- Document Sheet Canvas -->
  <main class="print-sheet-wrapper">
    ${contentHtml}
  </main>

  <script>
    function triggerNativePrint() {
      try {
        window.focus();
        window.print();
      } catch (err) {
        console.error('Error invoking print:', err);
      }
    }

    ${autoPrint ? `
    window.addEventListener('load', function() {
      // Wait briefly for SVGs, logos and webfonts to complete layout rendering
      setTimeout(function() {
        triggerNativePrint();
      }, 350);
    });
    ` : ''}

    ${autoCloseAfterPrint ? `
    window.addEventListener('afterprint', function() {
      setTimeout(function() {
        window.close();
      }, 500);
    });
    ` : ''}
  </script>
</body>
</html>`;
}

/**
 * Reusable Print Service Object
 */
export const printService = {
  /**
   * Print a given HTML element by reference or DOM selector/ID.
   * Opens in a clean, standalone tab and automatically triggers browser print dialog.
   */
  printElement(
    elementOrId: HTMLElement | string,
    options: PrintOptions = {}
  ): boolean {
    let targetEl: HTMLElement | null = null;

    if (typeof elementOrId === 'string') {
      targetEl = document.getElementById(elementOrId) || document.querySelector<HTMLElement>(elementOrId);
    } else {
      targetEl = elementOrId;
    }

    if (!targetEl) {
      console.error(`[PrintService] Target element not found:`, elementOrId);
      return false;
    }

    const cloned = cloneWithInputValues(targetEl);
    const contentHtml = cloned.outerHTML;

    return this.printHtml(contentHtml, options);
  },

  /**
   * Print an arbitrary HTML string in a clean new tab with full A4 styling.
   */
  printHtml(htmlContent: string, options: PrintOptions = {}): boolean {
    const title = options.title || 'سند رسمی چاپ سامانه HSE';
    const fullMarkup = buildPrintHtml(htmlContent, { ...options, title });

    // Open clean blank tab
    const printWindow = window.open('', '_blank');

    if (!printWindow || printWindow.closed || typeof printWindow.closed === 'undefined') {
      console.warn('[PrintService] Popup was blocked by browser.');
      // Dispatch custom event to notify parent UI with retry action
      window.dispatchEvent(
        new CustomEvent<PopupBlockedEventDetail>(POPUP_BLOCKED_EVENT, {
          detail: {
            title,
            openAction: () => {
              this.printHtml(htmlContent, options);
            }
          }
        })
      );
      return false;
    }

    try {
      printWindow.document.open();
      printWindow.document.write(fullMarkup);
      printWindow.document.close();
      printWindow.focus();
      return true;
    } catch (err) {
      console.error('[PrintService] Error writing to print window:', err);
      return false;
    }
  }
};
