import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

interface Subscription {
  list_id: string;
  list_name: string;
  subscribed: boolean;
}

interface Consent {
  email_marketing: boolean;
}

interface PreferencesData {
  email: string;
  first_name: string | null;
  last_name: string | null;
  subscriptions: Subscription[];
  consent: Consent;
}

export default function PreferenceCenterPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PreferencesData | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [consent, setConsent] = useState<Consent>({ email_marketing: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    axios
      .get(`/api/v1/preferences/${token}`)
      .then(({ data }) => {
        setData(data);
        setSubscriptions(data.subscriptions);
        if (data.consent) setConsent(data.consent);
      })
      .catch(() => {
        setError('This preferences link is invalid or has expired.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleToggle = (listId: string) => {
    setSubscriptions((prev) =>
      prev.map((s) => (s.list_id === listId ? { ...s, subscribed: !s.subscribed } : s)),
    );
    setSuccess(false);
  };

  const handleConsentToggle = () => {
    setConsent((prev) => ({ ...prev, email_marketing: !prev.email_marketing }));
    setSuccess(false);
  };

  const handleUnsubscribeAll = () => {
    setSubscriptions((prev) => prev.map((s) => ({ ...s, subscribed: false })));
    setConsent({ email_marketing: false });
    setSuccess(false);
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSuccess(false);
    try {
      await axios.post(`/api/v1/preferences/${token}`, {
        subscriptions: subscriptions.map((s) => ({
          list_id: s.list_id,
          subscribed: s.subscribed,
        })),
        consent: { email_marketing: consent.email_marketing },
      });
      setSuccess(true);
    } catch {
      setError('Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading preferences...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Invalid</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-lg mx-auto px-4 py-6 text-center">
          <h1><img src="/brand/logo.png" alt="Rabbit Growth" className="mx-auto h-9 w-auto" /></h1>
          <p className="text-sm text-gray-500 mt-1">Email Preferences Center</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-6">
          {/* Contact Info */}
          <div className="mb-6 pb-6 border-b">
            <p className="text-sm text-gray-500">Managing preferences for:</p>
            <p className="text-lg font-medium text-gray-900">{fullName || data.email}</p>
            {fullName && <p className="text-sm text-gray-500">{data.email}</p>}
          </div>

          {/* Subscriptions */}
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mailing Lists</h2>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">
              You are not subscribed to any mailing lists.
            </p>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div key={sub.list_id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{sub.list_name}</p>
                    <p className="text-xs text-gray-400">
                      {sub.subscribed ? 'Subscribed' : 'Unsubscribed'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggle(sub.list_id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      sub.subscribed ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        sub.subscribed ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Consent */}
          <div className="mt-6 pt-6 border-t">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Communication Consent</h2>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Email Marketing</p>
                <p className="text-xs text-gray-400">
                  {consent.email_marketing
                    ? 'You have consented to receive marketing emails'
                    : 'You have opted out of marketing emails'}
                </p>
              </div>
              <button
                onClick={handleConsentToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  consent.email_marketing ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    consent.email_marketing ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 pt-6 border-t space-y-3">
            {success && (
              <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center">
                Your preferences have been saved successfully.
              </div>
            )}
            {error && data && (
              <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
            <button
              onClick={handleUnsubscribeAll}
              className="w-full py-2 text-sm text-red-600 hover:text-red-700 hover:underline"
            >
              Unsubscribe from all
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Rabbit Growth
        </p>
      </div>
    </div>
  );
}
