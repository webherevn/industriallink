import type { CrmQuoteFormView, CrmQuoteView } from '@industriallink/contracts';
import { formatVnd } from '@/components/crm/format';

type FormHead = Pick<
  CrmQuoteFormView,
  | 'legalName'
  | 'taxCode'
  | 'address'
  | 'phone'
  | 'email'
  | 'website'
  | 'bankName'
  | 'bankAccount'
  | 'bankHolder'
  | 'transferNote'
  | 'terms'
  | 'signerTitle'
>;

export function QuoteDocument({
  quote,
  form,
  logoUrl,
  pendingId = null,
  onCollect,
}: {
  quote: CrmQuoteView;
  form: FormHead | null;
  logoUrl: string | null;
  pendingId?: string | null;
  onCollect?: (id: string) => void;
}) {
  const companyLines = [
    form?.legalName,
    form?.taxCode ? `MST ${form.taxCode}` : null,
    form?.address,
    form?.phone,
    form?.email,
    form?.website,
  ].filter((line): line is string => Boolean(line));
  const bankReady = Boolean(form?.bankName || form?.bankAccount || form?.bankHolder);

  return (
    <article className="rounded-[22px] bg-white p-8 text-slate-800 crm-surface print:rounded-none print:shadow-none">
      <header className="flex items-start justify-between gap-6 border-b border-[#efeaff] pb-5">
        <div className="min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt={form?.legalName || 'inlink'} className="h-14 w-auto max-w-[180px] object-contain" />
          ) : (
            <p className="text-lg font-bold tracking-wide text-[#4c3ec9]">inlink</p>
          )}
        </div>
        {companyLines.length > 0 ? (
          <div className="max-w-xs text-right text-xs leading-5 text-slate-600">
            {companyLines.map((line, index) => (
              <p key={`${index}-${line}`}>{line}</p>
            ))}
          </div>
        ) : null}
      </header>

      <h1 className="mt-6 text-center text-2xl font-bold tracking-wide text-[#072348]">BÁO GIÁ</h1>
      <p className="mt-2 text-center text-sm text-slate-500">
        Số {quote.quoteCode} · Ngày {showDay(quote.quotedOn)}
        {quote.validUntil ? ` · Hiệu lực đến ${showDay(quote.validUntil)}` : ''}
      </p>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4c3ec9]">Khách hàng</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <Field label="Công ty" value={quote.companyName} />
          <Field label="Mã số thuế" value={quote.taxCode} />
          <Field label="Địa chỉ" value={quote.address} wide />
          <Field label="Người liên hệ" value={quote.contactName} />
          <Field label="Điện thoại" value={quote.contactPhone} />
          <Field label="Email" value={quote.contactEmail} />
        </dl>
      </section>

      {quote.quoteKind === 'enterprise' ? (
        <EnterpriseBlock quote={quote} pendingId={pendingId} onCollect={onCollect} />
      ) : (
        <CatalogBlock quote={quote} />
      )}

      {quote.note ? <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{quote.note}</p> : null}
      {form?.terms ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4c3ec9]">Điều khoản</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{form.terms}</p>
        </section>
      ) : null}
      {bankReady ? (
        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4c3ec9]">Tài khoản nhận</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Field label="Ngân hàng" value={form?.bankName} />
            <Field label="Số tài khoản" value={form?.bankAccount} />
            <Field label="Chủ tài khoản" value={form?.bankHolder} />
            <Field label="Nội dung" value={form?.transferNote} />
          </dl>
        </section>
      ) : null}

      <p className="mt-6 text-sm text-slate-600">
        {quote.vatPercent == null
          ? 'Giá chưa gồm VAT. Thuế suất chưa đặt.'
          : `Giá chưa gồm VAT ${quote.vatPercent}%. Thuế chưa cộng vào số trên tờ.`}
        {quote.quoteKind === 'catalog' ? ' Khách chọn một phương án và thanh toán trên inlink.' : ''}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
        <div>
          <p className="font-semibold text-[#072348]">Đại diện inlink</p>
          <p className="mt-1 text-xs text-slate-500">{form?.signerTitle || 'Người lập'}</p>
          <p className="mt-16 border-t border-slate-200 pt-2 text-slate-700">{quote.ownerName}</p>
        </div>
        <div>
          <p className="font-semibold text-[#072348]">Khách hàng</p>
          <p className="mt-1 text-xs text-slate-500">Xác nhận</p>
          <p className="mt-16 border-t border-slate-200 pt-2 text-slate-700">{quote.contactName}</p>
        </div>
      </div>
    </article>
  );
}

function Field({ label, value, wide = false }: { label: string; value: string | null | undefined; wide?: boolean }) {
  if (!value) return null;
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-1 font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function CatalogBlock({ quote }: { quote: CrmQuoteView }) {
  return (
    <section className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4c3ec9]">Phương án</h2>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-2">STT</th>
            <th className="py-2">Gói</th>
            <th className="py-2">Đơn vị</th>
            <th className="py-2">Số lượng</th>
            <th className="py-2">Đơn giá</th>
            <th className="py-2">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          <SheetLine index={1} name={quote.option1Name} kind={quote.option1Kind} price={quote.option1PriceVnd} />
          {quote.option2Name && quote.option2PriceVnd ? (
            <SheetLine index={2} name={quote.option2Name} kind={quote.option2Kind ?? 'platform'} price={quote.option2PriceVnd} />
          ) : null}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-400">
        Khách chọn một phương án.{quote.option2Name && quote.option2PriceVnd ? ' Không cộng hai thành tiền.' : ''}
      </p>
    </section>
  );
}

function SheetLine({
  index,
  name,
  kind,
  price,
}: {
  index: number;
  name: string;
  kind: 'platform' | 'sourcing';
  price: string;
}) {
  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 text-slate-500">{index}</td>
      <td className="py-2">
        <span className="font-semibold text-slate-900">{name}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{kind === 'sourcing' ? 'Gói Săn' : 'Gói tin'}</span>
      </td>
      <td className="py-2 text-slate-500">Gói</td>
      <td className="py-2 text-slate-500">1</td>
      <td className="py-2">{formatVnd(price)}</td>
      <td className="py-2 font-semibold text-[#072348]">{formatVnd(price)}</td>
    </tr>
  );
}

function EnterpriseBlock({
  quote,
  pendingId,
  onCollect,
}: {
  quote: CrmQuoteView;
  pendingId: string | null;
  onCollect?: (id: string) => void;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#4c3ec9]">Hợp đồng Enterprise</h2>
      <p className="mt-3 text-sm font-semibold text-slate-900">{quote.option1Name}</p>
      <p className="mt-1 text-sm text-slate-500">
        Giá trị hợp đồng {formatVnd(quote.option1PriceVnd)} · Đã thu {formatVnd(quote.collectedVnd)} · Còn phải thu {formatVnd(quote.receivableVnd)}
      </p>
      <table className="mt-3 w-full text-sm">
        <thead className="text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="py-2">Đợt</th>
            <th className="py-2">Tỉ lệ</th>
            <th className="py-2">Hạn</th>
            <th className="py-2">Số tiền</th>
            <th className="py-2">Tình trạng</th>
          </tr>
        </thead>
        <tbody>
          {quote.installments.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="py-2 font-medium text-slate-800">{line.label}</td>
              <td className="py-2 text-slate-600">{line.percent}%</td>
              <td className="py-2 text-slate-600">{showDay(line.dueOn)}</td>
              <td className="py-2 font-semibold text-[#072348]">{formatVnd(line.amountVnd)}</td>
              <td className="py-2 text-slate-600">
                {line.status === 'collected' ? 'Đã thu' : line.status === 'open' ? 'Còn phải thu' : 'Chưa chốt'}
                {line.status === 'open' && onCollect ? (
                  <button type="button" className="ml-3 text-xs font-semibold text-[#4c3ec9] print:hidden" disabled={pendingId === line.id} onClick={() => onCollect(line.id)}>
                    {pendingId === line.id ? 'Đang ghi…' : 'Ghi đã thu'}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function showDay(value: string | null): string {
  if (!value) return '—';
  const [year, month, date] = value.split('-');
  return year && month && date ? `${date}/${month}/${year}` : value;
}
