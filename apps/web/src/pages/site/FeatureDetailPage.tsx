import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check } from 'lucide-react';
import clsx from 'clsx';
import SiteLayout from '../../components/site/SiteLayout';
import { Backdrop, CtaBanner, Eyebrow, PrimaryButton, Reveal, SecondaryButton, SectionHeading, usePageTitle } from '../../components/site/ui';
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
            <Link to="/features" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> All features
            </Link>
            <div><Eyebrow>{feature.name}</Eyebrow></div>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{feature.headline}</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">{feature.description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryButton to="/register">Book a free demo</PrimaryButton>
              <SecondaryButton to="/contact">Ask a question</SecondaryButton>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="relative mx-auto w-full max-w-md">
            <div aria-hidden className={clsx('absolute inset-0 rounded-full bg-gradient-to-br opacity-40 blur-3xl', feature.gradient)} />
            <div className="relative rounded-3xl border border-white/10 bg-slate-900/70 p-8 backdrop-blur-xl">
              <span className={clsx('flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br shadow-xl', feature.gradient)}>
                <Icon className="h-8 w-8 text-white" />
              </span>
              <ul className="mt-8 space-y-4">
                {feature.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-3 text-slate-200">
                    <Check className="h-5 w-5 shrink-0 text-emerald-300" /> {h}
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
              <div className="h-full rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white', feature.gradient)}>{i + 1}</span>
                <h3 className="mt-4 font-semibold text-white">{d.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{d.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-6 py-16">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-2xl font-bold text-white">Works even better together</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {others.map((f) => (
              <Link key={f.slug} to={`/features/${f.slug}`} className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.06]">
                <span className={clsx('flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br', f.gradient)}>
                  <f.icon className="h-5 w-5 text-white" />
                </span>
                <h3 className="mt-4 flex items-center gap-1 font-semibold text-white">
                  {f.name} <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                </h3>
                <p className="mt-1.5 text-sm text-slate-400">{f.short}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBanner />
    </SiteLayout>
  );
}
