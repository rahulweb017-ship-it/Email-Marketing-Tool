import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth.store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      // Redirect based on user type - check the stored user
      const user = useAuthStore.getState().user;
      if (user?.is_super_admin && !user?.org_id) {
        navigate('/super-admin');
      } else {
        navigate('/');
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-brand-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <h1><img src="/brand/logo.png" alt="Rabbit Growth" className="h-10 w-auto" /></h1>
        </motion.div>

        <h2 className="text-xl font-semibold text-center mb-6 dark:text-gray-100">Sign in to your account</h2>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
              required
            />
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-rose-600 text-white rounded-lg hover:from-brand-700 hover:to-rose-700 disabled:opacity-50 font-medium shadow-lg shadow-brand-200 dark:shadow-none"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </motion.button>
        </form>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Don't have an account? <Link to="/register" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">Request a demo</Link>
          {' '}or <Link to="/signup" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">create one</Link>
        </p>
        <p className="text-center text-xs mt-3">
          <Link to="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Back to website</Link>
        </p>
      </motion.div>
    </div>
  );
}
