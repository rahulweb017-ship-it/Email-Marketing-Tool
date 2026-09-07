import { useMemo } from 'react';
import { Check, X, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface SpamScoreCheckerProps {
  bodyHtml: string;
}

interface CheckResult {
  label: string;
  passed: boolean;
  detail: string;
}

const SPAM_WORDS = [
  'free', 'winner', 'congratulations', 'urgent', 'act now', 'limited time',
  'buy now', 'order now', 'click here', 'subscribe', 'no obligation',
  'risk-free', 'guarantee', 'no cost', 'cash', 'credit', 'discount',
  'double your', 'earn money', 'extra income', 'make money', 'million',
  'investment', 'lowest price', 'bargain', 'cheap', 'clearance',
  'compare rates', 'offer', 'deal', 'promotion', 'save big',
  'act immediately', 'apply now', 'call now', 'don\'t delete',
  'don\'t hesitate', 'for free', 'get it now', 'once in a lifetime',
  'special promotion', 'while supplies last', 'you have been selected',
  'important information', 'information you requested', 'dear friend',
  'increase your', 'incredible deal', 'prize', 'reward', 'bonus',
];

function analyzeSpam(html: string): { score: number; checks: CheckResult[] } {
  const checks: CheckResult[] = [];
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ');
  const lowerText = text.toLowerCase();

  // 1. Check for ALL CAPS words (3+ char words)
  const words = text.split(/\s+/).filter((w) => w.length >= 3);
  const capsWords = words.filter((w) => w === w.toUpperCase() && /[A-Z]/.test(w));
  const capsRatio = words.length > 0 ? capsWords.length / words.length : 0;
  checks.push({
    label: 'Excessive ALL CAPS',
    passed: capsRatio < 0.15,
    detail: capsRatio < 0.15 ? 'Low use of caps' : `${Math.round(capsRatio * 100)}% of words are ALL CAPS`,
  });

  // 2. Check for spam trigger words
  const foundSpamWords = SPAM_WORDS.filter((w) => lowerText.includes(w));
  checks.push({
    label: 'Spam trigger words',
    passed: foundSpamWords.length <= 2,
    detail: foundSpamWords.length <= 2
      ? `${foundSpamWords.length} trigger word(s) found`
      : `${foundSpamWords.length} trigger words: ${foundSpamWords.slice(0, 3).join(', ')}...`,
  });

  // 3. Excessive exclamation marks
  const exclCount = (text.match(/!/g) || []).length;
  checks.push({
    label: 'Exclamation marks',
    passed: exclCount <= 3,
    detail: exclCount <= 3 ? `${exclCount} found` : `${exclCount} found (keep under 3)`,
  });

  // 4. Unsubscribe link
  const hasUnsub = /unsubscribe/i.test(html) || /\{\{unsubscribe_url\}\}/.test(html);
  checks.push({
    label: 'Unsubscribe link',
    passed: hasUnsub,
    detail: hasUnsub ? 'Present' : 'Missing — required by anti-spam laws',
  });

  // 5. Image-to-text ratio
  const imgCount = (html.match(/<img\b/gi) || []).length;
  const textLength = text.trim().length;
  const goodRatio = textLength > 100 || imgCount === 0;
  checks.push({
    label: 'Text-to-image ratio',
    passed: goodRatio,
    detail: goodRatio ? `${textLength} chars, ${imgCount} image(s)` : 'Too many images, not enough text',
  });

  // 6. Missing alt text on images
  const imgsWithoutAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) || []).length;
  checks.push({
    label: 'Image alt text',
    passed: imgsWithoutAlt === 0,
    detail: imgsWithoutAlt === 0 ? 'All images have alt text' : `${imgsWithoutAlt} image(s) missing alt text`,
  });

  // 7. Excessive links
  const linkCount = (html.match(/<a\b/gi) || []).length;
  checks.push({
    label: 'Link count',
    passed: linkCount <= 10,
    detail: linkCount <= 10 ? `${linkCount} link(s)` : `${linkCount} links (keep under 10)`,
  });

  // 8. Subject/content length
  const tooShort = textLength < 50;
  checks.push({
    label: 'Content length',
    passed: !tooShort,
    detail: tooShort ? 'Very short content may trigger spam filters' : `${textLength} characters`,
  });

  // Calculate score (0-10, lower is better)
  const failCount = checks.filter((c) => !c.passed).length;
  const score = Math.min(10, Math.round((failCount / checks.length) * 10 * 1.2));

  return { score, checks };
}

export default function SpamScoreChecker({ bodyHtml }: SpamScoreCheckerProps) {
  const { score, checks } = useMemo(() => analyzeSpam(bodyHtml), [bodyHtml]);

  const color = score <= 3 ? 'text-green-500' : score <= 6 ? 'text-amber-500' : 'text-red-500';
  const bgColor = score <= 3 ? 'bg-green-50' : score <= 6 ? 'bg-amber-50' : 'bg-red-50';
  const ringColor = score <= 3 ? 'stroke-green-500' : score <= 6 ? 'stroke-amber-500' : 'stroke-red-500';
  const label = score <= 3 ? 'Low Risk' : score <= 6 ? 'Medium Risk' : 'High Risk';

  const circumference = 2 * Math.PI * 30;
  const dashOffset = circumference - (score / 10) * circumference;

  return (
    <div className={clsx('rounded-lg border p-4', bgColor)}>
      <div className="flex items-center gap-4">
        {/* Circular score indicator */}
        <div className="relative flex-shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" fill="none" stroke="#e5e7eb" strokeWidth="5" />
            <circle
              cx="36" cy="36" r="30" fill="none"
              className={ringColor}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 36 36)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={clsx('text-lg font-bold', color)}>{score}</span>
            <span className="text-[9px] text-gray-500">/10</span>
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className={clsx('h-4 w-4', color)} />
            <span className={clsx('text-sm font-semibold', color)}>{label}</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {score <= 3
              ? 'Your email looks good for deliverability.'
              : score <= 6
                ? 'Consider fixing some issues to improve deliverability.'
                : 'Your email may be flagged as spam. Fix issues below.'}
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="mt-3 space-y-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-2 text-xs">
            {check.passed ? (
              <Check className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            ) : (
              <X className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
            <span className={check.passed ? 'text-gray-600' : 'text-gray-800 font-medium'}>
              {check.label}
            </span>
            <span className="text-gray-400 ml-auto">{check.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
