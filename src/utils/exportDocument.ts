import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export interface ExportOptions {
  filename: string;
  format: 'pdf' | 'png' | 'jpg';
  scale?: number;
}

/**
 * Downloads a Blob or DataURL as a file in the browser (works on Android Chrome, Safari, Desktop)
 */
function downloadFile(url: string, filename: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 200);
}

/**
 * Capture an HTML element with high fidelity and proper framing across mobile (Android/iOS) and desktop.
 * Enforces a standard professional document layout width (820px) inside the clone iframe
 * so mobile screen widths never clip tables, totals, stamps, or headers.
 */
async function captureDocumentCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
  const TARGET_DOC_WIDTH = 820; // Optimal standard A4 width proportion in px for crisp printing & viewing

  return await html2canvas(element, {
    scale: 2, // 2x high resolution for sharp text and numbers
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 1040, // Ensure desktop media queries apply so elements don't collapse into mobile columns
    windowHeight: 1440,
    onclone: (clonedDoc: Document, clonedEl: HTMLElement) => {
      // 1. Prepare cloned iframe viewport
      if (clonedDoc.documentElement) {
        clonedDoc.documentElement.style.width = '1040px';
        clonedDoc.documentElement.style.minWidth = '1040px';
        clonedDoc.documentElement.style.overflow = 'visible';
        clonedDoc.documentElement.style.backgroundColor = '#ffffff';
      }
      if (clonedDoc.body) {
        clonedDoc.body.style.width = '1040px';
        clonedDoc.body.style.minWidth = '1040px';
        clonedDoc.body.style.overflow = 'visible';
        clonedDoc.body.style.backgroundColor = '#ffffff';
        clonedDoc.body.style.margin = '0';
        clonedDoc.body.style.padding = '0';
      }

      // 2. Unconstrain all ancestors of the captured element so nothing is clipped
      let parent = clonedEl.parentElement;
      while (parent && parent !== clonedDoc.body) {
        parent.style.width = '100%';
        parent.style.minWidth = '100%';
        parent.style.maxWidth = 'none';
        parent.style.overflow = 'visible';
        parent.style.maxHeight = 'none';
        parent.style.transform = 'none';
        parent.style.position = 'static';
        parent = parent.parentElement;
      }

      // 3. Format the captured element itself with fixed professional document geometry
      if (clonedEl) {
        clonedEl.style.width = `${TARGET_DOC_WIDTH}px`;
        clonedEl.style.minWidth = `${TARGET_DOC_WIDTH}px`;
        clonedEl.style.maxWidth = `${TARGET_DOC_WIDTH}px`;
        clonedEl.style.boxSizing = 'border-box';
        clonedEl.style.overflow = 'visible';
        clonedEl.style.position = 'relative';
        clonedEl.style.left = '0';
        clonedEl.style.top = '0';
        clonedEl.style.transform = 'none';
        clonedEl.style.margin = '0 auto';
        clonedEl.style.padding = '36px 36px 48px 36px';
        clonedEl.style.backgroundColor = '#ffffff';
        clonedEl.style.borderRadius = '0';
        clonedEl.style.boxShadow = 'none';
        clonedEl.style.border = 'none';

        // 4. Ensure all tables inside the cloned document occupy full width without scrollbars
        const tables = clonedEl.querySelectorAll('table');
        tables.forEach((table) => {
          (table as HTMLElement).style.width = '100%';
          (table as HTMLElement).style.minWidth = '100%';
          (table as HTMLElement).style.maxWidth = '100%';
          (table as HTMLElement).style.tableLayout = 'auto';
          (table as HTMLElement).style.borderCollapse = 'collapse';
        });

        // 5. Unconstrain any responsive overflow-x / overflow-y wrappers inside the element
        const overflowDivs = clonedEl.querySelectorAll('div');
        overflowDivs.forEach((div) => {
          const comp = clonedDoc.defaultView?.getComputedStyle(div);
          if (comp && (comp.overflowX === 'auto' || comp.overflowX === 'scroll' || comp.overflowY === 'auto' || comp.overflowY === 'scroll' || comp.overflow === 'hidden')) {
            div.style.overflow = 'visible';
            div.style.overflowX = 'visible';
            div.style.overflowY = 'visible';
          }
        });
      }
    },
  });
}

/**
 * Exports an HTML element directly to a PNG or JPG file with guaranteed complete framing
 */
export async function exportElementToImage(
  element: HTMLElement,
  filenameWithoutExt: string,
  format: 'png' | 'jpg'
): Promise<string> {
  const canvas = await captureDocumentCanvas(element);

  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
  const quality = format === 'jpg' ? 0.95 : undefined;
  const dataUrl = canvas.toDataURL(mimeType, quality);

  const cleanFilename = `${filenameWithoutExt}.${format}`;
  downloadFile(dataUrl, cleanFilename);
  return dataUrl;
}

/**
 * Exports an HTML element directly to a formatted PDF file (A4 portrait)
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filenameWithoutExt: string,
  _title?: string
): Promise<void> {
  const canvas = await captureDocumentCanvas(element);

  const imgData = canvas.toDataURL('image/jpeg', 0.98);

  // A4 dimensions in mm: 210 x 297
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - (margin * 2);

  // Calculate image aspect ratio
  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * usableWidth) / canvas.width;

  if (imgHeight <= pageHeight - (margin * 2)) {
    // Fits in a single page
    pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
  } else {
    // Multi-page handling if document is long
    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - margin * 2);

    while (heightLeft > 0) {
      pdf.addPage();
      position = -(pageHeight * (pdf.getNumberOfPages() - 1)) + margin;
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
  }

  const cleanFilename = `${filenameWithoutExt}.pdf`;
  pdf.save(cleanFilename);
}
