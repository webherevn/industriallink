import type { CmsPostListItem } from '@industriallink/contracts';
import { cmsCategoryPublicPath, cmsPostPublicPath } from '@industriallink/contracts';
import Link from 'next/link';
import { resolveCmsAssetUrl } from '@/lib/cms-assets';

function formatViDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const CAM_NANG_INTRO =
  'inlink mở chuyên mục Cẩm nang nghề nghiệp dành cho ứng viên kỹ thuật và kinh doanh B2B.';
export const CAM_NANG_INTRO_DETAIL =
  'Bạn sẽ tìm thấy lộ trình nghề, mẹo CV, phỏng vấn và góc nhìn thị trường tuyển dụng công nghiệp.';

export function CmsBlogHero({
  title,
  description,
  descriptionExtra,
  eyebrow = 'inlink',
  avatarUrl,
}: {
  title: string;
  description?: string | null;
  descriptionExtra?: string | null;
  eyebrow?: string;
  avatarUrl?: string | null;
}) {
  const avatar = resolveCmsAssetUrl(avatarUrl) || avatarUrl || null;
  return (
    <header className="relative overflow-hidden bg-[var(--brand-navy)] text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 100% 0%, #E8872A 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, #0f3d6e 0%, transparent 50%)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.35) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:py-16">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-300">
          {eyebrow}
        </p>
        <div className="brand-accent-bar mt-3" />
        <div className="mt-4 flex items-start gap-4 sm:gap-5">
          {avatar ? (
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-white/20 bg-white/10 shadow-sm sm:h-16 sm:w-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatar}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
              {title}
            </h1>
            {description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
                {description}
              </p>
            ) : null}
            {descriptionExtra ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-[15px]">
                {descriptionExtra}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function CmsCategoryChips({
  categories,
  activeSlug,
}: {
  categories: Array<{ id: string; name: string; slug: string; avatarUrl?: string | null }>;
  activeSlug?: string | null;
}) {
  if (categories.length === 0) return null;
  const allActive = !activeSlug;
  return (
    <nav aria-label="Chuyên mục" className="flex flex-wrap gap-2">
      <Link
        href="/cam-nang?v=3"
        prefetch={false}
        className={
          allActive
            ? 'rounded-lg bg-[var(--brand-navy)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm'
            : 'rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-accent-200 hover:text-[var(--brand-navy)]'
        }
      >
        Tất cả
      </Link>
      {categories.map((c) => {
        const active = activeSlug === c.slug;
        const avatar = resolveCmsAssetUrl(c.avatarUrl) || c.avatarUrl;
        return (
          <Link
            key={c.id}
            href={cmsCategoryPublicPath(c.slug)}
            className={
              active
                ? 'inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-navy)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm'
                : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-accent-200 hover:text-[var(--brand-navy)]'
            }
          >
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                width={18}
                height={18}
                className="h-[18px] w-[18px] rounded object-cover"
              />
            ) : null}
            {c.name}
          </Link>
        );
      })}
    </nav>
  );
}

export function CmsPostCard({
  post,
  featured = false,
}: {
  post: CmsPostListItem;
  featured?: boolean;
}) {
  const cover = resolveCmsAssetUrl(post.coverImageUrl);
  const href = cmsPostPublicPath(post.slug);
  const dateLabel = formatViDate(post.publishedAt);

  if (featured) {
    return (
      <article className="group overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:border-accent-200 hover:shadow-md">
        <Link href={href} className="grid gap-0 md:grid-cols-2">
          <div className="relative aspect-[16/10] overflow-hidden bg-slate-100 md:aspect-auto md:min-h-[280px]">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={post.title}
                width={800}
                height={500}
                loading="eager"
                decoding="async"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full min-h-[200px] items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 md:min-h-[280px]">
                <span className="text-4xl font-bold text-white/20">inlink</span>
              </div>
            )}
            <span className="absolute left-3 top-3 rounded-md bg-accent-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
              Nổi bật
            </span>
          </div>
          <div className="flex flex-col justify-center p-5 sm:p-7 lg:p-8">
            {post.categoryName ? (
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">
                {post.categoryName}
              </span>
            ) : null}
            <h2 className="mt-2 text-xl font-bold leading-snug text-slate-900 transition group-hover:text-brand-600 sm:text-2xl">
              {post.title}
            </h2>
            {post.excerpt ? (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">
                {post.excerpt}
              </p>
            ) : null}
            <p className="mt-4 text-xs font-medium text-slate-400">{dateLabel}</p>
          </div>
        </Link>
      </article>
    );
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:border-accent-200 hover:shadow-md">
      <Link href={href} className="flex h-full flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt={post.title}
              width={640}
              height={400}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
              <span className="text-2xl font-bold text-brand-200">inlink</span>
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {post.categoryName ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-600">
              {post.categoryName}
            </span>
          ) : null}
          <h2 className="mt-1.5 text-base font-bold leading-snug text-slate-900 transition group-hover:text-brand-600 sm:text-[1.05rem]">
            {post.title}
          </h2>
          {post.excerpt ? (
            <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">
              {post.excerpt}
            </p>
          ) : null}
          <p className="mt-3 text-xs font-medium text-slate-400">{dateLabel}</p>
        </div>
      </Link>
    </article>
  );
}

export function CmsPostEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
      <p className="text-sm text-slate-500">{message}</p>
      <Link
        href="/viec-lam"
        className="mt-4 inline-flex rounded-lg bg-[var(--brand-navy)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
      >
        Tìm việc ngay
      </Link>
    </div>
  );
}

export function CmsPagination({
  pageNum,
  totalPages,
  prevHref,
  nextHref,
}: {
  pageNum: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label="Phân trang"
      className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-brand-600 transition hover:border-accent-200 hover:text-brand-700"
        >
          ← Trang trước
        </Link>
      ) : (
        <span className="inline-flex rounded-lg border border-transparent px-3.5 py-2 text-sm text-slate-300">
          ← Trang trước
        </span>
      )}
      <span className="text-sm font-medium text-slate-500">
        Trang {pageNum} / {totalPages}
      </span>
      {nextHref ? (
        <Link
          href={nextHref}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-brand-600 transition hover:border-accent-200 hover:text-brand-700"
        >
          Trang sau →
        </Link>
      ) : (
        <span className="inline-flex rounded-lg border border-transparent px-3.5 py-2 text-sm text-slate-300">
          Trang sau →
        </span>
      )}
    </nav>
  );
}

/** Bài liên quan cùng chuyên mục — avatar + title, gọn nhẹ. */
export function CmsRelatedPosts({
  posts,
  categoryName,
  categoryHref,
}: {
  posts: CmsPostListItem[];
  categoryName?: string | null;
  categoryHref?: string | null;
}) {
  if (posts.length === 0) return null;
  return (
    <section className="mt-12 border-t border-slate-200 pt-10" aria-labelledby="related-posts-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2
          id="related-posts-heading"
          className="text-lg font-bold text-[var(--brand-navy)] sm:text-xl"
        >
          Bài viết liên quan
        </h2>
        {categoryHref && categoryName ? (
          <Link
            href={categoryHref}
            className="text-xs font-semibold text-accent-600 transition hover:text-accent-700"
          >
            Xem {categoryName} →
          </Link>
        ) : null}
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {posts.map((post) => {
          const cover = resolveCmsAssetUrl(post.coverImageUrl);
          return (
            <li key={post.id}>
              <Link
                href={cmsPostPublicPath(post.slug)}
                className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 transition hover:border-accent-200 hover:bg-white"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-brand-50">
                  {cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cover}
                      alt=""
                      width={56}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs font-bold text-brand-300">
                      in
                    </span>
                  )}
                </div>
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-800 transition group-hover:text-[var(--brand-navy)]">
                  <span className="line-clamp-2">{post.title}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export { formatViDate };
