import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function ConfirmSubscriptionPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid confirmation link.');
      return;
    }

    axios
      .get(`/api/v1/confirm/${token}`)
      .then((res) => {
        setStatus('success');
        setMessage(res.data.message || 'Your subscription has been confirmed!');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err.response?.data?.message || 'This confirmation link is invalid or has already been used.'
        );
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-16 w-16 text-primary-500 mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Confirming your subscription...
            </h1>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Subscription Confirmed!
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Confirmation Failed
            </h1>
            <p className="text-gray-600 dark:text-gray-400">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}
