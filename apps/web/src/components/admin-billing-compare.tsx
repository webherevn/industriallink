'use client';

import type {
  BillingCompareCell,
  BillingCompareRow,
  BillingCompareTable,
  BillingCompareTables,
} from '@industriallink/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowDown, ArrowUp, Plus, RotateCcw, Save } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import {
  buildCreditRows,
  buildPlatformRows,
  buildSourcingRows,
  creditColumnCode,
  type CompareRow,
} from '@/components/pricing-compare';
import { Button, Field, Input, Select } from '@/components/ui';
import { fetchPublicBillingConfig, fetchAdminPageContent, updateAdminPageContent } from '@/lib/admin-billing';
import { ApiError } from '@/lib/api';

type TabId = 'platform' | 'sourcing' | 'credit';

type Column = { code: string; name: string };

const TABS: { id: TabId; label: string }[] = [
  { id: 'platform', label: 'Gói nền tảng' },
  { id: 'sourcing', label: 'Gói Săn' },
  { id: 'credit', label: 'Credit' },
];

function emptyCell(code: string): BillingCompareCell {
  return { code, kind: 'text', text: '', yes: false };
}

function alignTable(table: BillingCompareTable, columns: Column[]): BillingCompareTable {
  return {
    insight: table.insight,
    rows: table.rows.map((row) => ({
      ...row,
      cells: columns.map(
        (col) => row.cells.find((cell) => cell.code === col.code) ?? emptyCell(col.code),
      ),
    })),
  };
}

function draftFromComputed(columns: Column[], rows: CompareRow[]): BillingCompareTable {
  return {
    insight: '',
    rows: rows.map((row) => ({
      label: row.label,
      mode: 'auto',
      autoKey: row.autoKey ?? null,
      cells: columns.map((col, index) => {
        const cell = row.cells[index];
        if (cell?.kind === 'flag') return { code: col.code, kind: 'flag' as const, text: '', yes: cell.yes };
        return { code: col.code, kind: 'text' as const, text: cell?.text ?? '', yes: false };
      }),
    })),
  };
}

function previewCell(row: CompareRow | undefined, index: number): string {
  const cell = row?.cells[index];
  if (!cell) return '—';
  if (cell.kind === 'flag') return cell.yes ? 'Có' : 'Không';
  return cell.text || '—';
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

  const columns = useMemo(() => {
    const map: Record<TabId, Column[]> = {
      platform: platform.map((plan) => ({ code: plan.code, name: plan.name })),
      sourcing: sourcing.map((plan) => ({ code: plan.code, name: plan.name })),
      credit: credit.map((item) => ({ code: creditColumnCode(item), name: item.name })),
    };
    return map;
  }, [platform, sourcing, credit]);

  const computed = useMemo(() => {
    if (!currency) return null;
    return {
      platform: buildPlatformRows(platform, currency),
      sourcing: buildSourcingRows(sourcing, currency),
      credit: buildCreditRows(credit, currency),
    };
  }, [currency, platform, sourcing, credit]);

  const [tab, setTab] = useState<TabId>('platform');
  const [tables, setTables] = useState<BillingCompareTables | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!computed || !contentQuery.data || ready) return;
    const saved = contentQuery.data.compareTables;
    if (saved) {
      setTables({
        platform: alignTable(saved.platform, columns.platform),
        sourcing: alignTable(saved.sourcing, columns.sourcing),
        credit: alignTable(saved.credit, columns.credit),
      });
      setUsingSaved(true);
    } else {
      setTables({
        platform: draftFromComputed(columns.platform, computed.platform),
        sourcing: draftFromComputed(columns.sourcing, computed.sourcing),
        credit: draftFromComputed(columns.credit, computed.credit),
      });
      setUsingSaved(false);
    }
    setReady(true);
  }, [computed, contentQuery.data, columns, ready]);

  const save = useMutation({
    mutationFn: (next: BillingCompareTables | null) => updateAdminPageContent({ compareTables: next }),
    onSuccess: (page) => {
      qc.setQueryData(['admin-billing-page-content'], page);
      qc.invalidateQueries({ queryKey: ['billing-public-config'] });
      setUsingSaved(page.compareTables != null);
      setMessage(page.compareTables ? 'Đã lưu bảng so sánh.' : 'Đã trả về bảng tự động.');
    },
  });

  function patchTable(id: TabId, next: BillingCompareTable) {
    setTables((current) => (current ? { ...current, [id]: next } : current));
    setMessage(null);
  }

  function updateRow(id: TabId, index: number, row: BillingCompareRow) {
    const table = tables?.[id];
    if (!table) return;
    const rows = table.rows.map((item, i) => (i === index ? row : item));
    patchTable(id, { ...table, rows });
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

  const activeColumns = columns[tab];
  const activeTable = tables?.[tab];
  const activeComputed = computed?.[tab] ?? [];
  const error =
    save.error instanceof ApiError
      ? save.error.message
      : save.error
        ? 'Không lưu được bảng so sánh.'
        : null;

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
              Sửa dòng và ô trên trang bảng giá. Dòng “Theo dữ liệu gói” vẫn lấy giá, hạn mức và quyền từ cấu hình gói.
              Dòng “Tự nhập” giữ đúng chữ hoặc dấu có/không bạn ghi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={save.isPending || !computed}
              onClick={() => {
                if (!computed) return;
                const next = {
                  platform: draftFromComputed(columns.platform, computed.platform),
                  sourcing: draftFromComputed(columns.sourcing, computed.sourcing),
                  credit: draftFromComputed(columns.credit, computed.credit),
                };
                setTables(next);
                setUsingSaved(false);
                save.mutate(null);
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Dùng bảng tự động
            </Button>
            <Button
              type="button"
              disabled={save.isPending || !tables}
              onClick={() => tables && save.mutate(tables)}
            >
              <Save className="h-4 w-4" />
              {save.isPending ? 'Đang lưu…' : 'Lưu bảng'}
            </Button>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          {usingSaved
            ? 'Đang hiển thị bản SuperAdmin đã lưu.'
            : 'Đang hiển thị bảng tự sinh. Bấm Lưu bảng sau khi sửa.'}{' '}
          <Link href="/bang-gia#compare" className="font-semibold text-brand-700 underline" target="_blank">
            Xem trang bảng giá
          </Link>
        </p>
        {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

        {!ready || !activeTable || !currency ? (
          <div className="admin-dash-skel h-80" />
        ) : (
          <Editor
            tab={tab}
            onTab={setTab}
            columns={activeColumns}
            table={activeTable}
            computed={activeComputed}
            onInsight={(insight) => patchTable(tab, { ...activeTable, insight })}
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
                  {
                    label: 'Dòng mới',
                    mode: 'custom',
                    autoKey: null,
                    cells: activeColumns.map((col) => emptyCell(col.code)),
                  },
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
  columns,
  table,
  computed,
  onInsight,
  onRow,
  onMove,
  onRemove,
  onAdd,
}: {
  tab: TabId;
  onTab: (id: TabId) => void;
  columns: Column[];
  table: BillingCompareTable;
  computed: CompareRow[];
  onInsight: (value: string) => void;
  onRow: (index: number, row: BillingCompareRow) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const options = computed.filter((row) => row.autoKey);
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

      <Field label="Câu gợi ý phía trên bảng">
        <Input
          value={table.insight}
          placeholder="Để trống để dùng câu tự sinh"
          onChange={(e) => onInsight(e.target.value)}
        />
      </Field>

      {columns.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có gói đang bật ở nhóm này.</p>
      ) : (
        <div className="space-y-3">
          {table.rows.map((row, index) => {
            const live = options.find((item) => item.autoKey === row.autoKey);
            return (
              <div key={`${row.autoKey ?? 'custom'}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[12rem] flex-1">
                    <Field label="Tên dòng">
                      <Input value={row.label} onChange={(e) => onRow(index, { ...row, label: e.target.value })} />
                    </Field>
                  </div>
                  <div className="w-40">
                    <Field label="Nguồn">
                      <Select
                        value={row.mode}
                        onChange={(e) =>
                          onRow(index, {
                            ...row,
                            mode: e.target.value === 'custom' ? 'custom' : 'auto',
                            autoKey: row.autoKey ?? options[0]?.autoKey ?? null,
                          })
                        }
                      >
                        <option value="auto">Theo dữ liệu gói</option>
                        <option value="custom">Tự nhập</option>
                      </Select>
                    </Field>
                  </div>
                  {row.mode === 'auto' ? (
                    <div className="min-w-[14rem] flex-1">
                      <Field label="Chỉ số">
                        <Select
                          value={row.autoKey ?? ''}
                          onChange={(e) => onRow(index, { ...row, autoKey: e.target.value || null })}
                        >
                          {options.map((item) => (
                            <option key={item.autoKey} value={item.autoKey}>
                              {item.label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                  ) : null}
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

                {row.mode === 'auto' ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Đang hiện:{' '}
                    {columns.map((col, colIndex) => `${col.name}: ${previewCell(live, colIndex)}`).join(' · ')}
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {columns.map((col) => {
                      const cell = row.cells.find((item) => item.code === col.code) ?? emptyCell(col.code);
                      return (
                        <div key={col.code} className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-700">{col.name}</p>
                          <div className="mt-2">
                            <Select
                              value={cell.kind}
                              onChange={(e) => {
                                const kind = e.target.value === 'flag' ? 'flag' : 'text';
                                onRow(index, {
                                  ...row,
                                  cells: row.cells.map((item) =>
                                    item.code === col.code ? { ...item, kind } : item,
                                  ),
                                });
                              }}
                            >
                              <option value="text">Chữ</option>
                              <option value="flag">Có / Không</option>
                            </Select>
                          </div>
                          {cell.kind === 'flag' ? (
                            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={cell.yes}
                                onChange={(e) =>
                                  onRow(index, {
                                    ...row,
                                    cells: row.cells.map((item) =>
                                      item.code === col.code ? { ...item, yes: e.target.checked } : item,
                                    ),
                                  })
                                }
                              />
                              Có
                            </label>
                          ) : (
                            <Input
                              className="mt-2"
                              value={cell.text}
                              onChange={(e) =>
                                onRow(index, {
                                  ...row,
                                  cells: row.cells.map((item) =>
                                    item.code === col.code ? { ...item, text: e.target.value } : item,
                                  ),
                                })
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <Button type="button" variant="outline" onClick={onAdd}>
            <Plus className="h-4 w-4" />
            Thêm dòng
          </Button>
        </div>
      )}
    </div>
  );
}
