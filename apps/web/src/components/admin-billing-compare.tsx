'use client';

import type { BillingCompareRow, BillingCompareTable, BillingCompareTables } from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Plus, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  buildCreditRows,
  buildPlatformRows,
  buildSourcingRows,
  type CompareRow,
} from '@/components/pricing-compare';
import { Button, Field, Input } from '@/components/ui';
import { fetchPublicBillingConfig, fetchAdminPageContent, updateAdminPageContent } from '@/lib/admin-billing';
import { ApiError } from '@/lib/api';

type TabId = 'platform' | 'sourcing' | 'credit';

const TABS: { id: TabId; label: string }[] = [
  { id: 'platform', label: 'Gói nền tảng' },
  { id: 'sourcing', label: 'Gói Săn' },
  { id: 'credit', label: 'Credit' },
];

function cellText(row: CompareRow, index: number): string {
  const cell = row.cells[index];
  if (!cell) return '';
  if (cell.kind === 'flag') return cell.yes ? 'Có' : 'Không';
  return cell.text;
}

function draftFromComputed(names: string[], rows: CompareRow[]): BillingCompareTable {
  return {
    columns: names,
    insight: '',
    rows: rows.map((row) => ({
      label: row.label,
      cells: names.map((_, index) => cellText(row, index)),
    })),
  };
}

function align(table: BillingCompareTable): BillingCompareTable {
  return {
    columns: table.columns.map((name) => name.trim()),
    insight: table.insight.trim(),
    rows: table.rows.map((row) => ({
      label: row.label.trim(),
      cells: table.columns.map((_, index) => (row.cells[index] ?? '').trim()),
    })),
  };
}

function tableError(table: BillingCompareTable, label: string): string | null {
  if (table.columns.length === 0) return `${label} cần ít nhất một cột.`;
  if (table.columns.some((name) => !name.trim())) return `${label} còn cột chưa đặt tên.`;
  if (table.rows.some((row) => !row.label.trim())) return `${label} còn dòng chưa có tên.`;
  return null;
}

export function AdminBillingCompare() {
  const qc = useQueryClient();
  const configQuery = useQuery({
    queryKey: ['billing-public-config'],
    queryFn: fetchPublicBillingConfig,
  });
  const contentQuery = useQuery({
    queryKey: ['admin-billing-page-content'],
    queryFn: fetchAdminPageContent,
  });

  const currency = configQuery.data?.currency;
  const platform = useMemo(
    () =>
      (configQuery.data?.platformPlans ?? [])
        .filter((plan) => plan.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [configQuery.data],
  );
  const sourcing = useMemo(
    () =>
      (configQuery.data?.sourcingPlans ?? [])
        .filter((plan) => plan.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [configQuery.data],
  );
  const credit = useMemo(
    () =>
      (configQuery.data?.creditTopups ?? [])
        .filter((item) => item.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [configQuery.data],
  );

  const computed = useMemo(() => {
    if (!currency) return null;
    return {
      platform: draftFromComputed(
        platform.map((plan) => plan.name),
        buildPlatformRows(platform, currency),
      ),
      sourcing: draftFromComputed(
        sourcing.map((plan) => plan.name),
        buildSourcingRows(sourcing, currency),
      ),
      credit: draftFromComputed(
        credit.map((item) => item.name),
        buildCreditRows(credit, currency),
      ),
    };
  }, [currency, platform, sourcing, credit]);

  const [tab, setTab] = useState<TabId>('platform');
  const [tables, setTables] = useState<BillingCompareTables | null>(null);
  const [savedOnServer, setSavedOnServer] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!contentQuery.data || ready) return;
    const saved = contentQuery.data.compareTables;
    if (saved) {
      setTables(saved);
      setSavedOnServer(true);
      setReady(true);
      return;
    }
    if (!computed) return;
    setTables(computed);
    setSavedOnServer(false);
    setReady(true);
  }, [computed, contentQuery.data, ready]);

  const save = useMutation({
    mutationFn: (next: BillingCompareTables) => updateAdminPageContent({ compareTables: next }),
    onSuccess: (page) => {
      qc.setQueryData(['admin-billing-page-content'], page);
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
      if (page.compareTables) setTables(page.compareTables);
      setSavedOnServer(page.compareTables != null);
      setMessage('Đã lưu bảng so sánh. Chữ này đứng yên, không đổi theo giá gói.');
    },
  });

  function patchTable(id: TabId, next: BillingCompareTable) {
    setTables((current) => (current ? { ...current, [id]: next } : current));
    setMessage(null);
    setFormError(null);
  }

  function updateRow(id: TabId, index: number, row: BillingCompareRow) {
    const table = tables?.[id];
    if (!table) return;
    patchTable(id, { ...table, rows: table.rows.map((item, i) => (i === index ? row : item)) });
  }

  function moveRow(id: TabId, index: number, dir: -1 | 1) {
    const table = tables?.[id];
    if (!table) return;
    const target = index + dir;
    if (target < 0 || target >= table.rows.length) return;
    const rows = [...table.rows];
    const [row] = rows.splice(index, 1);
    if (!row) return;
    rows.splice(target, 0, row);
    patchTable(id, { ...table, rows });
  }

  function renameColumn(id: TabId, index: number, name: string) {
    const table = tables?.[id];
    if (!table) return;
    patchTable(id, {
      ...table,
      columns: table.columns.map((item, i) => (i === index ? name : item)),
    });
  }

  function addColumn(id: TabId) {
    const table = tables?.[id];
    if (!table || table.columns.length >= 12) return;
    patchTable(id, {
      ...table,
      columns: [...table.columns, 'Cột mới'],
      rows: table.rows.map((row) => ({ ...row, cells: [...row.cells, ''] })),
    });
  }

  function removeColumn(id: TabId, index: number) {
    const table = tables?.[id];
    if (!table || table.columns.length <= 1) return;
    patchTable(id, {
      ...table,
      columns: table.columns.filter((_, i) => i !== index),
      rows: table.rows.map((row) => ({ ...row, cells: row.cells.filter((_, i) => i !== index) })),
    });
  }

  const activeTable = tables?.[tab];
  const error =
    formError ??
    (save.error instanceof ApiError
      ? save.error.message
      : save.error
        ? 'Không lưu được bảng so sánh.'
        : null);

  function onSave() {
    if (!tables) return;
    const next = {
      platform: align(tables.platform),
      sourcing: align(tables.sourcing),
      credit: align(tables.credit),
    };
    const problem =
      tableError(next.platform, 'Gói nền tảng') ??
      tableError(next.sourcing, 'Gói Săn') ??
      tableError(next.credit, 'Credit');
    if (problem) {
      setFormError(problem);
      return;
    }
    setTables(next);
    save.mutate(next);
  }

  return (
    <AdminShell>
      <div className="admin-dash space-y-5">
        <div className="admin-dash-rise flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
              Pricing · Bảng giá
            </p>
            <h1 className="cms-page-title mt-1.5">Bảng so sánh gói</h1>
            <div className="brand-accent-bar mt-2" />
            <p className="cms-page-subtitle mt-2 max-w-2xl">
              Bảng này đứng riêng, chỉ hiện đúng chữ bạn nhập. Sửa giá hay hạn mức gói không làm bảng so sánh đổi theo.
              Gõ Có hoặc Không nếu muốn hiện dấu tick.
            </p>
          </div>
          <Button type="button" disabled={save.isPending || !tables} onClick={onSave}>
            <Save className="h-4 w-4" />
            {save.isPending ? 'Đang lưu…' : 'Lưu bảng'}
          </Button>
        </div>

        <p className="text-sm text-slate-600">
          {savedOnServer
            ? 'Đang sửa bản đã lưu.'
            : 'Đây là bản nháp chép từ bảng đang hiển thị. Bấm Lưu bảng để giữ nguyên chữ này.'}{' '}
          <Link href="/bang-gia#compare" className="font-semibold text-brand-700 underline" target="_blank">
            Xem trang bảng giá
          </Link>
        </p>
        {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

        {!ready || !activeTable ? (
          <div className="admin-dash-skel h-80" />
        ) : (
          <Editor
            tab={tab}
            onTab={setTab}
            table={activeTable}
            onInsight={(insight) => patchTable(tab, { ...activeTable, insight })}
            onRenameColumn={(index, name) => renameColumn(tab, index, name)}
            onAddColumn={() => addColumn(tab)}
            onRemoveColumn={(index) => removeColumn(tab, index)}
            onRow={(index, row) => updateRow(tab, index, row)}
            onMove={(index, dir) => moveRow(tab, index, dir)}
            onRemove={(index) =>
              patchTable(tab, { ...activeTable, rows: activeTable.rows.filter((_, i) => i !== index) })
            }
            onAdd={() =>
              patchTable(tab, {
                ...activeTable,
                rows: [
                  ...activeTable.rows,
                  { label: 'Dòng mới', cells: activeTable.columns.map(() => '') },
                ],
              })
            }
          />
        )}
      </div>
    </AdminShell>
  );
}

function Editor({
  tab,
  onTab,
  table,
  onInsight,
  onRenameColumn,
  onAddColumn,
  onRemoveColumn,
  onRow,
  onMove,
  onRemove,
  onAdd,
}: {
  tab: TabId;
  onTab: (id: TabId) => void;
  table: BillingCompareTable;
  onInsight: (value: string) => void;
  onRenameColumn: (index: number, name: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (index: number) => void;
  onRow: (index: number, row: BillingCompareRow) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTab(item.id)}
            className={clsx(
              'rounded-full px-3 py-1.5 text-sm font-semibold',
              tab === item.id ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Field label="Câu phía trên bảng">
        <Input
          value={table.insight}
          placeholder="Để trống nếu không cần câu giới thiệu"
          onChange={(e) => onInsight(e.target.value)}
        />
      </Field>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-2">
          {table.columns.map((name, index) => (
            <div key={`col-${index}`} className="w-40">
              <Field label={`Cột ${index + 1}`}>
                <Input value={name} onChange={(e) => onRenameColumn(index, e.target.value)} />
              </Field>
              <button
                type="button"
                className="mt-1 text-xs font-semibold text-slate-500 hover:text-rose-700"
                onClick={() => onRemoveColumn(index)}
                disabled={table.columns.length <= 1}
              >
                Xoá cột
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" onClick={onAddColumn} disabled={table.columns.length >= 12}>
            <Plus className="h-4 w-4" />
            Thêm cột
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {table.rows.map((row, index) => (
          <div key={`row-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <Field label="Tên dòng">
                  <Input value={row.label} onChange={(e) => onRow(index, { ...row, label: e.target.value })} />
                </Field>
              </div>
              <div className="flex gap-1 pb-0.5">
                <Button type="button" variant="outline" onClick={() => onMove(index, -1)} aria-label="Đưa lên">
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" onClick={() => onMove(index, 1)} aria-label="Đưa xuống">
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button type="button" variant="outline" onClick={() => onRemove(index)}>
                  Xoá
                </Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {table.columns.map((name, colIndex) => (
                <Field key={`${name}-${colIndex}`} label={name || `Cột ${colIndex + 1}`}>
                  <Input
                    value={row.cells[colIndex] ?? ''}
                    onChange={(e) =>
                      onRow(index, {
                        ...row,
                        cells: table.columns.map((_, i) => (i === colIndex ? e.target.value : (row.cells[i] ?? ''))),
                      })
                    }
                  />
                </Field>
              ))}
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={onAdd} disabled={table.rows.length >= 40}>
          <Plus className="h-4 w-4" />
          Thêm dòng
        </Button>
      </div>
    </div>
  );
}
