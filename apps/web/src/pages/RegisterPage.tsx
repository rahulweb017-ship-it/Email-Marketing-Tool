import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/auth.store';

export default function RegisterPage() {
  const [orgName, setOrgName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(orgName, name, email, password);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-brand-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <h1><img src="/brand/logo.png" alt="Rabbit Growth" className="h-10 w-auto" /></h1>
        </motion.div>

        <h2 className="text-xl font-semibold text-center mb-6">Create your account</h2>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm"
          >
            {error}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Your name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500" required minLength={8} />
          </div>
          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-2.5 bg-gradient-to-r from-brand-600 to-rose-600 text-white rounded-lg hover:from-brand-700 hover:to-rose-700 disabled:opacity-50 font-medium shadow-lg shadow-brand-200"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </motion.button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account? <Link to="/login" className="text-brand-600 hover:underline font-medium">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
