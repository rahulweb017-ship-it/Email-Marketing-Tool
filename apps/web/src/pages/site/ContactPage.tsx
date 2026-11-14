import { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, Clock, MessageCircle, Send, CheckCircle2, Loader2 } from 'lucide-react';
import SiteLayout from '../../components/site/SiteLayout';
import { Field, GradientText, inputClass, PageHero, Reveal, usePageTitle } from '../../components/site/ui';
import { SITE } from '../../components/site/siteData';
import { submitEnquiry, enquiryErrorMessage } from '../../api/enquiries';

const empty = { name: '', email: '', phone: '', company: '', subject: '', message: '', fax_number: '' };

export default function ContactPage() {
  usePageTitle('Contact us');
  const [form, setForm] = useState(empty);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSending(true);
    try {
      await submitEnquiry({ type: 'contact', ...form, source_page: '/contact' });
      setSent(true);
      setForm(empty);
    } catch (err) {
      setError(enquiryErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const cards = [
    { icon: Mail, label: 'Email us', value: SITE.email, href: `mailto:${SITE.email}` },
    { icon: Phone, label: 'Call us', value: SITE.phone, href: `tel:${SITE.phone.replace(/\s/g, '')}` },
    { icon: MessageCircle, label: 'WhatsApp', value: SITE.whatsapp, href: `https://wa.me/${SITE.whatsapp.replace(/\D/g, '')}` },
    { icon: MapPin, label: 'Visit us', value: SITE.address },
    { icon: Clock, label: 'Working hours', value: SITE.hours },
  ];

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Contact"
        title={<>We would love to <GradientText>hear from you</GradientText></>}
        subtitle="Questions about features, pricing or setup? Send us a message and we will reply within one business day."
      />

      <section className="px-6 pb-24">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1fr_1.4fr]">
          <Reveal className="space-y-4">
            {cards.map((c) => {
              const body = (
                <>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-rose-500/20 text-brand-700">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">{c.label}</span>
                    <span className="mt-0.5 block text-sm text-slate-900">{c.value}</span>
                  </span>
                </>
              );
              return c.href ? (
                <a key={c.label} href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer"
                  className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-300 hover:bg-slate-50">
                  {body}
                </a>
              ) : (
                <div key={c.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">{body}</div>
              );
            })}
          </Reveal>

          <Reveal delay={0.1}>
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 backdrop-blur-xl sm:p-10">
              <div aria-hidden className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-rose-600/20 blur-3xl" />
              {sent ? (
                <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative py-16 text-center">
                  <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
                  <h2 className="mt-5 font-display text-2xl font-bold text-slate-900">Message sent</h2>
                  <p className="mx-auto mt-3 max-w-sm text-slate-600">Thank you for reaching out. Our team will reply within one business day.</p>
                  <button type="button" onClick={() => setSent(false)} className="mt-8 text-sm font-medium text-brand-600 hover:text-brand-800">Send another message</button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="relative space-y-5">
                  <h2 className="font-display text-2xl font-bold text-slate-900">Send us a message</h2>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Your name" required><input className={inputClass} value={form.name} onChange={set('name')} required minLength={2} maxLength={150} autoComplete="name" /></Field>
                    <Field label="Email" required><input type="email" className={inputClass} value={form.email} onChange={set('email')} required maxLength={255} autoComplete="email" /></Field>
                    <Field label="Phone"><input type="tel" className={inputClass} value={form.phone} onChange={set('phone')} maxLength={40} autoComplete="tel" /></Field>
                    <Field label="Company"><input className={inputClass} value={form.company} onChange={set('company')} maxLength={200} autoComplete="organization" /></Field>
                  </div>
                  <Field label="Subject"><input className={inputClass} value={form.subject} onChange={set('subject')} maxLength={200} placeholder="How can we help?" /></Field>
                  <Field label="Message" required>
                    <textarea className={`${inputClass} min-h-[140px] resize-y`} value={form.message} onChange={set('message')} required maxLength={5000} placeholder="Tell us a little about what you need" />
                  </Field>
                  {/* Honeypot: hidden from people, filled in by bots */}
                  <input type="text" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.fax_number} onChange={set('fax_number')} name="fax_number" />
                  {error && <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 via-brand-500 to-rose-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:brightness-110 disabled:opacity-60 sm:w-auto"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending ? 'Sending...' : 'Send message'}
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </section>
    </SiteLayout>
  );
}
