import { Sparkles, ShieldCheck, Heart, Lightbulb, Target, Users, Rocket, Globe } from 'lucide-react';
import SiteLayout from '../../components/site/SiteLayout';
import { CtaBanner, GradientText, PageHero, Reveal, SectionHeading, usePageTitle } from '../../components/site/ui';
import { SITE } from '../../components/site/siteData';

const VALUES = [
  { icon: Heart, title: 'Customers first', text: 'We build what our customers ask for and help them personally, from setup to their first sale.' },
  { icon: ShieldCheck, title: 'Privacy by design', text: 'Every business’s data is kept separate, and consent and opt-outs are respected everywhere.' },
  { icon: Sparkles, title: 'Responsible AI', text: 'AI should save you time, not take risks. It answers from your facts and hands over when unsure.' },
  { icon: Lightbulb, title: 'Keep it simple', text: 'Powerful tools are useless if nobody can use them. We remove steps wherever we can.' },
];

export default function AboutPage() {
  usePageTitle('About us');
  return (
    <SiteLayout>
      <PageHero
        eyebrow="About us"
        title={<>AI-powered marketing for <GradientText>every business</GradientText></>}
        subtitle={`${SITE.name} is an all-in-one marketing platform. Email, WhatsApp, social, automation and analytics work together, with AI doing the heavy lifting.`}
      />

      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-slate-900">Our story</h2>
            <div className="mt-6 space-y-4 leading-relaxed text-slate-600">
              <p>
                We started {SITE.name} after watching small teams struggle with too many tools: one for email, another for WhatsApp, a third for social posts and spreadsheets to hold it all together.
              </p>
              <p>
                So we built one place for all of it. Contacts, campaigns, chats, posts and results live together. Rabbit AI, our built-in AI, writes emails and posts in your brand voice and answers customers, so your team can focus on the conversations that matter.
              </p>
              <p>
                Today we help shops, service businesses and agencies send better campaigns, reply faster and grow their customer base without needing a marketing department.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.1} className="grid grid-cols-2 gap-4">
            {[
              { icon: Target, title: 'Our mission', text: 'Give every business the marketing power of a big company.' },
              { icon: Rocket, title: 'Our approach', text: 'One platform, AI in every step and real people when you need help.' },
              { icon: Users, title: 'Who we serve', text: 'Shops, service businesses, startups and agencies.' },
              { icon: Globe, title: 'Where we work', text: 'Serving businesses across India and beyond.' },
            ].map((c) => (
              <div key={c.title} className="rounded-2xl border border-slate-200 bg-white p-5">
                <c.icon className="h-5 w-5 text-brand-600" />
                <h3 className="mt-3 font-semibold text-slate-900">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{c.text}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="px-6 py-20">
        <SectionHeading eyebrow="What we believe" title="Our values" />
        <div className="mx-auto mt-12 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.06} className="h-full">
              <div className="h-full rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-transparent p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-rose-500">
                  <v.icon className="h-5 w-5 text-white" />
                </span>
                <h3 className="mt-5 font-semibold text-slate-900">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{v.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="px-6 py-16">
        <Reveal className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-center sm:p-12">
          <Sparkles className="mx-auto h-8 w-8 text-rose-600" />
          <h2 className="mt-4 font-display text-2xl font-bold text-slate-900 sm:text-3xl">How we use AI</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-slate-600">
            Rabbit AI is powered by Claude from Anthropic. It writes from the brand voice and business information you give it, never invents prices or offers, follows reply limits and passes any chat it is unsure about to your team. Every plan includes a clear monthly AI credit allowance, and you can switch the WhatsApp bot off for any number at any time.
          </p>
        </Reveal>
      </section>

      <CtaBanner title="Let’s grow together" subtitle="Tell us about your business. We would love to show you what Rabbit Growth can do." />
    </SiteLayout>
  );
}
