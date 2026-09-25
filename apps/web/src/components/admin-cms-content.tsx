'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CmsContentStatus,
  CmsContentType,
  cmsAuthorPublicPath,
  cmsContentPublicPath,
  toSeoSlug,
  type CmsFaqItem,
} from '@industriallink/contracts';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GripVertical,
  ImageIcon,
  Save,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { CmsRichEditor } from '@/components/cms-rich-editor';
import { CmsSeoPanel } from '@/components/cms-seo-panel';
import { Button, Card, Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  createCmsPost,
  deleteCmsPost,
  getCmsAuthorProfile,
  getCmsPostAdmin,
  listCmsCategories,
  listCmsPostsAdmin,
  setCmsPostStatus,
  updateCmsPost,
  uploadCmsMedia,
} from '@/lib/admin-cms';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';
import {
  CMS_METABOX_LABELS,
  DEFAULT_CMS_METABOX_LAYOUT,
  loadCmsMetaboxLayout,
  moveCmsMetabox,
  saveCmsMetaboxLayout,
  type CmsMetaboxColumn,
  type CmsMetaboxId,
  type CmsMetaboxLayout,
} from '@/lib/cms-metabox-layout';

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Metabox WP-style: kéo tay nắm ⋮⋮ để đổi cột / thứ tự. */
function SortableMetabox({
  id,
  title,
  defaultOpen = true,
  dragging,
  dropTarget,
  onDragStartBox,
  onDragOverBox,
  onDropOnBox,
  onDragEndBox,
  children,
}: {
  id: CmsMetaboxId;
  title: string;
  defaultOpen?: boolean;
  dragging: boolean;
  dropTarget: boolean;
  onDragStartBox: (id: CmsMetaboxId) => void;
  onDragOverBox: (id: CmsMetaboxId) => void;
  onDropOnBox: (id: CmsMetaboxId) => void;
  onDragEndBox: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      data-metabox-id={id}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverBox(id);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropOnBox(id);
      }}
      className={`cms-panel transition ${
        dropTarget ? 'border-brand-400 ring-2 ring-brand-100' : ''
      } ${dragging ? 'opacity-50' : ''}`}
    >
      <div className="cms-panel-head">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/metabox-id', id);
            e.dataTransfer.setData('text/plain', id);
            onDragStartBox(id);
          }}
          onDragEnd={onDragEndBox}
          className="inline-flex shrink-0 cursor-grab items-center rounded-md p-1.5 text-slate-400 hover:bg-slate-200/80 hover:text-brand-600 active:cursor-grabbing"
          title="Kéo để đổi vị trí metabox (cột trái/phải)"
          aria-label={`Kéo metabox ${title}`}
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[13px] font-semibold text-slate-800 hover:bg-slate-200/50"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <span className="truncate">{title}</span>
        </button>
      </div>
      {open && <div className="cms-panel-body space-y-3">{children}</div>}
    </div>
  );
}

function ContentEditor({
  type,
  editId,
}: {
  type: CmsContentType;
  editId?: string;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const isPage = type === CmsContentType.Page;
  const listPath = isPage ? '/admin/pages' : '/admin/posts';
  const typeLabel = isPage ? 'trang' : 'bài viết';

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-cms-categories'],
    queryFn: listCmsCategories,
    enabled: !isPage,
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['admin-cms-post', editId],
    queryFn: () => getCmsPostAdmin(editId!),
    enabled: Boolean(editId),
  });

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugEditing, setSlugEditing] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [focusKeyword, setFocusKeyword] = useState('');
  const [publishedAtLocal, setPublishedAtLocal] = useState('');
  const [canonicalPath, setCanonicalPath] = useState('');
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [robotsMaxImagePreview, setRobotsMaxImagePreview] = useState(true);
  const [faq, setFaq] = useState<CmsFaqItem[]>([]);
  const [faqDragFrom, setFaqDragFrom] = useState<number | null>(null);
  const [faqDragOver, setFaqDragOver] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [boxLayout, setBoxLayout] = useState<CmsMetaboxLayout>(DEFAULT_CMS_METABOX_LAYOUT);
  const [draggingBox, setDraggingBox] = useState<CmsMetaboxId | null>(null);
  const [dropOverBox, setDropOverBox] = useState<CmsMetaboxId | null>(null);
  const [dropOverColumn, setDropOverColumn] = useState<CmsMetaboxColumn | null>(null);

  useEffect(() => {
    setBoxLayout(loadCmsMetaboxLayout());
  }, []);

  function applyBoxLayout(next: CmsMetaboxLayout) {
    setBoxLayout(next);
    saveCmsMetaboxLayout(next);
  }

  function finishBoxDrag() {
    setDraggingBox(null);
    setDropOverBox(null);
    setDropOverColumn(null);
  }

  function dropBoxOnTarget(targetId: CmsMetaboxId) {
    if (!draggingBox || draggingBox === targetId) {
      finishBoxDrag();
      return;
    }
    const inMain = boxLayout.main.indexOf(targetId);
    const col: CmsMetaboxColumn = inMain >= 0 ? 'main' : 'side';
    const idx = inMain >= 0 ? inMain : boxLayout.side.indexOf(targetId);
    if (idx < 0) {
      finishBoxDrag();
      return;
    }
    applyBoxLayout(moveCmsMetabox(boxLayout, draggingBox, col, idx));
    finishBoxDrag();
  }

  function dropBoxOnColumnEnd(col: CmsMetaboxColumn) {
    if (!draggingBox) {
      finishBoxDrag();
      return;
    }
    applyBoxLayout(moveCmsMetabox(boxLayout, draggingBox, col, boxLayout[col].length));
    finishBoxDrag();
  }

  const { data: myAuthor } = useQuery({
    queryKey: ['admin-cms-author-profile'],
    queryFn: getCmsAuthorProfile,
  });

  useEffect(() => {
    if (!existing) return;
    setTitle(existing.title);
    setSlug(existing.slug);
    setSlugTouched(true);
    setExcerpt(existing.excerpt ?? '');
    setBodyHtml(existing.bodyHtml);
    setCoverImageUrl(existing.coverImageUrl ?? '');
    setCategoryId(existing.categoryId ?? '');
    setSeoTitle(existing.seoTitle ?? '');
    setSeoDescription(existing.seoDescription ?? '');
    setFocusKeyword(existing.focusKeyword ?? '');
    setPublishedAtLocal(toDatetimeLocalValue(existing.publishedAt));
    setCanonicalPath(existing.canonicalPath ?? '');
    setOgTitle(existing.ogTitle ?? '');
    setOgDescription(existing.ogDescription ?? '');
    setOgImageUrl(existing.ogImageUrl ?? '');
    setRobotsIndex(existing.robotsIndex);
    setRobotsFollow(existing.robotsFollow);
    setRobotsMaxImagePreview(existing.robotsMaxImagePreview);
    setFaq(existing.faq ?? []);
  }, [existing]);

  useEffect(() => {
    if (slugTouched || editId) return;
    setSlug(toSeoSlug(title));
  }, [title, slugTouched, editId]);

  const publicPath = useMemo(
    () => cmsContentPublicPath(type, slug || 'slug'),
    [type, slug],
  );

  const status = existing?.status ?? CmsContentStatus.Draft;
  const isPublished = status === CmsContentStatus.Published;

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      const body = {
        type,
        title,
        slug: slug || undefined,
        excerpt: excerpt || null,
        bodyHtml,
        coverImageUrl: coverImageUrl || null,
        categoryId: isPage ? null : categoryId || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        focusKeyword: focusKeyword || null,
        publishedAt: fromDatetimeLocalValue(publishedAtLocal),
        canonicalPath: canonicalPath || null,
        ogTitle: ogTitle || null,
        ogDescription: ogDescription || null,
        ogImageUrl: ogImageUrl || null,
        robotsIndex,
        robotsFollow,
        robotsMaxImagePreview,
        faq,
        publish,
      };
      if (editId) return updateCmsPost(editId, body);
      return createCmsPost(body);
    },
    onSuccess: async (saved) => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-post', saved.id] });
      setError(null);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2500);
      if (!editId) router.replace(`${listPath}/${saved.id}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  const statusMutation = useMutation({
    mutationFn: (next: CmsContentStatus) => setCmsPostStatus(editId!, next),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-post', editId] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCmsPost(editId!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
      router.push(listPath);
    },
  });

  async function uploadCover(file: File) {
    setCoverUploading(true);
    setError(null);
    try {
      const res = await uploadCmsMedia(file);
      setCoverImageUrl(res.url);
      if (!ogImageUrl) setOgImageUrl(res.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload ảnh đại diện thất bại');
    } finally {
      setCoverUploading(false);
    }
  }

  if (editId && loadingExisting) {
    return (
      <AdminShell>
        <p className="text-sm text-slate-500">Đang tải {typeLabel}…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      {/* Top bar editor */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {editId ? `Sửa ${typeLabel}` : `Thêm ${typeLabel} mới`}
          </p>
          <h1 className="cms-page-title mt-0.5 truncate">
            {title.trim() || (isPage ? 'Trang không tiêu đề' : 'Bài viết không tiêu đề')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {savedFlash && (
            <span className="cms-status-pill cms-status-pill--ok">Đã lưu</span>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            onClick={() => {
              applyBoxLayout({
                main: [...DEFAULT_CMS_METABOX_LAYOUT.main],
                side: [...DEFAULT_CMS_METABOX_LAYOUT.side],
              });
            }}
            title="Khôi phục bố cục metabox mặc định"
          >
            Reset bố cục
          </button>
          <Link
            href={listPath}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            ← Tất cả {isPage ? 'trang' : 'bài viết'}
          </Link>
        </div>
      </div>

      <p className="cms-muted-hint mt-2">
        Kéo ⋮⋮ trên tiêu đề metabox để đổi vị trí trên/dưới hoặc chuyển cột trái ↔ phải.
        Thứ tự được nhớ trên trình duyệt này.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-5">
        {/* Cột chính */}
        <div
          className={`min-w-0 space-y-4 rounded-xl p-0.5 transition ${
            dropOverColumn === 'main' && !dropOverBox ? 'bg-brand-50/50 ring-2 ring-dashed ring-brand-200' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropOverColumn('main');
          }}
          onDragLeave={() => {
            if (dropOverColumn === 'main') setDropOverColumn(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropBoxOnColumnEnd('main');
          }}
        >
          {/* Title + Permalink — cố định */}
          <div className="cms-panel p-4 sm:p-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề tại đây"
              className="w-full border-0 bg-transparent text-2xl font-bold tracking-tight text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300 sm:text-[1.75rem]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">Permalink:</span>
              {!slugEditing ? (
                <>
                  <a
                    href={publicPath}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {publicPath}
                  </a>
                  <button
                    type="button"
                    className="font-semibold text-slate-700 underline-offset-2 hover:underline"
                    onClick={() => setSlugEditing(true)}
                  >
                    Sửa
                  </button>
                  {existing && isPublished && (
                    <a
                      href={cmsContentPublicPath(type, existing.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-slate-700 hover:underline"
                    >
                      Xem <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </>
              ) : (
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <span className="text-slate-400">{isPage ? '/trang/' : '/cam-nang/'}</span>
                  <input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(e.target.value);
                    }}
                    className="min-w-[160px] flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                  <button
                    type="button"
                    className="rounded bg-slate-800 px-2.5 py-1 text-xs font-semibold text-white"
                    onClick={() => setSlugEditing(false)}
                  >
                    OK
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-slate-500"
                    onClick={() => {
                      if (existing) setSlug(existing.slug);
                      else setSlug(toSeoSlug(title));
                      setSlugEditing(false);
                    }}
                  >
                    Huỷ
                  </button>
                </div>
              )}
            </div>
          </div>

          <CmsRichEditor value={bodyHtml} onChange={setBodyHtml} />

          {boxLayout.main
            .filter((id) => !(isPage && id === 'categories'))
            .map((id) => renderSortableBox(id))}

          {boxLayout.main.filter((id) => !(isPage && id === 'categories')).length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-xs text-slate-400">
              Thả metabox vào cột chính
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside
          className={`space-y-4 rounded-xl p-0.5 lg:sticky lg:top-4 lg:self-start transition ${
            dropOverColumn === 'side' && !dropOverBox ? 'bg-brand-50/50 ring-2 ring-dashed ring-brand-200' : ''
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDropOverColumn('side');
          }}
          onDragLeave={() => {
            if (dropOverColumn === 'side') setDropOverColumn(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropBoxOnColumnEnd('side');
          }}
        >
          {boxLayout.side
            .filter((id) => !(isPage && id === 'categories'))
            .map((id) => renderSortableBox(id))}

          {boxLayout.side.filter((id) => !(isPage && id === 'categories')).length === 0 && (
            <div className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-xs text-slate-400">
              Thả metabox vào cột phải
            </div>
          )}
        </aside>
      </div>
    </AdminShell>
  );

  function renderSortableBox(id: CmsMetaboxId) {
    const common = {
      id,
      title: CMS_METABOX_LABELS[id],
      dragging: draggingBox === id,
      dropTarget: dropOverBox === id,
      onDragStartBox: (boxId: CmsMetaboxId) => setDraggingBox(boxId),
      onDragOverBox: (boxId: CmsMetaboxId) => setDropOverBox(boxId),
      onDropOnBox: dropBoxOnTarget,
      onDragEndBox: finishBoxDrag,
    };

    if (id === 'excerpt') {
      return (
        <SortableMetabox key={id} {...common} defaultOpen={Boolean(excerpt)}>
          <p className="text-xs text-slate-500">
            Tóm tắt ngắn hiển thị ở danh sách / meta. Để trống nếu không cần.
          </p>
          <textarea
            className="cms-field-control min-h-[88px]"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Viết tóm tắt…"
          />
        </SortableMetabox>
      );
    }

    if (id === 'faq') {
      return (
        <SortableMetabox key={id} {...common} defaultOpen={faq.length > 0}>
          <p className="text-xs text-slate-500">
            Kéo ⋮⋮ trong từng FAQ để sắp xếp cặp hỏi–đáp. Xuất JSON-LD FAQPage.
          </p>
          {faq.map((item, idx) => (
            <div
              key={idx}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'move';
                if (faqDragOver !== idx) setFaqDragOver(idx);
              }}
              onDragLeave={() => {
                if (faqDragOver === idx) setFaqDragOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const from = faqDragFrom ?? Number(e.dataTransfer.getData('text/plain'));
                const to = idx;
                setFaqDragFrom(null);
                setFaqDragOver(null);
                if (Number.isNaN(from) || from === to) return;
                setFaq((prev) => {
                  const next = [...prev];
                  const [moved] = next.splice(from, 1);
                  if (!moved) return prev;
                  next.splice(to, 0, moved);
                  return next;
                });
              }}
              className={`space-y-2 rounded border bg-slate-50/50 p-3 transition ${
                faqDragOver === idx ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200'
              } ${faqDragFrom === idx ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    setFaqDragFrom(idx);
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(idx));
                  }}
                  onDragEnd={() => {
                    setFaqDragFrom(null);
                    setFaqDragOver(null);
                  }}
                  className="inline-flex cursor-grab items-center rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 active:cursor-grabbing"
                  title="Kéo để sắp xếp FAQ"
                >
                  <GripVertical className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  FAQ #{idx + 1}
                </span>
                <button
                  type="button"
                  className="ml-auto text-xs font-semibold text-rose-600"
                  onClick={() => setFaq(faq.filter((_, i) => i !== idx))}
                >
                  Xoá
                </button>
              </div>
              <Input
                placeholder="Câu hỏi"
                value={item.question}
                onChange={(e) => {
                  const next = [...faq];
                  next[idx] = { ...next[idx]!, question: e.target.value };
                  setFaq(next);
                }}
              />
              <textarea
                className="cms-field-control min-h-[64px]"
                placeholder="Câu trả lời"
                value={item.answer}
                onChange={(e) => {
                  const next = [...faq];
                  next[idx] = { ...next[idx]!, answer: e.target.value };
                  setFaq(next);
                }}
              />
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => setFaq([...faq, { question: '', answer: '' }])}
          >
            + Thêm FAQ
          </Button>
        </SortableMetabox>
      );
    }

    if (id === 'seo') {
      return (
        <SortableMetabox key={id} {...common} defaultOpen>
          <CmsSeoPanel
            title={title}
            slug={slug}
            publicPath={publicPath}
            bodyHtml={bodyHtml}
            excerpt={excerpt}
            seoTitle={seoTitle}
            seoDescription={seoDescription}
            focusKeyword={focusKeyword}
            coverImageUrl={coverImageUrl}
            ogTitle={ogTitle}
            ogDescription={ogDescription}
            ogImageUrl={ogImageUrl}
            robotsIndex={robotsIndex}
            onFocusKeywordChange={setFocusKeyword}
            onSeoTitleChange={setSeoTitle}
            onSeoDescriptionChange={setSeoDescription}
          />
          <Field label="Canonical URL">
            <Input
              value={canonicalPath}
              onChange={(e) => setCanonicalPath(e.target.value)}
              placeholder="Để trống = URL hiện tại"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Index">
              <Select
                value={robotsIndex ? 'index' : 'noindex'}
                onChange={(e) => setRobotsIndex(e.target.value === 'index')}
              >
                <option value="index">Index</option>
                <option value="noindex">Noindex</option>
              </Select>
            </Field>
            <Field label="Follow">
              <Select
                value={robotsFollow ? 'follow' : 'nofollow'}
                onChange={(e) => setRobotsFollow(e.target.value === 'follow')}
              >
                <option value="follow">Follow</option>
                <option value="nofollow">Nofollow</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={robotsMaxImagePreview}
              onChange={(e) => setRobotsMaxImagePreview(e.target.checked)}
            />
            max-image-preview:large (Google Discover)
          </label>
        </SortableMetabox>
      );
    }

    if (id === 'og') {
      return (
        <SortableMetabox key={id} {...common} defaultOpen={false}>
          <Field label="OG Title">
            <Input
              value={ogTitle}
              onChange={(e) => setOgTitle(e.target.value)}
              placeholder="Để trống = SEO Title / H1"
            />
          </Field>
          <Field label="OG Description">
            <Input
              value={ogDescription}
              onChange={(e) => setOgDescription(e.target.value)}
              placeholder="Để trống = SEO Description"
            />
          </Field>
          <Field label="OG Image (1200×630)">
            <div className="space-y-2">
              {ogImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveCmsAssetUrl(ogImageUrl) || ogImageUrl}
                  alt="OG"
                  className="max-h-32 w-full rounded border border-slate-200 object-cover"
                />
              )}
              <Input
                value={ogImageUrl}
                onChange={(e) => setOgImageUrl(e.target.value)}
                placeholder="Để trống = ảnh đại diện"
              />
              <label className="inline-flex cursor-pointer text-xs font-semibold text-brand-600">
                Tải ảnh OG
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const res = await uploadCmsMedia(file);
                      setOgImageUrl(res.url);
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : 'Upload OG thất bại');
                    }
                  }}
                />
              </label>
            </div>
          </Field>
        </SortableMetabox>
      );
    }

    if (id === 'publish') {
      return (
        <SortableMetabox key={id} {...common}>
          <div className="space-y-2 text-sm text-slate-600">
            <p>
              <span className="text-slate-400">Trạng thái:</span>{' '}
              <span
                className={
                  isPublished
                    ? 'rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-bold text-emerald-700'
                    : 'rounded bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-700'
                }
              >
                {isPublished ? 'Đã xuất bản' : 'Bản nháp'}
              </span>
            </p>
            {existing?.updatedAt && (
              <p className="text-xs text-slate-400">
                Sửa lần cuối: {new Date(existing.updatedAt).toLocaleString('vi-VN')}
              </p>
            )}
            {existing?.publishedAt && (
              <p className="text-xs text-slate-400">
                Xuất bản: {new Date(existing.publishedAt).toLocaleString('vi-VN')}
              </p>
            )}
          </div>
          <Field label="Ngày đăng">
            <input
              type="datetime-local"
              className="cms-field-control"
              value={publishedAtLocal}
              onChange={(e) => setPublishedAtLocal(e.target.value)}
            />
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                className="font-semibold text-brand-600 hover:underline"
                onClick={() => setPublishedAtLocal(toDatetimeLocalValue(new Date().toISOString()))}
              >
                Đặt = hiện tại
              </button>
              {publishedAtLocal && (
                <button
                  type="button"
                  className="font-semibold text-slate-500 hover:underline"
                  onClick={() => setPublishedAtLocal('')}
                >
                  Xoá ngày
                </button>
              )}
            </div>
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={saveMutation.isPending || !title.trim()}
              onClick={() => saveMutation.mutate(false)}
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? 'Đang lưu…' : 'Lưu nháp'}
              </span>
            </Button>
            {existing && isPublished && (
              <a
                href={cmsContentPublicPath(type, existing.slug)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Xem trước
              </a>
            )}
          </div>
          <Button
            className="w-full"
            disabled={saveMutation.isPending || !title.trim()}
            onClick={() => saveMutation.mutate(true)}
          >
            {isPublished ? 'Cập nhật' : 'Xuất bản'}
          </Button>
          {editId && isPublished && (
            <button
              type="button"
              className="w-full text-center text-xs font-semibold text-amber-700 hover:underline"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(CmsContentStatus.Draft)}
            >
              Chuyển về bản nháp
            </button>
          )}
          {editId && (
            <button
              type="button"
              className="w-full text-center text-xs font-semibold text-rose-600 hover:underline"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm(`Chuyển “${title}” vào thùng rác (xoá vĩnh viễn)?`)) {
                  deleteMutation.mutate();
                }
              }}
            >
              Chuyển vào thùng rác
            </button>
          )}
        </SortableMetabox>
      );
    }

    if (id === 'cover') {
      return (
        <SortableMetabox key={id} {...common}>
          {coverImageUrl ? (
            <div className="overflow-hidden rounded border border-slate-200 bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveCmsAssetUrl(coverImageUrl) || coverImageUrl}
                alt="Ảnh đại diện"
                className="max-h-44 w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center">
              <ImageIcon className="h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs text-slate-400">Chưa đặt ảnh đại diện</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex flex-1 cursor-pointer items-center justify-center rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              {coverUploading ? 'Đang tải…' : coverImageUrl ? 'Thay ảnh' : 'Đặt ảnh đại diện'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={coverUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void uploadCover(file);
                }}
              />
            </label>
            {coverImageUrl && (
              <button
                type="button"
                className="text-xs font-semibold text-rose-600"
                onClick={() => setCoverImageUrl('')}
              >
                Xoá
              </button>
            )}
          </div>
          <Input
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="Hoặc dán URL…"
          />
        </SortableMetabox>
      );
    }

    if (id === 'categories') {
      return (
        <SortableMetabox key={id} {...common}>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">— Không chọn —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Link href="/admin/categories" className="text-xs font-semibold text-brand-600 hover:underline">
            + Quản lý danh mục
          </Link>
        </SortableMetabox>
      );
    }

    if (id === 'author') {
      const name =
        existing?.authorName || myAuthor?.displayName || 'Tài khoản đang đăng nhập';
      const title = existing?.authorTitle || myAuthor?.title || '';
      const bio = existing?.authorBio || myAuthor?.bio || '';
      const avatar =
        resolveCmsAssetUrl(existing?.authorAvatarUrl || myAuthor?.avatarUrl || '') ||
        existing?.authorAvatarUrl ||
        myAuthor?.avatarUrl ||
        '';
      const publicSlug =
        existing?.authorSlug ||
        (myAuthor?.isPublic && myAuthor?.slug ? myAuthor.slug : null);
      const publicHref = publicSlug ? cmsAuthorPublicPath(publicSlug) : null;
      return (
        <SortableMetabox key={id} {...common} defaultOpen>
          <div className="flex gap-3">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-600">
                {name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              {publicHref ? (
                <Link
                  href={publicHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-brand-700 hover:text-accent-600 hover:underline"
                >
                  {name}
                </Link>
              ) : (
                <p className="text-sm font-semibold text-slate-900">{name}</p>
              )}
              {title ? <p className="text-xs text-slate-500">{title}</p> : null}
              {bio ? (
                <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-500">{bio}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-400">
                  {editId
                    ? 'Tác giả = tài khoản đã đăng bài.'
                    : 'Khi lưu, tác giả sẽ là tài khoản đang đăng nhập.'}
                </p>
              )}
              {publicHref ? (
                <p className="mt-1 truncate text-[11px] text-slate-400">{publicHref}</p>
              ) : null}
            </div>
          </div>
          <Link
            href="/admin/author"
            className="mt-1 inline-flex text-xs font-semibold text-brand-600 hover:underline"
          >
            Chỉnh sửa hồ sơ tác giả →
          </Link>
        </SortableMetabox>
      );
    }

    return null;
  }
}
function ContentList({ type }: { type: CmsContentType }) {
  const qc = useQueryClient();
  const isPage = type === CmsContentType.Page;
  const base = isPage ? '/admin/pages' : '/admin/posts';

  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-cms-posts', type],
    queryFn: () => listCmsPostsAdmin({ type }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CmsContentStatus }) =>
      setCmsPostStatus(id, status),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCmsPost,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-posts'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
    },
  });

  return (
    <AdminShell>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="cms-page-title">{isPage ? 'Trang' : 'Bài viết'}</h1>
          <p className="cms-page-subtitle">
            {isPage ? 'Trang tĩnh (/trang/slug)' : 'Cẩm nang (/cam-nang/slug)'} · soạn thảo Classic Editor
          </p>
        </div>
        <Link href={`${base}/new`}>
          <Button>Thêm mới</Button>
        </Link>
      </div>

      <Card className="mt-5 overflow-x-auto !rounded-xl !p-4 sm:!p-5">
        {isLoading ? (
          <p className="text-sm text-slate-500">Đang tải...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có nội dung.</p>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2.5 font-semibold">Tiêu đề</th>
                <th className="pb-2.5 font-semibold">Slug</th>
                <th className="pb-2.5 font-semibold">Trạng thái</th>
                <th className="pb-2.5 font-semibold">Index</th>
                <th className="pb-2.5 font-semibold">Cập nhật</th>
                <th className="pb-2.5 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50/80">
                  <td className="py-3 pr-3">
                    <div className="flex gap-3">
                      {row.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveCmsAssetUrl(row.coverImageUrl) || row.coverImageUrl}
                          alt=""
                          className="h-12 w-16 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-300">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link
                          href={`${base}/${row.id}`}
                          className="font-semibold text-slate-900 hover:text-brand-600"
                        >
                          {row.title}
                        </Link>
                        {row.categoryName && (
                          <p className="mt-0.5 text-[11px] text-slate-400">{row.categoryName}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-slate-500">{row.slug}</td>
                  <td className="py-3 pr-3">
                    <span
                      className={
                        row.status === CmsContentStatus.Published
                          ? 'cms-status-pill cms-status-pill--ok'
                          : 'cms-status-pill cms-status-pill--warn'
                      }
                    >
                      {row.status === CmsContentStatus.Published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-500">
                    {row.robotsIndex ? 'index' : 'noindex'}
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-400">
                    {new Date(row.updatedAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex justify-end gap-2.5">
                      <Link href={`${base}/${row.id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                        Sửa
                      </Link>
                      {row.status !== CmsContentStatus.Published ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-600 hover:underline"
                          onClick={() =>
                            statusMutation.mutate({
                              id: row.id,
                              status: CmsContentStatus.Published,
                            })
                          }
                        >
                          Publish
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-semibold text-amber-600 hover:underline"
                          onClick={() =>
                            statusMutation.mutate({ id: row.id, status: CmsContentStatus.Draft })
                          }
                        >
                          Unpublish
                        </button>
                      )}
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:underline"
                        onClick={() => {
                          if (confirm(`Xoá “${row.title}”?`)) deleteMutation.mutate(row.id);
                        }}
                      >
                        Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </AdminShell>
  );
}

export function AdminPostsListPage() {
  return <ContentList type={CmsContentType.Post} />;
}

export function AdminPagesListPage() {
  return <ContentList type={CmsContentType.Page} />;
}

export function AdminPostEditorPage({ editId }: { editId?: string }) {
  return <ContentEditor type={CmsContentType.Post} editId={editId} />;
}

export function AdminPageEditorPage({ editId }: { editId?: string }) {
  return <ContentEditor type={CmsContentType.Page} editId={editId} />;
}
