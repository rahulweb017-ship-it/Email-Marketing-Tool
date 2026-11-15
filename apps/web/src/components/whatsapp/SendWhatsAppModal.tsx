import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import Modal from '../ui/Modal';
import { SelectInput, TextArea } from '../ui/FormField';
import AiComposeModal from './AiComposeModal';
import { useToastStore } from '../../stores/toast.store';
import { apiError, listWaAccounts, listWaTemplates, sendWaMessage, type WaAccount, type WaTemplate } from '../../api/whatsapp';

/** Send one WhatsApp message to a single contact (from the contact profile). */
export default function SendWhatsAppModal({ open, contactId, onClose, onSent }: {
  open: boolean; contactId: string; onClose: () => void; onSent?: () => void;
}) {
  const addToast = useToastStore((s) => s.addToast);
  const [accounts, setAccounts] = useState<WaAccount[]>([]);
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [accountId, setAccountId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [body, setBody] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBody(''); setTemplateId('');
    listWaAccounts().then((a) => {
      const usable = a.filter((x) => x.status === 'connected');
      setAccounts(usable);
      setAccountId(usable[0]?.id || '');
    }).catch(() => setAccounts([]));
  }, [open]);

  useEffect(() => {
    if (accountId) listWaTemplates(accountId).then((t) => setTemplates(t.filter((x) => x.status === 'APPROVED'))).catch(() => {});
  }, [accountId]);

  const account = accounts.find((a) => a.id === accountId);
  const isMeta = account?.provider === 'meta_cloud';
  const usable = templates.filter((t) => (isMeta ? t.source === 'meta' : t.source === 'local'));

  const send = async () => {
    setSending(true);
    try {
      await sendWaMessage({ account_id: accountId, contact_id: contactId, ...(templateId ? { template_id: templateId } : { body }) });
      addToast('Message queued. It appears in the WhatsApp inbox.', 'success');
      onSent?.();
      onClose();
    } catch (err) {
      addToast(apiError(err, 'Message not sent'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Send WhatsApp message" size="lg"
      footer={<div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">Cancel</button>
        <button onClick={send} disabled={sending || !accountId || (!templateId && !body.trim())} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg disabled:opacity-50">
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>}>
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500">No connected WhatsApp number. Connect one under WhatsApp → Numbers.</p>
      ) : (
        <div className="space-y-4">
          <SelectInput label="From" name="acc" value={accountId} onChange={(v) => { setAccountId(v); setTemplateId(''); }}
            options={accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.provider === 'meta_cloud' ? 'Meta' : 'QR'})` }))} />
          {usable.length > 0 && (
            <SelectInput label={isMeta ? 'Template (needed unless the customer wrote in the last 24h)' : 'Saved message'} name="tpl" value={templateId}
              onChange={setTemplateId} placeholder="Write a message instead" options={usable.map((t) => ({ value: t.id, label: t.name }))} />
          )}
          {!templateId && (
            <div>
              <div className="flex justify-end mb-1">
                <button onClick={() => setAiOpen(true)} className="flex items-center gap-1 text-xs text-rose-600 hover:underline"><Sparkles className="h-3.5 w-3.5" /> Write with AI</button>
              </div>
              <TextArea label="Message" name="body" rows={5} value={body} onChange={setBody} placeholder="Hi {{first_name}}, …" />
            </div>
          )}
        </div>
      )}
      <AiComposeModal open={aiOpen} onClose={() => setAiOpen(false)} onUse={(m) => { setBody(m); setAiOpen(false); }} />
    </Modal>
  );
}
