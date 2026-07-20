import Link from 'next/link';
import { BrainCircuit, FileSearch, Sparkles, Users } from 'lucide-react';
import { BrandLogo, BrandMark } from '@/components/brand-logo';
import { Button, Card } from '@/components/ui';

const FEATURES = [
  {
    icon: FileSearch,
    title: 'AI đọc & hiểu CV',
    desc: 'Không chỉ OCR. AI hiểu ngành, kỹ năng, máy móc và tạo hồ sơ ứng viên tự động.',
  },
  {
    icon: BrainCircuit,
    title: 'Ghép việc AI theo tri thức',
    desc: 'Ghép ứng viên - công việc dựa trên đồ thị tri thức ngành công nghiệp, không dựa từ khoá.',
  },
  {
    icon: Users,
    title: 'Dành cho B2B công nghiệp',
    desc: 'Thấu hiểu máy móc, tự động hóa, HVAC/M&E, MRO, nhà máy FDI… đúng đặc thù tuyển dụng B2B công nghiệp.',
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <BrandMark href="/" size={36} />
        <nav className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Đăng nhập</Button>
          </Link>
          <Link href="/register">
            <Button>Đăng ký</Button>
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-8 text-center">
        <div className="mx-auto mb-8 flex justify-center">
          <BrandLogo href="/" width={280} className="max-w-[min(100%,280px)]" />
        </div>
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
          <Sparkles className="h-4 w-4" /> Nền tảng nhân lực công nghiệp tích hợp AI
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight text-slate-900 sm:text-5xl">
          AI hiểu sự nghiệp của bạn. <span className="text-brand-600">Không chỉ là CV.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Kết nối nhân tài – Dẫn lối công nghiệp. Tải CV lên, để AI phân tích và gợi ý cơ hội
          phù hợp với máy móc, tự động hóa, HVAC/M&E, MRO và nhà máy công nghiệp.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register">
            <Button className="px-6 py-3 text-base">Bắt đầu với ứng viên</Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" className="px-6 py-3 text-base">
              Tôi đã có tài khoản
            </Button>
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <f.icon className="h-8 w-8 text-brand-600" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
