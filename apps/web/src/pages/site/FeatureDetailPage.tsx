import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, Rocket } from 'lucide-react';
import clsx from 'clsx';
import SiteLayout from '../../components/site/SiteLayout';
import { Backdrop, ComingSoonBadge, CtaBanner, Eyebrow, PrimaryButton, Reveal, SecondaryButton, SectionHeading, usePageTitle } from '../../components/site/ui';
import { FEATURES } from '../../components/site/siteData';

export default function FeatureDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const feature = FEATURES.find((f) => f.slug === slug);
  usePageTitle(feature?.name ?? 'Features');
  if (!feature) return <Navigate to="/features" replace />;

  const others = FEATURES.filter((f) => f.slug !== feature.slug).slice(0, 3);
  const Icon = feature.icon;

  return (
    <SiteLayout>
      <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
        <Backdrop />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1.2fr_1fr]">
          <Reveal>
            <Link to="/features" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700">
              <ArrowLeft className="h-4 w-4" /> All features
            </Link>
            <div><Eyebrow>{feature.name}</Eyebrow></div>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">{feature.headline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">{feature.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton to="/register">Book a free demo</PrimaryButton>
              <SecondaryButton to="/contact">Ask a question</SecondaryButton>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="relative mx-auto w-full max-w-md">
            <div aria-hidden className={clsx('absolute inset-0 rounded-full bg-gradient-to-br opacity-40 blur-3xl', feature.gradient)} />
            <div className="relative rounded-3xl border border-slate-200 bg-white p-8 backdrop-blur-xl">
              <span className={clsx('flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl', feature.gradient)}>
                <Icon className="h-8 w-8 text-white" />
              </span>
              <ul className="mt-8 space-y-4">
                {feature.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-3 text-slate-700">
                    <Check className="h-5 w-5 shrink-0 text-emerald-600" /> {h}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-20">
        <SectionHeading title="What you get" subtitle={feature.short} />
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {feature.details.map((d, i) => (
            <Reveal key={d.title} delay={(i % 3) * 0.06} className="h-full">
              <div className="h-full rounded-2xl border border-slate-200 bg-white p-6">
                <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white', feature.gradient)}>{i + 1}</span>
                <h3 className="mt-4 font-semibold text-slate-900">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{d.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {feature.roadmap && feature.roadmap.length > 0 && (
        <section className="px-6 py-12">
          <div className="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-gradient-to-b from-white to-transparent p-8 sm:p-10">
            <div className="flex items-center gap-3">
              <Rocket className="h-5 w-5 text-amber-200" />
              <h2 className="font-display text-2xl font-bold text-slate-900">Coming next</h2>
            </div>
            <p className="mt-2 text-sm text-slate-600">We are building these now. Ask us about early access when you book a demo.</p>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {feature.roadmap.map((r) => (
                <div key={r.title} className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold text-slate-900">{r.title}</h3>
                    <ComingSoonBadge />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-2xl font-bold text-slate-900">Works even better together</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {others.map((f) => (
              <Link key={f.slug} to={`/features/${f.slug}`} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-brand-300 hover:bg-slate-50">
                <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br', f.gradient)}>
                  <f.icon className="h-5 w-5 text-white" />
                </span>
                <h3 className="mt-4 flex items-center gap-1 font-semibold text-slate-900">
                  {f.name} <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">{f.short}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner />
    </SiteLayout>
  );
}
