'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { Button, Card, Field, Input } from '@/components/ui';
import { ApiError } from '@/lib/api';
import {
  createCmsCategory,
  deleteCmsCategory,
  listCmsCategories,
  updateCmsCategory,
} from '@/lib/admin-cms';

export default function AdminCategoriesPage() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin-cms-categories'],
    queryFn: listCmsCategories,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setSeoTitle('');
    setSeoDescription('');
    setError(null);
  }

  function startEdit(id: string) {
    const row = data.find((c) => c.id === id);
    if (!row) return;
    setEditingId(id);
    setName(row.name);
    setSlug(row.slug);
    setDescription(row.description ?? '');
    setSeoTitle(row.seoTitle ?? '');
    setSeoDescription(row.seoDescription ?? '');
    setError(null);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name,
        slug: slug || undefined,
        description: description || null,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
      };
      if (editingId) return updateCmsCategory(editingId, body);
      return createCmsCategory(body);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-categories'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
      resetForm();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Lưu thất bại');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCmsCategory,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin-cms-categories'] });
      await qc.invalidateQueries({ queryKey: ['admin-cms-overview'] });
    },
  });

  return (
    <AdminShell>
      <h1 className="cms-page-title">Danh mục</h1>
      <p className="cms-page-subtitle">Phân loại bài viết cẩm nang + meta SEO danh mục.</p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">
            {editingId ? 'Sửa danh mục' : 'Thêm danh mục'}
          </h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <Field label="Tên">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Slug (để trống = tự sinh)">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
            </Field>
            <Field label="Mô tả">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="SEO title">
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </Field>
            <Field label="SEO description">
              <Input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
            </Field>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Đang lưu...' : 'Lưu'}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Huỷ
                </Button>
              )}
            </div>
          </form>
        </Card>

        <Card>
          <h2 className="text-sm font-bold text-slate-900">Danh sách</h2>
          {isLoading ? (
            <p className="mt-3 text-sm text-slate-500">Đang tải...</p>
          ) : data.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Chưa có danh mục.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {data.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-400">/{c.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-600"
                      onClick={() => startEdit(c.id)}
                    >
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-600"
                      onClick={() => {
                        if (confirm(`Xoá danh mục “${c.name}”?`)) deleteMutation.mutate(c.id);
                      }}
                    >
                      Xoá
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
