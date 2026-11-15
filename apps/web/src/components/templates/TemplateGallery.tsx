import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Newspaper, Megaphone, Heart, Bell, Calendar, Code } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
  html: string;
}

const starters: StarterTemplate[] = [
  {
    id: 'blank', name: 'Blank Canvas', description: 'Start from scratch', icon: FileText, gradient: 'from-gray-400 to-gray-500',
    html: '',
  },
  {
    id: 'newsletter', name: 'Newsletter', description: 'Weekly or monthly updates', icon: Newspaper, gradient: 'from-blue-500 to-blue-600',
    html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <tr><td style="background:#4f46e5;padding:30px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:28px;">Your Newsletter</h1><p style="color:#c7d2fe;margin:8px 0 0;">Edition #1 — Monthly Update</p></td></tr>
      <tr><td style="padding:30px;"><h2 style="font-size:22px;margin:0 0 12px;">Featured Story</h2><p style="color:#4b5563;line-height:1.6;">Write your main story here. Share news, updates, or insights with your audience.</p></td></tr>
      <tr><td style="padding:0 30px 30px;"><table width="100%"><tr><td width="48%" style="vertical-align:top;"><h3 style="font-size:16px;">Article 1</h3><p style="color:#6b7280;font-size:14px;">Brief description of this article.</p></td><td width="4%"></td><td width="48%" style="vertical-align:top;"><h3 style="font-size:16px;">Article 2</h3><p style="color:#6b7280;font-size:14px;">Brief description of this article.</p></td></tr></table></td></tr>
      <tr><td style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#9ca3af;"><p style="margin:0;">Your Company &bull; 123 Street, City</p><p style="margin:8px 0 0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr>
    </table>`,
  },
  {
    id: 'promotional', name: 'Promotional', description: 'Sales and offers', icon: Megaphone, gradient: 'from-red-500 to-pink-500',
    html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <tr><td style="background:linear-gradient(135deg,#ef4444,#ec4899);padding:40px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:36px;">SPECIAL OFFER</h1><p style="color:#fecdd3;font-size:18px;margin:12px 0 0;">Limited time only</p></td></tr>
      <tr><td style="padding:40px;text-align:center;"><h2 style="font-size:24px;margin:0 0 16px;">Save 30% Today</h2><p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">Don't miss this exclusive offer. Use the code below at checkout.</p><div style="background:#f3f4f6;display:inline-block;padding:12px 24px;border-radius:8px;font-size:20px;font-weight:bold;letter-spacing:2px;">SAVE30</div></td></tr>
      <tr><td style="padding:0 40px 40px;text-align:center;"><a href="#" style="background:#4f46e5;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px;display:inline-block;">Shop Now</a></td></tr>
      <tr><td style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#9ca3af;"><p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr>
    </table>`,
  },
  {
    id: 'welcome', name: 'Welcome', description: 'Onboard new subscribers', icon: Heart, gradient: 'from-emerald-500 to-green-500',
    html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <tr><td style="padding:40px;text-align:center;"><div style="font-size:48px;margin-bottom:16px;">👋</div><h1 style="font-size:28px;margin:0 0 12px;">Welcome Aboard!</h1><p style="color:#4b5563;font-size:16px;line-height:1.6;">We're thrilled to have you. Here's what you can expect from us.</p></td></tr>
      <tr><td style="padding:0 40px 20px;"><table width="100%" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;"><tr><td style="padding:20px;"><h3 style="margin:0 0 8px;">Getting Started</h3><p style="color:#6b7280;margin:0;font-size:14px;">Check out our quick start guide to make the most of your account.</p></td></tr></table></td></tr>
      <tr><td style="padding:0 40px 40px;text-align:center;"><a href="#" style="background:#10b981;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Get Started</a></td></tr>
      <tr><td style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#9ca3af;"><p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr>
    </table>`,
  },
  {
    id: 'announcement', name: 'Announcement', description: 'Product or feature launch', icon: Bell, gradient: 'from-amber-500 to-orange-500',
    html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <tr><td style="background:#f59e0b;padding:30px;text-align:center;"><p style="color:#fff;font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0;">Announcement</p><h1 style="color:#fff;margin:12px 0 0;font-size:28px;">Something New is Here</h1></td></tr>
      <tr><td style="padding:40px;"><p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">We're excited to share our latest update with you. Here's what's new and why it matters.</p><h3 style="font-size:18px;margin:0 0 12px;">What's Changed</h3><ul style="color:#4b5563;line-height:1.8;"><li>Feature one description</li><li>Feature two description</li><li>Feature three description</li></ul></td></tr>
      <tr><td style="padding:0 40px 40px;text-align:center;"><a href="#" style="background:#4f46e5;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Learn More</a></td></tr>
      <tr><td style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#9ca3af;"><p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr>
    </table>`,
  },
  {
    id: 'event', name: 'Event Invite', description: 'Webinars and meetups', icon: Calendar, gradient: 'from-rose-500 to-rose-600',
    html: `<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;">
      <tr><td style="background:linear-gradient(135deg,#7c3aed,#9333ea);padding:40px;text-align:center;"><p style="color:#ddd6fe;font-size:14px;text-transform:uppercase;letter-spacing:2px;margin:0;">You're Invited</p><h1 style="color:#fff;margin:12px 0;font-size:28px;">Event Name</h1><p style="color:#c4b5fd;font-size:16px;margin:0;">January 15, 2025 &bull; 2:00 PM EST</p></td></tr>
      <tr><td style="padding:40px;"><p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">Join us for an exciting event. Learn from experts and connect with peers.</p><table width="100%" style="background:#f9fafb;border-radius:8px;"><tr><td style="padding:20px;"><p style="margin:0;font-weight:bold;">Details</p><p style="color:#6b7280;margin:8px 0 0;font-size:14px;">Location: Online via Zoom<br/>Duration: 1 hour<br/>Speaker: Jane Doe</p></td></tr></table></td></tr>
      <tr><td style="padding:0 40px 40px;text-align:center;"><a href="#" style="background:#7c3aed;color:#fff;padding:14px 32px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">Register Now</a></td></tr>
      <tr><td style="background:#f3f4f6;padding:20px;text-align:center;font-size:12px;color:#9ca3af;"><p style="margin:0;"><a href="{{unsubscribe_url}}" style="color:#6366f1;">Unsubscribe</a></p></td></tr>
    </table>`,
  },
];

interface TemplateGalleryProps {
  onSelect: (html: string) => void;
  onClose: () => void;
}

export default function TemplateGallery({ onSelect, onClose }: TemplateGalleryProps) {
  const [showPasteHtml, setShowPasteHtml] = useState(false);
  const [pastedHtml, setPastedHtml] = useState('');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 bg-white flex items-center justify-center overflow-y-auto py-8"
    >
      <div className="max-w-4xl w-full px-8">
        <AnimatePresence mode="wait">
          {showPasteHtml ? (
            <motion.div
              key="paste"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold">Paste Your HTML</h2>
                <p className="text-gray-500 mt-2">Paste your full email HTML code below</p>
              </div>
              <textarea
                value={pastedHtml}
                onChange={(e) => setPastedHtml(e.target.value)}
                placeholder="<table>&#10;  <tr>&#10;    <td>Your email HTML here...</td>&#10;  </tr>&#10;</table>"
                className="w-full h-72 p-4 border-2 border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-400 resize-none"
                autoFocus
              />
              {pastedHtml.trim() && (
                <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500">Preview</div>
                  <div className="p-4 max-h-48 overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: pastedHtml }} />
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => { setShowPasteHtml(false); setPastedHtml(''); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  &larr; Back to templates
                </button>
                <button
                  onClick={() => { if (pastedHtml.trim()) { onSelect(pastedHtml.trim()); onClose(); } }}
                  disabled={!pastedHtml.trim()}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Use This HTML
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold">Choose a Starter Template</h2>
                <p className="text-gray-500 mt-2">Pick a template to get started, or begin with a blank canvas</p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {starters.map((t, i) => {
                  const Icon = t.icon;
                  return (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
                      whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
                      onClick={() => { onSelect(t.html); onClose(); }}
                      className="text-left p-5 bg-white border-2 border-gray-100 rounded-xl hover:border-primary-300 transition-colors group"
                    >
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${t.gradient} inline-flex mb-3`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">{t.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    </motion.button>
                  );
                })}

                {/* Paste HTML option */}
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + starters.length * 0.06, duration: 0.4 }}
                  whileHover={{ y: -4, boxShadow: '0 12px 24px -8px rgba(0,0,0,0.12)' }}
                  onClick={() => setShowPasteHtml(true)}
                  className="text-left p-5 bg-white border-2 border-dashed border-gray-200 rounded-xl hover:border-primary-300 transition-colors group"
                >
                  <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 inline-flex mb-3">
                    <Code className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-700">Paste HTML</h3>
                  <p className="text-xs text-gray-500 mt-1">Use your own HTML code</p>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
