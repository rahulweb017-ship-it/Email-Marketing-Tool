import { Link } from 'react-router-dom';
import { ArrowUpRight, Check } from 'lucide-react';
import clsx from 'clsx';
import SiteLayout from '../../components/site/SiteLayout';
import { CtaBanner, GradientText, PageHero, PrimaryButton, Reveal, SecondaryButton, usePageTitle } from '../../components/site/ui';
import { FEATURES } from '../../components/site/siteData';

export default function FeaturesPage() {
  usePageTitle('Features');
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Features"
        title={<>Everything you need to <GradientText>grow</GradientText></>}
        subtitle="Email, WhatsApp, social and automation, with an AI assistant built into every step. Pick a feature to see how it works."
      >
        <PrimaryButton to="/register">Book a free demo</PrimaryButton>
        <SecondaryButton to="/contact">Ask a question</SecondaryButton>
      </PageHero>

      <section className="px-6 pb-12">
        <div className="mx-auto max-w-7xl space-y-6">
          {FEATURES.map((f, i) => (
            <Reveal key={f.slug}>
              <div className={clsx(
                'group relative grid overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] p-8 transition hover:border-white/20 sm:p-10 lg:grid-cols-[1.2fr_1fr] lg:gap-12',
              )}>
                <div aria-hidden className={clsx('absolute h-72 w-72 rounded-full bg-gradient-to-br opacity-20 blur-3xl', f.gradient, i % 2 ? '-left-24 -bottom-24' : '-right-24 -top-24')} />
                <div className="relative">
                  <span className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg', f.gradient)}>
                    <f.icon className="h-6 w-6 text-white" />
                  </span>
                  <p className="mt-5 text-sm font-medium text-indigo-300">{f.name}</p>
                  <h2 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">{f.headline}</h2>
                  <p className="mt-4 max-w-xl leading-relaxed text-slate-400">{f.description}</p>
                  <Link to={`/features/${f.slug}`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-indigo-200">
                    Explore {f.name} <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <ul className="relative mt-8 grid content-center gap-3 sm:grid-cols-2 lg:mt-0 lg:grid-cols-1">
                  {f.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
                      <span className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br', f.gradient)}>
                        <Check className="h-3.5 w-3.5 text-white" />
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <CtaBanner title="See it with your own data" subtitle="Book a short demo and we will walk you through the features that matter to your business." />
    </SiteLayout>
  );
}
