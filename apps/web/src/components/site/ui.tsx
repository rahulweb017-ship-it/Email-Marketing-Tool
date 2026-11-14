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

export function GradientText({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={clsx('bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent', className)}>
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400" />
      {children}
    </span>
  );
}

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span className={clsx('inline-flex shrink-0 items-center rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200', className)}>
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
      <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">{subtitle}</p>}
    </Reveal>
  );
}

export function PrimaryButton({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link
      to={to}
      className={clsx(
        'group inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:shadow-fuchsia-500/30 hover:brightness-110',
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
        'inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10',
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Soft glowing blobs and a faint grid behind a section. */
export function Backdrop({ variant = 'hero' }: { variant?: 'hero' | 'soft' }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {variant === 'hero' && <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)',
        }}
      />}
      {variant === 'hero' ? (
        <>
          <div className="absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-600/30 blur-[120px]" />
          <div className="absolute top-40 -left-32 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-[100px]" />
          <div className="absolute top-20 -right-24 h-96 w-96 rounded-full bg-cyan-500/15 blur-[110px]" />
        </>
      ) : (
        <div className="absolute -top-32 left-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[110px]" />
      )}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-slate-950" />
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
          <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">{title}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">{subtitle}</p>
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
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/40 via-violet-600/30 to-fuchsia-600/30 p-10 text-center sm:p-14">
        <div aria-hidden className="absolute -top-24 left-1/2 h-64 w-[520px] -translate-x-1/2 rounded-full bg-fuchsia-500/30 blur-[90px]" />
        <div className="relative">
          <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-slate-200">{subtitle}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryButton to="/register">Book a free demo</PrimaryButton>
            <SecondaryButton to="/contact">Talk to us</SecondaryButton>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-indigo-400/70 focus:bg-white/[0.07] focus:ring-2 focus:ring-indigo-500/30';

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-200">
        {label} {required && <span className="text-fuchsia-300">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}
