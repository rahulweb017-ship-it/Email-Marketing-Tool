import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LEGAL_DOCS } from './legalData';
import { ChevronDown, Menu, X, Mail } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '../../stores/auth.store';
import { FEATURES, SITE } from './siteData';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/features', label: 'Features', menu: true },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={clsx('flex items-center', className)}>
      <img src="/brand/logo.png" alt="Rabbit Growth" className="h-8 w-auto" />
    </Link>
  );
}

function FeaturesMenu() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.15 }}
      // framer-motion owns the transform, so centring must go through x rather than a translate class
      style={{ x: '-50%' }}
      className="absolute left-1/2 top-full w-[640px] pt-3"
    >
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 backdrop-blur-xl">
        {FEATURES.map((f) => (
          <Link key={f.slug} to={`/features/${f.slug}`} className="group flex gap-3 rounded-xl p-3 transition hover:bg-slate-50">
            <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br', f.gradient)}>
              <f.icon className="h-[18px] w-[18px] text-white" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-slate-900">{f.name}</span>
              <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-slate-600">{f.short}</span>
            </span>
          </Link>
        ))}
        <Link to="/features" className="col-span-2 mt-1 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-center text-xs font-medium text-brand-700 hover:bg-slate-50">
          See all features
        </Link>
      </div>
    </motion.div>
  );
}

function Header() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [location.pathname]);

  return (
    <header className={clsx(
      'fixed inset-x-0 top-0 z-50 transition-all duration-300',
      scrolled || mobileOpen ? 'border-b border-slate-200 bg-white/80 backdrop-blur-xl' : 'bg-transparent',
    )}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-20">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => item.menu ? (
            <div key={item.to} className="relative" onMouseEnter={() => setMenuOpen(true)} onMouseLeave={() => setMenuOpen(false)}>
              <NavLink
                to={item.to}
                className={({ isActive }) => clsx('flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-medium transition', isActive ? 'text-slate-900' : 'text-slate-700 hover:text-brand-700')}
                onFocus={() => setMenuOpen(true)}
              >
                {item.label}
                <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', menuOpen && 'rotate-180')} />
              </NavLink>
              <AnimatePresence>{menuOpen && <FeaturesMenu />}</AnimatePresence>
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) => clsx('rounded-lg px-4 py-2 text-sm font-medium transition', isActive ? 'text-slate-900' : 'text-slate-700 hover:text-brand-700')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <Link to="/login-redirect" className="text-sm font-medium text-slate-700 hover:text-brand-700">Open dashboard</Link>
          ) : (
            <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-brand-700">Log in</Link>
          )}
          <Link to="/register" className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700">
            Book a demo
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-slate-200 bg-white lg:hidden"
          >
            <div className="max-h-[calc(100vh-4rem)] space-y-1 overflow-y-auto px-6 py-4">
              {NAV.map((item) => (
                <div key={item.to}>
                  <NavLink to={item.to} end className={({ isActive }) => clsx('block rounded-lg px-3 py-2.5 text-base font-medium', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700')}>
                    {item.label}
                  </NavLink>
                  {item.menu && (
                    <div className="grid grid-cols-2 gap-1 pb-2 pl-3">
                      {FEATURES.map((f) => (
                        <Link key={f.slug} to={`/features/${f.slug}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-600">
                          <f.icon className="h-4 w-4 shrink-0" /> {f.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <Link to={isAuthenticated ? '/login-redirect' : '/login'} className="rounded-xl border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-900">
                  {isAuthenticated ? 'Dashboard' : 'Log in'}
                </Link>
                <Link to="/register" className="rounded-xl bg-brand-600 px-4 py-3 text-center text-sm font-semibold text-white">Book a demo</Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function Footer() {
  return (
    <footer className="relative border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600">
            The AI-powered all-in-one marketing platform. Email, WhatsApp, social, automation and analytics in one place, with Rabbit AI helping you write, reply and grow.
          </p>
          <div className="mt-6 space-y-2 text-sm text-slate-600">
            <a href={`mailto:${SITE.email}`} className="flex items-center gap-2 hover:text-brand-700"><Mail className="h-4 w-4" /> {SITE.email}</a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Features</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FEATURES.slice(0, 5).map((f) => (
              <li key={f.slug}><Link to={`/features/${f.slug}`} className="text-slate-600 hover:text-brand-700">{f.name}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">More</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FEATURES.slice(5).map((f) => (
              <li key={f.slug}><Link to={`/features/${f.slug}`} className="text-slate-600 hover:text-brand-700">{f.name}</Link></li>
            ))}
            <li><Link to="/features" className="text-slate-600 hover:text-brand-700">All features</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Company</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/about" className="text-slate-600 hover:text-brand-700">About us</Link></li>
            <li><Link to="/contact" className="text-slate-600 hover:text-brand-700">Contact</Link></li>
            <li><Link to="/register" className="text-slate-600 hover:text-brand-700">Book a demo</Link></li>
            <li><Link to="/login" className="text-slate-600 hover:text-brand-700">Customer login</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
          <ul className="mt-4 space-y-2.5 text-sm">
            {LEGAL_DOCS.map((d) => (
              <li key={d.slug}><Link to={`/legal/${d.slug}`} className="text-slate-600 hover:text-brand-700">{d.title.replace(' and Anti-Spam Policy','')}</Link></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-slate-500 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p>Made for growing businesses.</p>
        </div>
      </div>
    </footer>
  );
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 antialiased selection:bg-brand-100 selection:text-brand-900">
      <Header />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
