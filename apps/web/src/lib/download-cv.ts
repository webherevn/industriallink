import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Chờ toàn bộ font và ảnh trong phần tử CV tải xong trước khi chụp PDF. */
async function waitForAssets(element: HTMLElement): Promise<void> {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore font readiness errors
    }
  }
  const imgs = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          window.setTimeout(done, 2500);
        }),
    ),
  );
}

/** Điểm cắt ưu tiên (theo Y trên canvas) — đầu mỗi khối nội dung [data-cv-block]. */
function collectBreakPoints(element: HTMLElement, scaleY: number): number[] {
  const rootTop = element.getBoundingClientRect().top + window.scrollY;
  const points = new Set<number>([0]);
  element.querySelectorAll<HTMLElement>('[data-cv-block]').forEach((block) => {
    const top =
      block.getBoundingClientRect().top + window.scrollY - rootTop + element.scrollTop;
    if (top > 2) points.add(Math.round(top * scaleY));
  });
  return [...points].sort((a, b) => a - b);
}

/**
 * Chia trang tại ranh giới khối nội dung — tránh cắt giữa dòng chữ.
 * Trang 1 dùng full chiều cao (chừa lề đáy nhỏ), trang 2+ chừa lề trên & dưới thoáng.
 */
function buildPageSlices(
  totalHeight: number,
  firstPageCapacityPx: number,
  nextPageCapacityPx: number,
  breakPoints: number[],
): { start: number; end: number }[] {
  const slices: { start: number; end: number }[] = [];
  let y = 0;

  while (y < totalHeight - 2) {
    const capacity = slices.length === 0 ? firstPageCapacityPx : nextPageCapacityPx;
    const minSlice = Math.max(60, capacity * 0.28);
    const idealEnd = Math.min(y + capacity, totalHeight);

    if (idealEnd >= totalHeight - 2) {
      slices.push({ start: y, end: totalHeight });
      break;
    }

    let cut = idealEnd;
    for (let i = breakPoints.length - 1; i >= 0; i -= 1) {
      const bp = breakPoints[i];
      if (bp > y + minSlice && bp <= idealEnd + 1) {
        cut = bp;
        break;
      }
    }

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

function detectSidebarStrip(
  element: HTMLElement,
): { widthRatio: number; color: string } | null {
  const sidebar = element.querySelector<HTMLElement>('[data-cv-sidebar]');
  if (!sidebar) return null;
  const rootWidth = element.getBoundingClientRect().width;
  const sideWidth = sidebar.getBoundingClientRect().width;
  if (rootWidth <= 0 || sideWidth <= 0) return null;
  const color = sidebar.dataset.cvSidebarBg || sidebar.style.backgroundColor || '';
  if (!color) return null;
  return { widthRatio: sideWidth / rootWidth, color };
}

/** Chụp phần tử xem trước CV (khổ A4) và tải PDF — không cắt chữ, có lề trang 2+ & giữ nền sidebar. */
export async function downloadElementAsPdf(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  await waitForAssets(element);

  const sidebar = detectSidebarStrip(element);
  const canvas = await html2canvas(element, {
    scale: 2.2,
    useCORS: true,
    allowTaint: false,
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

  const firstBottomMarginMm = 6;
  const nextTopMarginMm = 10;
  const nextBottomMarginMm = 8;

  const firstCapacityPx = (pageHeight - firstBottomMarginMm) * pxPerMm;
  const nextCapacityPx = (pageHeight - nextTopMarginMm - nextBottomMarginMm) * pxPerMm;

  const scaleY = canvas.height / Math.max(1, element.scrollHeight);
  const breakPoints = collectBreakPoints(element, scaleY);
  const fullFirstPagePx = pageHeight * pxPerMm;
  const slices =
    canvas.height <= fullFirstPagePx + 4
      ? [{ start: 0, end: canvas.height }]
      : buildPageSlices(canvas.height, firstCapacityPx, nextCapacityPx, breakPoints);

  slices.forEach((slice, index) => {
    if (index > 0) pdf.addPage();

    // Kéo dài dải màu sidebar xuống hết chiều cao tờ A4 trên từng trang
    if (sidebar) {
      pdf.setFillColor(sidebar.color);
      pdf.rect(0, 0, pageWidth * sidebar.widthRatio, pageHeight, 'F');
    }

    const pageCanvas = sliceCanvas(canvas, slice.start, slice.end);
    const imgData = pageCanvas.toDataURL('image/png', 1.0);
    const sliceHeightMm = (pageCanvas.height * pageWidth) / pageCanvas.width;
    const topOffsetMm = index === 0 ? 0 : nextTopMarginMm;

    pdf.addImage(imgData, 'PNG', 0, topOffsetMm, pageWidth, sliceHeightMm, undefined, 'FAST');
  });

  const safeName = fileName.replace(/[^\p{L}\p{N}\-_ ]+/gu, '').trim() || 'CV';
  pdf.save(`${safeName}.pdf`);
}
