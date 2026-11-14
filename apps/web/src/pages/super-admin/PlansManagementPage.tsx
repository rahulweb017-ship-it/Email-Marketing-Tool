import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { listPlans, createPlan, updatePlan, deletePlan } from '../../api/super-admin';
import { useToastStore } from '../../stores/toast.store';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  max_contacts: number;
  max_emails_per_month: number;
  max_campaigns: number | null;
  max_automations: number | null;
  max_sending_configs: number;
  max_users: number;
  max_lists: number;
  max_whatsapp_messages_per_month?: number;
  max_whatsapp_accounts?: number;
  max_ai_credits_per_month?: number;
  price_monthly: number | string;
  price_yearly: number | string;
  features: Record<string, boolean>;
  is_default: boolean;
  sort_order: number;
  org_count: number;
}

const emptyForm = {
  name: '',
  display_name: '',
  max_contacts: 500,
  max_emails_per_month: 1000,
  max_campaigns: null as number | null,
  max_automations: null as number | null,
  max_sending_configs: 1,
  max_users: 1,
  max_lists: 5,
  max_whatsapp_messages_per_month: 0,
  max_whatsapp_accounts: 0,
  max_ai_credits_per_month: 0,
  features: {} as Record<string, boolean>,
  price_monthly: 0,
  price_yearly: 0,
  is_default: false,
  sort_order: 0,
};

export default function PlansManagementPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const addToast = useToastStore((s) => s.addToast);

  const fetchPlans = () => {
    listPlans()
      .then(({ data }) => setPlans(data.data))
      .catch(() => addToast('Failed to load plans', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPlans(); }, []);

  const handleEdit = (plan: Plan) => {
    setForm({
      name: plan.name,
      display_name: plan.display_name,
      max_contacts: Number(plan.max_contacts) || 0,
      max_emails_per_month: Number(plan.max_emails_per_month) || 0,
      max_campaigns: plan.max_campaigns != null ? Number(plan.max_campaigns) : null,
      max_automations: plan.max_automations != null ? Number(plan.max_automations) : null,
      max_sending_configs: Number(plan.max_sending_configs) || 1,
      max_users: Number(plan.max_users) || 1,
      max_lists: Number(plan.max_lists) || 1,
      max_whatsapp_messages_per_month: Number(plan.max_whatsapp_messages_per_month) || 0,
      max_whatsapp_accounts: Number(plan.max_whatsapp_accounts) || 0,
      max_ai_credits_per_month: Number(plan.max_ai_credits_per_month) || 0,
      features: (plan as any).features && typeof (plan as any).features === 'object' ? (plan as any).features : {},
      price_monthly: parseFloat(String(plan.price_monthly)) || 0,
      price_yearly: parseFloat(String(plan.price_yearly)) || 0,
      is_default: plan.is_default,
      sort_order: Number(plan.sort_order) || 0,
    });
    setEditingId(plan.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      max_contacts: Number(form.max_contacts) || 0,
      max_emails_per_month: Number(form.max_emails_per_month) || 0,
      max_campaigns: form.max_campaigns != null ? Number(form.max_campaigns) : null,
      max_automations: form.max_automations != null ? Number(form.max_automations) : null,
      max_sending_configs: Number(form.max_sending_configs) || 1,
      max_users: Number(form.max_users) || 1,
      max_lists: Number(form.max_lists) || 1,
      max_whatsapp_messages_per_month: Number(form.max_whatsapp_messages_per_month) || 0,
      max_whatsapp_accounts: Number(form.max_whatsapp_accounts) || 0,
      max_ai_credits_per_month: Number(form.max_ai_credits_per_month) || 0,
      price_monthly: parseFloat(String(form.price_monthly)) || 0,
      price_yearly: parseFloat(String(form.price_yearly)) || 0,
      sort_order: Number(form.sort_order) || 0,
    };
    try {
      if (editingId) {
        await updatePlan(editingId, payload);
        addToast('Plan updated', 'success');
      } else {
        await createPlan(payload);
        addToast('Plan created', 'success');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchPlans();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to save plan', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan?')) return;
    try {
      await deletePlan(id);
      addToast('Plan deleted', 'success');
      fetchPlans();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Failed to delete plan', 'error');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Plans</h1>
        <button
          onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading ? (
          <div className="text-gray-500 col-span-4">Loading...</div>
        ) : plans.map((plan) => (
          <div key={plan.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{plan.display_name}</h3>
                {plan.is_default && <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">Default</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => handleEdit(plan)} className="p-1.5 text-gray-400 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => handleDelete(plan.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              ${parseFloat(String(plan.price_monthly)).toFixed(2)}<span className="text-sm font-normal text-gray-400">/mo</span>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
              <div>{plan.max_contacts.toLocaleString()} contacts</div>
              <div>{plan.max_emails_per_month.toLocaleString()} emails/month</div>
              <div>{plan.max_users} users</div>
              <div>{plan.max_lists} lists</div>
              <div>{plan.max_sending_configs} sending configs</div>
              <div>{plan.max_campaigns == null ? 'Unlimited' : plan.max_campaigns} campaigns</div>
              <div>{plan.max_automations == null ? 'Unlimited' : plan.max_automations} automations</div>
              <div>{plan.features?.whatsapp ? `WhatsApp: ${plan.max_whatsapp_accounts ?? 0} numbers, ${(plan.max_whatsapp_messages_per_month ?? 0).toLocaleString()} msgs/month${plan.features?.whatsapp_ai ? ' + AI' : ''}` : 'No WhatsApp'}</div>
              <div>AI: {(plan.max_ai_credits_per_month ?? 0).toLocaleString()} credits/month</div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-400">
              {plan.org_count} organization{plan.org_count !== 1 ? 's' : ''}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingId ? 'Edit Plan' : 'Create Plan'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Name (slug)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                <FormField label="Display Name" value={form.display_name} onChange={(v) => setForm({ ...form, display_name: v })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Max Contacts" value={form.max_contacts} onChange={(v) => setForm({ ...form, max_contacts: v })} />
                <NumberField label="Max Emails/Month" value={form.max_emails_per_month} onChange={(v) => setForm({ ...form, max_emails_per_month: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Max Users" value={form.max_users} onChange={(v) => setForm({ ...form, max_users: v })} />
                <NumberField label="Max Lists" value={form.max_lists} onChange={(v) => setForm({ ...form, max_lists: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Max Sending Configs" value={form.max_sending_configs} onChange={(v) => setForm({ ...form, max_sending_configs: v })} />
                <NullableNumberField label="Max Campaigns" value={form.max_campaigns} onChange={(v) => setForm({ ...form, max_campaigns: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NullableNumberField label="Max Automations" value={form.max_automations} onChange={(v) => setForm({ ...form, max_automations: v })} />
                <NumberField label="Sort Order" value={form.sort_order} onChange={(v) => setForm({ ...form, sort_order: v })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="WhatsApp Numbers" value={form.max_whatsapp_accounts} onChange={(v) => setForm({ ...form, max_whatsapp_accounts: v })} />
                <NumberField label="WhatsApp Msgs/Month" value={form.max_whatsapp_messages_per_month} onChange={(v) => setForm({ ...form, max_whatsapp_messages_per_month: v })} />
                <NumberField label="AI Credits/Month (0 = no AI)" value={form.max_ai_credits_per_month} onChange={(v) => setForm({ ...form, max_ai_credits_per_month: v })} />
              </div>
              <div className="flex gap-4 text-sm text-gray-700 dark:text-gray-300">
                {(['whatsapp', 'whatsapp_ai'] as const).map((f) => (
                  <label key={f} className="flex items-center gap-2">
                    <input type="checkbox" checked={!!form.features[f]} onChange={(e) => setForm({ ...form, features: { ...form.features, [f]: e.target.checked } })} />
                    {f === 'whatsapp' ? 'WhatsApp marketing' : 'WhatsApp AI assistant'}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FloatField label="Price Monthly ($)" value={form.price_monthly} onChange={(v) => setForm({ ...form, price_monthly: v })} />
                <FloatField label="Price Yearly ($)" value={form.price_yearly} onChange={(v) => setForm({ ...form, price_yearly: v })} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="rounded" />
                <label className="text-sm text-gray-700 dark:text-gray-300">Default plan</label>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, value, onChange, required }: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>
  );
}

function FloatField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </div>
  );
}

function NullableNumberField({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  const isUnlimited = value === null;
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          min={0}
          value={isUnlimited ? '' : value}
          disabled={isUnlimited}
          placeholder="Unlimited"
          onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value) || 0)}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
        />
        <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
          <input type="checkbox" checked={isUnlimited} onChange={(e) => onChange(e.target.checked ? null : 0)} className="rounded" />
          <span className="hidden sm:inline">Unlimited</span>
        </label>
      </div>
    </div>
  );
}
