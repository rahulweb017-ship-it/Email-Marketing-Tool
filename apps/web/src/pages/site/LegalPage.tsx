import { Link, Navigate, useParams } from 'react-router-dom';
import SiteLayout from '../../components/site/SiteLayout';
import { PageHero, Reveal, usePageTitle } from '../../components/site/ui';
import { LEGAL_DOCS, LEGAL_UPDATED, getLegalDoc } from '../../components/site/legalData';

export default function LegalPage() {
  const { slug = '' } = useParams();
  const doc = getLegalDoc(slug);
  usePageTitle(doc?.title ?? 'Legal');
  if (!doc) return <Navigate to="/" replace />;

  return (
    <SiteLayout>
      <PageHero eyebrow="Legal" title={doc.title} subtitle={`${doc.intro} Last updated ${LEGAL_UPDATED}.`} />
      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[220px_1fr]">
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Legal pages</p>
            <ul className="space-y-1.5 text-sm">
              {LEGAL_DOCS.map((d) => (
                <li key={d.slug}>
                  <Link
                    to={`/legal/${d.slug}`}
                    className={d.slug === doc.slug ? 'font-semibold text-brand-700' : 'text-slate-600 hover:text-brand-700'}
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
          <Reveal className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10">
            {doc.sections.map((s) => (
              <div key={s.heading} className="mb-8 last:mb-0">
                <h2 className="font-display text-lg font-bold text-slate-900">{s.heading}</h2>
                {s.body.map((p) => (
                  <p key={p} className="mt-2 text-sm leading-relaxed text-slate-600">{p}</p>
                ))}
                {s.list && (
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600">
                    {s.list.map((li) => <li key={li}>{li}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
