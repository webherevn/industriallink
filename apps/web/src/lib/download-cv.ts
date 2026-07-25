import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Điểm cắt ưu tiên (theo Y trên canvas) — đầu mỗi khối nội dung. */
function collectBreakPoints(element: HTMLElement, scaleY: number): number[] {
  const rootTop = element.getBoundingClientRect().top + window.scrollY;
  const points = new Set<number>([0]);
  element.querySelectorAll<HTMLElement>('[data-cv-block]').forEach((block) => {
    const top =
      block.getBoundingClientRect().top + window.scrollY - rootTop + element.scrollTop;
    if (top > 1) points.add(Math.round(top * scaleY));
  });
  return [...points].sort((a, b) => a - b);
}

/**
 * Chia trang tại ranh giới section/experience — tránh cắt giữa khối nội dung.
 */
function buildPageSlices(
  totalHeight: number,
  pageHeightPx: number,
  breakPoints: number[],
): { start: number; end: number }[] {
  const slices: { start: number; end: number }[] = [];
  let y = 0;
  const minSlice = Math.max(40, pageHeightPx * 0.25);

  while (y < totalHeight - 1) {
    const idealEnd = Math.min(y + pageHeightPx, totalHeight);
    if (idealEnd >= totalHeight - 1) {
      slices.push({ start: y, end: totalHeight });
      break;
    }

    let cut = idealEnd;
    // Chọn điểm cắt gần cuối trang nhất, không cắt quá sát đầu trang
    for (let i = breakPoints.length - 1; i >= 0; i -= 1) {
      const bp = breakPoints[i];
      if (bp > y + minSlice && bp <= idealEnd + 1) {
        cut = bp;
        break;
      }
    }

    // Khối quá cao (> 1 trang): cắt cứng theo chiều trang
    if (cut - y < minSlice) {
      cut = idealEnd;
    }

    slices.push({ start: y, end: cut });
    y = cut;
  }

  return slices;
}

function sliceCanvas(
  source: HTMLCanvasElement,
  start: number,
  end: number,
): HTMLCanvasElement {
  const height = Math.max(1, Math.ceil(end - start));
  const page = document.createElement('canvas');
  page.width = source.width;
  page.height = height;
  const ctx = page.getContext('2d');
  if (!ctx) return page;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, page.width, page.height);
  ctx.drawImage(
    source,
    0,
    start,
    source.width,
    height,
    0,
    0,
    source.width,
    height,
  );
  return page;
}

/** Chụp phần tử xem trước CV (khổ A4) và tải PDF — ngắt trang theo khối nội dung. */
export async function downloadElementAsPdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pxPerMm = canvas.width / pageWidth;
  const pageHeightPx = pageHeight * pxPerMm;
  const scaleY = canvas.height / Math.max(1, element.scrollHeight);
  const breakPoints = collectBreakPoints(element, scaleY);
  const slices = buildPageSlices(canvas.height, pageHeightPx, breakPoints);

  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage();
    const pageCanvas = sliceCanvas(canvas, slice.start, slice.end);
    const imgData = pageCanvas.toDataURL('image/png', 1.0);
    const sliceHeightMm = (pageCanvas.height * pageWidth) / pageCanvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidth, sliceHeightMm, undefined, 'FAST');
  });

  const safeName = fileName.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim() || 'CV';
  pdf.save(`${safeName}.pdf`);
}
