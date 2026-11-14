import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, Bot, CheckCheck, Upload, Palette, Workflow, TrendingUp, ShieldCheck, Gauge, Lock, HeartHandshake,
  ChevronDown, Mail, MessageCircle, Share2, ArrowUpRight, UserCheck, Zap, PenLine, BarChart3, Layers, Flame,
  ImageIcon, MessagesSquare, Inbox,
} from 'lucide-react';
import clsx from 'clsx';
import SiteLayout from '../../components/site/SiteLayout';
import {
  Backdrop, ComingSoonBadge, CtaBanner, Eyebrow, GradientText, PrimaryButton, Reveal, SecondaryButton, SectionHeading, usePageTitle,
} from '../../components/site/ui';
import { AI_ROADMAP, FEATURES } from '../../components/site/siteData';

const CHATS = [
  {
    customer: 'Hi! Do you deliver to Pune? Any Diwali offer running?',
    reply: 'Yes, we deliver to Pune in 2 to 3 days. Our Diwali offer is 20% off everything until Sunday. Shall I send you the catalogue?',
  },
  {
    customer: 'Can I change the size of my order #4512?',
    reply: 'Of course. Your order has not shipped yet, so I can change it now. Which size would you like instead?',
  },
  {
    customer: 'What time does your store close today?',
    reply: 'We are open until 9 PM today. You can also order online any time and pick it up tomorrow.',
  },
];

function useTypewriter(text: string, active: boolean, speed = 22) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!active) { setOut(''); return; }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, active, speed]);
  return out;
}

function AiChatDemo() {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<'customer' | 'thinking' | 'reply'>('customer');
  const chat = CHATS[index];
  const typed = useTypewriter(chat.reply, phase === 'reply');

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    setPhase('customer');
    timers.push(setTimeout(() => setPhase('thinking'), 1100));
    timers.push(setTimeout(() => setPhase('reply'), 2600));
    timers.push(setTimeout(() => setIndex((i) => (i + 1) % CHATS.length), 2600 + chat.reply.length * 22 + 3200));
    return () => timers.forEach(clearTimeout);
  }, [index, chat.reply.length]);

  return (
    <div className="relative rounded-3xl border border-white/10 bg-slate-900/70 p-1.5 shadow-2xl shadow-indigo-950/60 backdrop-blur-xl">
      <div className="rounded-[20px] border border-white/5 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300"><MessageCircle className="h-[18px] w-[18px]" /></span>
            <div>
              <p className="text-sm font-semibold text-white">WhatsApp inbox</p>
              <p className="flex items-center gap-1.5 text-xs text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> AI assistant is on</p>
            </div>
          </div>
          <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-medium text-fuchsia-200">Live demo</span>
        </div>

        <div className="h-[300px] space-y-3 overflow-hidden px-5 py-5 sm:h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.07] px-4 py-2.5 text-sm text-slate-100">
                {chat.customer}
              </motion.div>

              {phase === 'thinking' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto flex w-fit items-center gap-2 rounded-2xl rounded-tr-sm border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-xs text-indigo-200">
                  <Sparkles className="h-3.5 w-3.5" /> Reading your knowledge base
                  <span className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.span key={d} className="h-1.5 w-1.5 rounded-full bg-indigo-300" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />
                    ))}
                  </span>
                </motion.div>
              )}

              {phase === 'reply' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm text-white shadow-lg shadow-indigo-500/20">
                  {typed}
                  {typed.length < chat.reply.length && <span className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-pulse bg-white/80" />}
                  {typed.length >= chat.reply.length && (
                    <span className="mt-1 flex items-center justify-end gap-1 text-[10px] text-indigo-100/80">
                      <Bot className="h-3 w-3" /> Sent by AI <CheckCheck className="h-3 w-3" />
                    </span>
                  )}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2 border-t border-white/5 px-5 py-3.5 text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Unsure questions are handed to your team automatically
        </div>
      </div>
    </div>
  );
}

function FloatingStat({ className, icon: Icon, title, value, tone }: {
  className: string; icon: typeof Mail; title: string; value: string; tone: string;
}) {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      className={clsx('absolute hidden items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-xl backdrop-blur-xl sm:flex', className)}
    >
      <span className={clsx('flex h-9 w-9 items-center justify-center rounded-xl', tone)}><Icon className="h-4 w-4 text-white" /></span>
      <span>
        <span className="block text-[11px] text-slate-400">{title}</span>
        <span className="block text-sm font-semibold text-white">{value}</span>
      </span>
    </motion.div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 lg:pb-28">
      <Backdrop />
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 lg:grid-cols-[1.05fr_1fr]">
        <Reveal>
          <Eyebrow>New: AI segments, automations and campaign insights</Eyebrow>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl">
            The <GradientText className="whitespace-nowrap">AI-powered</GradientText> all-in-one marketing platform
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Email, WhatsApp, social publishing, automation, contacts and analytics in one place. Rabbit AI writes your campaigns, replies to customers around the clock and helps you grow, all from one simple dashboard.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryButton to="/register">Book a free demo</PrimaryButton>
            <SecondaryButton to="/features">Explore features</SecondaryButton>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
            {[
              [Mail, 'Email'],
              [MessageCircle, 'WhatsApp'],
              [Share2, 'Social'],
              [Workflow, 'Automation'],
              [Sparkles, 'Rabbit AI'],
            ].map(([Icon, label]) => {
              const I = Icon as typeof Mail;
              return <span key={label as string} className="flex items-center gap-2"><I className="h-4 w-4 text-indigo-300" /> {label as string}</span>;
            })}
          </div>
        </Reveal>

        <Reveal delay={0.15} className="relative mx-auto w-full max-w-lg">
          <div aria-hidden className="absolute -inset-6 rounded-[40px] bg-gradient-to-tr from-indigo-500/20 via-fuchsia-500/10 to-cyan-400/20 blur-2xl" />
          <AiChatDemo />
          <FloatingStat className="-left-12 bottom-20" icon={TrendingUp} title="Sample campaign" value="Opens rising" tone="bg-gradient-to-br from-rose-500 to-pink-500" />
          <FloatingStat className="-right-6 -top-8" icon={Workflow} title="Welcome series" value="Running on autopilot" tone="bg-gradient-to-br from-amber-500 to-orange-500" />
        </Reveal>
      </div>
    </section>
  );
}

function Channels() {
  const items = [
    { icon: Mail, label: 'Email', text: 'Drag-and-drop campaigns, templates and A/B tests', tone: 'text-indigo-300' },
    { icon: MessageCircle, label: 'WhatsApp', text: 'Official API or QR-linked numbers, with a shared inbox', tone: 'text-emerald-300' },
    { icon: Share2, label: 'Social', text: 'Schedule posts for X, Facebook and LinkedIn', tone: 'text-sky-300' },
    { icon: Workflow, label: 'Automation', text: 'Visual journeys that follow up on their own', tone: 'text-amber-300' },
    { icon: BarChart3, label: 'Analytics', text: 'Opens, clicks and replies across every channel', tone: 'text-rose-300' },
    { icon: Sparkles, label: 'Rabbit AI', text: 'Writes, suggests and replies in your brand voice', tone: 'text-fuchsia-300' },
  ];
  return (
    <section className="relative border-y border-white/5 bg-white/[0.02]">
      <div className="mx-auto grid max-w-7xl gap-px px-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <Reveal key={it.label} delay={i * 0.05} className="flex items-start gap-4 px-2 py-8 lg:px-6">
            <it.icon className={clsx('mt-0.5 h-6 w-6 shrink-0', it.tone)} />
            <div>
              <p className="font-semibold text-white">{it.label}</p>
              <p className="mt-1 text-sm text-slate-400">{it.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="relative px-6 py-24 sm:py-28">
      <SectionHeading
        eyebrow="All-in-one"
        title={<>One platform. <GradientText>Every channel. AI everywhere.</GradientText></>}
        subtitle="Stop paying for five different tools. Rabbit Growth brings your contacts, campaigns, chats, posts and results together, with AI built into each one."
      />
      <div className="mx-auto mt-14 grid max-w-7xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => (
          <Reveal key={f.slug} delay={(i % 4) * 0.06}>
            <Link
              to={`/features/${f.slug}`}
              className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div aria-hidden className={clsx('absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-0 blur-2xl transition group-hover:opacity-30', f.gradient)} />
              <span className={clsx('flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br shadow-lg', f.gradient)}>
                <f.icon className="h-5 w-5 text-white" />
              </span>
              <h3 className="mt-5 font-semibold text-white">{f.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-400">{f.short}</p>
              <span className="mt-5 flex items-center gap-1 text-sm font-medium text-indigo-300 group-hover:text-indigo-200">
                Learn more <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </span>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function AiOrb() {
  const orbit = [Mail, MessageCircle, PenLine, Share2, UserCheck, Zap];
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div aria-hidden className="absolute inset-[18%] rounded-full bg-gradient-to-br from-indigo-500 via-fuchsia-500 to-cyan-400 opacity-60 blur-3xl" />
      <motion.div
        className="absolute inset-[30%] flex items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-indigo-500 via-violet-600 to-fuchsia-600 shadow-[0_0_80px_rgba(168,85,247,0.45)]"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Sparkles className="h-14 w-14 text-white" />
      </motion.div>
      <div className="absolute inset-[8%] rounded-full border border-dashed border-white/10" />
      <motion.div className="absolute inset-[8%]" animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}>
        {orbit.map((Icon, i) => {
          const angle = (i / orbit.length) * Math.PI * 2;
          return (
            <motion.span
              key={i}
              className="absolute flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/90 shadow-lg"
              style={{ left: `${50 + 50 * Math.cos(angle)}%`, top: `${50 + 50 * Math.sin(angle)}%` }}
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            >
              <Icon className="h-5 w-5 text-indigo-200" />
            </motion.span>
          );
        })}
      </motion.div>
    </div>
  );
}

function AiSection() {
  const points = [
    { icon: MessagesSquare, title: 'Your marketing copilot', text: 'Ask how things are going and get answers from your real numbers, plus drafts you create in one click.' },
    { icon: PenLine, title: 'Writes your emails', text: 'Turn a one-line brief into a complete email, plus subject lines with scores.' },
    { icon: Share2, title: 'Writes your posts', text: 'One idea becomes a post for X, Facebook and LinkedIn, sized for each.' },
    { icon: ImageIcon, title: 'Creates your images', text: 'Describe a banner or post image and get it in seconds, saved to your media library.' },
    { icon: Bot, title: 'Replies 24/7', text: 'Answers WhatsApp questions instantly, even at night and on holidays.' },
    { icon: Workflow, title: 'Builds segments and journeys', text: 'Describe an audience or a follow-up sequence in plain words and get it ready to review.' },
    { icon: BarChart3, title: 'Explains your results', text: 'Every campaign summarised in plain language, with what to try next.' },
    { icon: Flame, title: 'Sorts your inbox', text: 'WhatsApp chats labelled by topic and mood, with hot leads flagged first.' },
    { icon: Inbox, title: 'Qualifies your leads', text: 'Leads from every channel scored hot, warm or cold, with a follow-up ready to send.' },
    { icon: TrendingUp, title: 'Predicts who will drift', text: 'Churn risk for every contact, so you win people back before they go quiet.' },
    { icon: Layers, title: 'One brand voice', text: 'Describe your business once. Every AI feature writes like your brand.' },

    { icon: UserCheck, title: 'Knows when to hand over', text: 'Tricky or sensitive chats go to your team, with the full history.' },
  ];
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-28">
      <Backdrop variant="soft" />
      <div className="relative mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-2">
        <Reveal><AiOrb /></Reveal>
        <div>
          <SectionHeading
            center={false}
            eyebrow="AI at the core"
            title={<>Meet <GradientText>Rabbit AI</GradientText>, your AI marketing team</>}
            subtitle="Powered by Claude, Rabbit AI works across email, WhatsApp and social. It handles the busy work so your team can focus on customers who need a personal touch."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {points.map((p, i) => (
              <Reveal key={p.title} delay={i * 0.06} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p.icon className="h-5 w-5 text-fuchsia-300" />
                <h3 className="mt-3 font-semibold text-white">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{p.text}</p>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.2} className="mt-8">
            <Link to="/features/ai-assistant" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-300 hover:text-indigo-200">
              See what Rabbit AI can do <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function AiRoadmap() {
  return (
    <section className="relative px-6 pb-24 sm:pb-28">
      <SectionHeading
        eyebrow="What's next"
        title={<>More AI, <GradientText>coming soon</GradientText></>}
        subtitle="We ship new AI features every few weeks. Here is what we are building now."
      />
      <div className="mx-auto mt-12 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AI_ROADMAP.map((r, i) => (
          <Reveal key={r.title} delay={(i % 3) * 0.05} className="h-full">
            <div className="h-full rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-white">{r.title}</h3>
                <ComingSoonBadge />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{r.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { icon: Upload, title: 'Bring your contacts', text: 'Upload a spreadsheet. Columns are matched and common mistakes are fixed for you.' },
    { icon: Palette, title: 'Create with AI', text: 'Describe your offer and Rabbit AI drafts the email or post. Fine-tune it with drag and drop.' },
    { icon: Workflow, title: 'Automate the follow-up', text: 'Set up welcome series and reminders once. The AI answers WhatsApp replies.' },
    { icon: TrendingUp, title: 'Watch it grow', text: 'See opens, clicks and replies live, then repeat what works.' },
  ];
  return (
    <section className="relative px-6 py-24 sm:py-28">
      <SectionHeading eyebrow="How it works" title="From spreadsheet to sales in four steps" subtitle="No coding and no design skills needed. Most teams send their first campaign on day one." />
      <div className="relative mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-4">
        <div aria-hidden className="absolute left-[12%] right-[12%] top-7 hidden h-px bg-gradient-to-r from-indigo-500/0 via-indigo-400/50 to-fuchsia-500/0 md:block" />
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.08} className="relative text-center">
            <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-slate-900 shadow-lg shadow-indigo-500/10">
              <s.icon className="h-6 w-6 text-indigo-200" />
              <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-xs font-bold text-white">{i + 1}</span>
            </span>
            <h3 className="mt-5 font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{s.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function WhyUs() {
  const items = [
    { icon: Gauge, title: 'Simple to use', text: 'A clean dashboard your whole team can learn in an afternoon.' },
    { icon: ShieldCheck, title: 'Safe sending', text: 'Consent checks, opt-out handling, pacing and auto-pause protect your sender reputation.' },
    { icon: Lock, title: 'Your data stays yours', text: 'Every business’s data is kept separate. Tracking links are signed so they cannot be faked.' },
    { icon: HeartHandshake, title: 'Real people to help', text: 'We help you set up, import your contacts and launch your first campaign.' },
  ];
  return (
    <section className="relative px-6 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-8 sm:p-12">
        <SectionHeading eyebrow="Why Rabbit Growth" title="Built for growing businesses" subtitle="Powerful enough for agencies, simple enough for a shop owner." />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 0.06}>
              <it.icon className="h-6 w-6 text-cyan-300" />
              <h3 className="mt-4 font-semibold text-white">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{it.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQS = [
  { q: 'What is Rabbit Growth?', a: 'Rabbit Growth is an AI-powered all-in-one marketing platform. Email campaigns, WhatsApp marketing, social publishing, automation, contacts and analytics live in one place, and Rabbit AI writes content and replies to customers in your brand voice.' },
  { q: 'Which tools can Rabbit Growth replace?', a: 'Most teams use it instead of a separate email tool, a WhatsApp sender, a social scheduler, an automation tool and an AI writing tool. Your contacts and results stay in one place.' },
  { q: 'Do I need technical or design skills?', a: 'No. You can build emails with drag and drop, start from ready-made templates and import contacts from a spreadsheet. We also help you set everything up.' },
  { q: 'Is WhatsApp sending safe for my number?', a: 'For bulk sending we recommend the official WhatsApp Business (Meta Cloud) API. You can also link a number by QR code, which is not official WhatsApp tooling and carries a risk of the number being restricted, so we add pacing, daily limits, quiet hours and auto-pause to reduce that risk.' },
  { q: 'How does Rabbit AI work?', a: 'It uses Claude, an AI model by Anthropic, together with the brand voice and business information you give it. It writes emails, subject lines, social posts and WhatsApp messages, suggests replies and answers common questions. When it is unsure, the chat is handed to your team. Each plan includes monthly AI credits.' },
  { q: 'Can I bring my existing contacts?', a: 'Yes. Upload any CSV file. Columns are matched automatically, and contacts can have an email address, a phone number or both.' },
  { q: 'How do I get started?', a: 'Fill in the short demo form. We will contact you, show you the platform with your own use case and set up your account.' },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="relative px-6 py-24 sm:py-28">
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />
      <div className="mx-auto mt-12 max-w-3xl space-y-3">
        {FAQS.map((f, i) => (
          <Reveal key={f.q} delay={i * 0.04}>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={open === i}
              >
                <span className="font-medium text-white">{f.q}</span>
                <ChevronDown className={clsx('h-5 w-5 shrink-0 text-slate-400 transition-transform', open === i && 'rotate-180')} />
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <p className="px-6 pb-5 text-sm leading-relaxed text-slate-400">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  usePageTitle('');
  return (
    <SiteLayout>
      <Hero />
      <Channels />
      <FeatureGrid />
      <AiSection />
      <AiRoadmap />
      <HowItWorks />
      <WhyUs />
      <Faq />
      <CtaBanner />
    </SiteLayout>
  );
}
