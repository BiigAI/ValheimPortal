import { motion } from 'framer-motion';
import { FiWifiOff } from 'react-icons/fi';

export default function ReconnectingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="flex flex-col items-center space-y-5 text-center"
      >
        <div className="relative">
          <div className="p-5 bg-gray-900/80 border border-gray-700/80 rounded-2xl shadow-2xl">
            <FiWifiOff className="text-orange-400 text-3xl" />
          </div>
          {/* Pulsing ring */}
          <div className="absolute inset-0 rounded-2xl border-2 border-orange-500/40 animate-ping" />
        </div>

        <div>
          <h3 className="text-xl font-bold text-gray-100 tracking-tight">
            Reconnecting...
          </h3>
          <p className="text-sm text-gray-400 mt-1.5 max-w-xs">
            Lost connection to the Valheim server. Waiting for the BepInEx bridge to come back online.
          </p>
        </div>

        {/* Spinner dots */}
        <div className="flex items-center space-x-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-orange-400"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            />
          ))}
        </div>

        <span className="text-[11px] text-gray-500 font-mono uppercase tracking-wider">
          Auto-reconnect active
        </span>
      </motion.div>
    </motion.div>
  );
}
