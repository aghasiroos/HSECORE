import React from 'react';
import { useWebSocket } from '../providers/WebSocketProvider';
import { useEnterpriseSync } from '../hooks/useEnterpriseSync';
import { useSystemVersion } from '../hooks/useSystemVersion';
import { RefreshCw, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const SystemStatusBadge: React.FC = () => {
  const { isConnected: isWsConnected } = useWebSocket();
  const syncStatus = useEnterpriseSync();
  const { updateAvailable, applyUpdate } = useSystemVersion(60000); // Check every minute

  const isConnected = isWsConnected || syncStatus === 'CONNECTED';
  const isSyncing = !isConnected && syncStatus === 'SYNCING';

  return (
    <div className="flex items-center gap-3">
      {/* Real-time Connection & Database Status */}
      <div 
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
          isConnected 
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
            : isSyncing
            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'
            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
        }`}
        title={
          isConnected 
            ? 'متصل به سرور و پایگاه‌داده مرکزی' 
            : isSyncing
            ? 'در حال همگام‌سازی با پایگاه‌داده مرکزی...'
            : 'در حال برقراری ارتباط با پایگاه‌داده مرکزی...'
        }
      >
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">متصل</span>
          </>
        ) : isSyncing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">در حال همگام‌سازی...</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">در حال اتصال...</span>
          </>
        )}
      </div>

      {/* Automatic Update Available Notification */}
      <AnimatePresence>
        {updateAvailable && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <button
              onClick={applyUpdate}
              className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-xs font-bold transition-all shadow-sm ring-2 ring-blue-500/30"
              title="نسخه جدید سامانه آماده است. برای بروزرسانی کلیک کنید."
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />
              <span>نسخه جدید!</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
