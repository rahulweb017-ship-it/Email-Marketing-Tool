import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { SITE } from './siteData';

export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | ${SITE.name}` : `${SITE.name} | ${SITE.tagline}`;
    return () => { document.title = previous; };
  }, [title]);
}

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Highlighted words in headings, in the logo red. */
export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('bg-gradient-to-r from-brand-600 via-brand-500 to-rose-500 bg-clip-text text-transparent', className)}>
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-600" />
      {children}
    </span>
  );
}

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex shrink-0 items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700', className)}>
      Coming soon
    </span>
  );
}

export function SectionHeading({ eyebrow, title, subtitle, center = true }: {
  eyebrow?: string; title: ReactNode; subtitle?: ReactNode; center?: boolean;
}) {
  return (
    <Reveal className={clsx('max-w-3xl', center && 'mx-auto text-center')}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{subtitle}</p>}
    </Reveal>
  );
}

export function PrimaryButton({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={clsx(
        'group inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700',
        className,
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function SecondaryButton({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:text-brand-700',
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Soft red glow and a faint grid behind a section. */
export function Backdrop({ variant = 'hero' }: { variant?: 'hero' | 'soft' }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {variant === 'hero' && <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgba(204,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(204,0,0,0.05) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)',
        }}
      />}
      {variant === 'hero' ? (
        <>
          <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-brand-200/50 blur-[120px]" />
          <div className="absolute top-40 -left-32 h-80 w-80 rounded-full bg-rose-200/40 blur-[100px]" />
          <div className="absolute top-20 -right-24 h-96 w-96 rounded-full bg-orange-100/60 blur-[110px]" />
        </>
      ) : (
        <div className="absolute -top-32 left-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-brand-100/70 blur-[110px]" />
      )}
    </div>
  );
}

export function PageHero({ eyebrow, title, subtitle, children }: {
  eyebrow: string; title: ReactNode; subtitle: ReactNode; children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pt-36 pb-16 sm:pt-44 sm:pb-20">
      <Backdrop />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">{subtitle}</p>
          {children && <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div>}
        </Reveal>
      </div>
    </section>
  );
}

export function CtaBanner({ title = 'Ready to grow with AI?', subtitle = 'Tell us about your business and we will set up a free, personal demo.' }: {
  title?: string; subtitle?: string;
}) {
  return (
    <section className="relative px-6 py-20 sm:py-24">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-10 text-center shadow-2xl shadow-brand-900/20 sm:p-14">
        <div aria-hidden className="absolute -top-24 left-1/2 h-64 w-[520px] -translate-x-1/2 rounded-full bg-white/15 blur-[90px]" />
        <div className="relative">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-50">{subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="group inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50">
              Book a free demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link to="/contact" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
              Talk to us
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-brand-600">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
