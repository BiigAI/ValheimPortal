import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiServer, FiLock, FiAlertTriangle } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the admin password.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const res = await login(password);
    if (!res.success) {
      setError(res.message || 'Invalid admin password.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen bg-gray-950 flex items-center justify-center overflow-hidden relative font-sans select-none">
      {/* Background gradient effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-orange-950/20 via-gray-950 to-black" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md p-8"
      >
        <div className="bg-gray-900/80 backdrop-blur-2xl border border-gray-800/80 rounded-3xl p-8 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex flex-col items-center space-y-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400 p-0.5 shadow-xl shadow-orange-500/30">
              <div className="w-full h-full bg-gray-900 rounded-[14px] flex items-center justify-center">
                <FiServer className="text-orange-400 text-3xl" />
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 tracking-tight">
                Bigfrost
              </h1>
              <p className="text-sm text-gray-400 mt-1">Server Administration Portal</p>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 font-mono">
                Admin Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  placeholder="Enter server password..."
                  autoFocus
                  className="w-full bg-gray-950 border border-gray-700/80 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-orange-500/80 focus:ring-1 focus:ring-orange-500/40 transition-all placeholder:text-gray-600 font-mono"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center space-x-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5"
              >
                <FiAlertTriangle className="flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Enter Admin Portal</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-gray-800/50 text-center">
            <p className="text-[11px] text-gray-500 font-mono">
              Bigfrost v1.0.0 • BepInEx HTTP Bridge
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
