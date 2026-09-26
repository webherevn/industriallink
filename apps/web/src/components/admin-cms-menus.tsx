'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  CmsContentStatus,
  CmsContentType,
  CmsMenuLocation,
  cmsContentPublicPath,
  type CmsMenuItemView,
  type UpsertCmsMenuItemInput,
} from '@industriallink/contracts';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Field, Input, Select } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  getCmsMenuAdmin,
  listCmsPostsAdmin,
  saveCmsMenuAdmin,
} from '@/lib/admin-cms';

type DraftItem = UpsertCmsMenuItemInput & { id: string };

function newId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function flattenTree(items: CmsMenuItemView[], parentId: string | null = null): DraftItem[] {
  const out: DraftItem[] = [];
  for (const item of items) {
    out.push({
      id: item.id,
      parentId,
      label: item.label,
      url: item.url,
      sortOrder: item.sortOrder,
      openInNewTab: item.openInNewTab,
      objectType: item.objectType,
      objectId: item.objectId,
    });
    if (item.children?.length) {
      out.push(...flattenTree(item.children, item.id));
    }
  }
  return out;
}

function nestDraft(items: DraftItem[]): DraftItem[] {
  // Giữ flat; UI chỉ hỗ trợ 1 cấp con (parentId trỏ root)
  return items;
}

export function AdminMenusPage() {
  const qc = useQueryClient();
  const [location, setLocation] = useState<CmsMenuLocation>(CmsMenuLocation.Primary);
  const [name, setName] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const { data: menu, isLoading } = useQuery({
    queryKey: ['admin-cms-menu', location],
    queryFn: () => getCmsMenuAdmin(location),
  });

  const { data: pages = [] } = useQuery({
    queryKey: ['admin-cms-posts', CmsContentType.Page, 'menu-picker'],
    queryFn: () =>
      listCmsPostsAdmin({ type: CmsContentType.Page, status: CmsContentStatus.Published }),
  });

  const { data: posts = [] } = useQuery({
    queryKey: ['admin-cms-posts', CmsContentType.Post, 'menu-picker'],
    queryFn: () =>
      listCmsPostsAdmin({ type: CmsContentType.Post, status: CmsContentStatus.Published }),
  });

  useEffect(() => {
    if (!menu) return;
    setName(menu.name);
    setItems(nestDraft(flattenTree(menu.items)));
    setError(null);
  }, [menu]);

  const roots = useMemo(() => items.filter((i) => !i.parentId), [items]);
  const childrenOf = (parentId: string) => items.filter((i) => i.parentId === parentId);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveCmsMenuAdmin(location, {
        name: name.trim() || undefined,
        items: items.map((item, idx) => ({
          id: item.id,
          parentId: item.parentId || null,
          label: item.label,
          url: item.url,
          sortOrder: idx,
          openInNewTab: item.openInNewTab,
          objectType: item.objectType || 'custom',
          objectId: item.objectId || null,
        })),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-menu', location] });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Lưu menu thất bại'),
  });

  function addItem(partial: Omit<DraftItem, 'id'> & { id?: string }) {
    setItems((prev) => [
      ...prev,
      {
        id: partial.id || newId(),
        parentId: partial.parentId ?? null,
        label: partial.label,
        url: partial.url,
        sortOrder: prev.length,
        openInNewTab: partial.openInNewTab ?? false,
        objectType: partial.objectType || 'custom',
        objectId: partial.objectId ?? null,
      },
    ]);
  }

  function moveRoot(from: number, to: number) {
    if (from === to) return;
    const rootIds = roots.map((r) => r.id);
    const [moved] = rootIds.splice(from, 1);
    if (!moved) return;
    rootIds.splice(to, 0, moved);
    const nextRoots = rootIds.map((id) => items.find((i) => i.id === id)!);
    const children = items.filter((i) => i.parentId);
    setItems([...nextRoots.map((r) => ({ ...r, parentId: null })), ...children]);
  }

  return (
    <AdminShell>
      <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E8872A]">Cấu hình</p>
          <h1 className="cms-page-title mt-1.5">Menu trang chủ</h1>
          <div className="brand-accent-bar mt-2" />
          <p className="cms-page-subtitle max-w-xl">
            Header và footer của site công khai. Không đụng menu ứng viên hay nhà tuyển dụng.
          </p>
        </div>
        <button
          type="button"
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          className="inline-flex items-center rounded-xl bg-[#072348] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:-translate-y-0.5 hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {saveMutation.isPending ? 'Đang lưu…' : 'Lưu menu'}
        </button>
      </div>

      <div className="admin-dash-card admin-dash-rise mt-6 grid gap-3 p-4 sm:grid-cols-2" style={{ animationDelay: '60ms' }}>
        <Field label="Vị trí hiển thị">
          <Select
            value={location}
            onChange={(e) => setLocation(e.target.value as CmsMenuLocation)}
          >
            <option value={CmsMenuLocation.Primary}>Header (Primary)</option>
            <option value={CmsMenuLocation.Footer}>Footer</option>
          </Select>
        </Field>
        <Field label="Tên menu">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Menu chính" />
        </Field>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Nguồn thêm mục */}
        <div className="space-y-4">
          <div className="admin-dash-card admin-dash-rise space-y-3 p-5">
            <h2 className="text-sm font-semibold text-[#072348]">Liên kết tuỳ chỉnh</h2>
            <Field label="Nhãn">
              <Input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} />
            </Field>
            <Field label="URL">
              <Input
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="/viec-lam hoặc https://…"
              />
            </Field>
            <button
              type="button"
              disabled={!customLabel.trim() || !customUrl.trim()}
              onClick={() => {
                addItem({ label: customLabel.trim(), url: customUrl.trim(), objectType: 'custom' });
                setCustomLabel('');
                setCustomUrl('');
              }}
              className="inline-flex items-center rounded-xl bg-[#072348] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_14px_28px_-16px_rgba(7,35,72,0.85)] transition hover:bg-[#0c3a72] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Thêm vào menu
            </button>
          </div>

          <div className="admin-dash-card admin-dash-rise space-y-2 p-5" style={{ animationDelay: '60ms' }}>
            <h2 className="text-sm font-semibold text-[#072348]">Trang đã xuất bản</h2>
            {pages.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có trang published.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {pages.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700">{p.title}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-[#E8872A]"
                      onClick={() =>
                        addItem({
                          label: p.title,
                          url: cmsContentPublicPath(CmsContentType.Page, p.slug),
                          objectType: 'page',
                          objectId: p.id,
                        })
                      }
                    >
                      + Thêm
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="admin-dash-card admin-dash-rise space-y-2 p-5" style={{ animationDelay: '100ms' }}>
            <h2 className="text-sm font-semibold text-[#072348]">Bài viết đã xuất bản</h2>
            {posts.length === 0 ? (
              <p className="text-xs text-slate-400">Chưa có bài published.</p>
            ) : (
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {posts.slice(0, 30).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-slate-700">{p.title}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-[#E8872A]"
                      onClick={() =>
                        addItem({
                          label: p.title,
                          url: cmsContentPublicPath(CmsContentType.Post, p.slug),
                          objectType: 'post',
                          objectId: p.id,
                        })
                      }
                    >
                      + Thêm
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Cấu trúc menu */}
        <div className="admin-dash-card admin-dash-rise space-y-3 p-5 sm:p-6" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[#072348]">
              Cấu trúc menu —{' '}
              {location === CmsMenuLocation.Primary ? 'Header trang chủ' : 'Footer'}
            </h2>
            <span className="rounded-full bg-[#FFF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#072348] ring-1 ring-[#FFD0A3]">
              {isLoading ? '…' : items.length}
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <div className="admin-dash-skel h-24" />
              <div className="admin-dash-skel h-24" />
            </div>
          ) : roots.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#FFD0A3] bg-[#FFF8F1] px-3 py-8 text-center text-sm text-slate-500">
              Chưa có mục. Thêm liên kết hoặc trang từ cột trái.
            </p>
          ) : (
            <ul className="space-y-2">
              {roots.map((item, rootIdx) => (
                <li key={item.id}>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(rootIdx);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom === null) return;
                      moveRoot(dragFrom, rootIdx);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={clsx(
                      'rounded-2xl border bg-white p-3 shadow-[0_10px_28px_-18px_rgba(7,35,72,0.35)]',
                      dragOver === rootIdx ? 'border-[#E8872A] ring-2 ring-[#FFD0A3]' : 'border-slate-100',
                      dragFrom === rootIdx && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span
                        draggable
                        onDragStart={() => setDragFrom(rootIdx)}
                        onDragEnd={() => {
                          setDragFrom(null);
                          setDragOver(null);
                        }}
                        className="mt-1 cursor-grab text-[#E8872A] active:cursor-grabbing"
                        title="Kéo sắp xếp"
                      >
                        <GripVertical className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-2">
                        <Input
                          value={item.label}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === item.id ? { ...x, label: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <Input
                          value={item.url}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id === item.id ? { ...x, url: e.target.value } : x,
                              ),
                            )
                          }
                        />
                        <label className="flex items-center gap-2 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={Boolean(item.openInNewTab)}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x) =>
                                  x.id === item.id
                                    ? { ...x, openInNewTab: e.target.checked }
                                    : x,
                                ),
                              )
                            }
                          />
                          Mở tab mới
                        </label>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100"
                          disabled={rootIdx === 0}
                          onClick={() => moveRoot(rootIdx, rootIdx - 1)}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-slate-400 hover:bg-slate-100"
                          disabled={rootIdx >= roots.length - 1}
                          onClick={() => moveRoot(rootIdx, rootIdx + 1)}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-rose-500 hover:bg-rose-50"
                          onClick={() =>
                            setItems((prev) =>
                              prev.filter((x) => x.id !== item.id && x.parentId !== item.id),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* submenu 1 cấp */}
                    <div className="mt-3 space-y-2 border-l-2 border-[#FFD0A3] pl-4">
                      {childrenOf(item.id).map((child) => (
                        <div key={child.id} className="flex gap-2 rounded-xl bg-[#FFF8F1] p-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <Input
                              value={child.label}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === child.id ? { ...x, label: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                            <Input
                              value={child.url}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((x) =>
                                    x.id === child.id ? { ...x, url: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="text-rose-500"
                            onClick={() =>
                              setItems((prev) => prev.filter((x) => x.id !== child.id))
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#E8872A]"
                        onClick={() =>
                          addItem({
                            label: 'Mục con',
                            url: '/',
                            parentId: item.id,
                            objectType: 'custom',
                          })
                        }
                      >
                        + Thêm mục con
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] leading-relaxed text-slate-400">
            Sau khi lưu, menu Primary hiện trên header khách. Footer hiện khi gắn chân trang.
          </p>
        </div>
      </div>
    </AdminShell>
  );
}
