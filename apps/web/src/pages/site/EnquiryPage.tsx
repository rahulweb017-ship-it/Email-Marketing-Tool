import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Sparkles, CalendarCheck, MessageSquare, Rocket, Check } from 'lucide-react';
import clsx from 'clsx';
import SiteLayout from '../../components/site/SiteLayout';
import { Backdrop, Eyebrow, Field, GradientText, inputClass, Reveal, usePageTitle } from '../../components/site/ui';
import { ENQUIRY_INTERESTS, SITE } from '../../components/site/siteData';
import { submitEnquiry, enquiryErrorMessage } from '../../api/enquiries';

const SIZES = ['Just me', '2 to 10', '11 to 50', '51 to 200', '200+'];
const VOLUMES = ['Under 5,000', '5,000 to 25,000', '25,000 to 1 lakh', '1 lakh to 5 lakh', 'Over 5 lakh', 'Not sure yet'];

const empty = {
  name: '', email: '', phone: '', company: '', website: '', company_size: '', monthly_volume: '', message: '', fax_number: '',
};

const STEPS = [
  { icon: MessageSquare, title: 'We get in touch', text: 'A specialist contacts you within one business day.' },
  { icon: CalendarCheck, title: 'Personal demo', text: 'We show you the platform using your own use case.' },
  { icon: Rocket, title: 'Launch together', text: 'We set up your account and help import your contacts.' },
];

export default function EnquiryPage() {
  usePageTitle('Book a demo');
  const [form, setForm] = useState(empty);
  const [interests, setInterests] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const toggle = (value: string) =>
    setInterests((list) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await submitEnquiry({ type: 'registration', ...form, interests, source_page: '/register' });
      setSent(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(enquiryErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <SiteLayout>
      <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40">
        <Backdrop />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.25fr]">
          <Reveal>
            <Eyebrow>Free demo, no obligation</Eyebrow>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              Let’s grow your business <GradientText>with AI</GradientText>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              Tell us a little about your business. We will show you how {SITE.name} can bring in more customers through email, WhatsApp and social media.
            </p>

            <div className="mt-10 space-y-6">
              {STEPS.map((s, i) => (
                <div key={s.title} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-brand-700"><s.icon className="h-5 w-5" /></span>
                    {i < STEPS.length - 1 && <span className="mt-2 h-full w-px bg-gradient-to-b from-brand-400/40 to-transparent" />}
                  </div>
                  <div className="pb-2">
                    <p className="font-semibold text-slate-900">{s.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-10 text-sm text-slate-500">
              Already a customer? <Link to="/login" className="font-medium text-brand-600 hover:text-brand-800">Log in here</Link>
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-brand-900/10 backdrop-blur-xl sm:p-10">
              <div aria-hidden className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-600/25 blur-3xl" />
              {sent ? (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative py-16 text-center">
                  <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" />
                  <h2 className="mt-6 font-display text-3xl font-bold text-slate-900">Thank you, {form.name.split(' ')[0] || 'friend'}!</h2>
                  <p className="mx-auto mt-3 max-w-sm text-slate-600">
                    We have received your details. A member of our team will contact you within one business day to schedule your demo.
                  </p>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link to="/features" className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50">Explore features</Link>
                    <Link to="/" className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Back to home</Link>
                  </div>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="relative space-y-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-rose-600" />
                    <h2 className="font-display text-2xl font-bold text-slate-900">Request your demo</h2>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Full name" required><input className={inputClass} value={form.name} onChange={set('name')} required minLength={2} maxLength={150} autoComplete="name" /></Field>
                    <Field label="Work email" required><input type="email" className={inputClass} value={form.email} onChange={set('email')} required maxLength={255} autoComplete="email" /></Field>
                    <Field label="Phone / WhatsApp"><input type="tel" className={inputClass} value={form.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" placeholder="+91" /></Field>
                    <Field label="Company name"><input className={inputClass} value={form.company} onChange={set('company')} maxLength={200} autoComplete="organization" /></Field>
                    <Field label="Website"><input className={inputClass} value={form.website} onChange={set('website')} maxLength={255} placeholder="www.example.com" /></Field>
                    <Field label="Team size">
                      <select className={clsx(inputClass, 'appearance-none')} value={form.company_size} onChange={set('company_size')}>
                        <option value="" className="bg-slate-50">Select</option>
                        {SIZES.map((s) => <option key={s} value={s} className="bg-slate-50">{s}</option>)}
                      </select>
                    </Field>
                  </div>

                  <Field label="Messages you send per month">
                    <select className={clsx(inputClass, 'appearance-none')} value={form.monthly_volume} onChange={set('monthly_volume')}>
                      <option value="" className="bg-slate-50">Select</option>
                      {VOLUMES.map((s) => <option key={s} value={s} className="bg-slate-50">{s}</option>)}
                    </select>
                  </Field>

                  <div>
                    <span className="mb-2 block text-sm font-medium text-slate-700">What are you interested in?</span>
                    <div className="flex flex-wrap gap-2">
                      {ENQUIRY_INTERESTS.map((it) => {
                        const on = interests.includes(it.value);
                        return (
                          <button
                            key={it.value}
                            type="button"
                            onClick={() => toggle(it.value)}
                            aria-pressed={on}
                            className={clsx(
                              'flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium transition',
                              on ? 'border-brand-400/60 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-300',
                            )}
                          >
                            {on && <Check className="h-3.5 w-3.5" />} {it.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <Field label="Anything else we should know?">
                    <textarea className={`${inputClass} min-h-[110px] resize-y`} value={form.message} onChange={set('message')} maxLength={5000} placeholder="Your goals, current tools, timeline..." />
                  </Field>

                  <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.fax_number} onChange={set('fax_number')} name="fax_number" />

                  {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 via-brand-500 to-rose-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {sending ? 'Sending...' : 'Book my free demo'}
                  </button>
                  <p className="text-center text-xs text-slate-500">We only use your details to contact you about {SITE.name}. No spam.</p>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
