import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bell, Check, Inbox, Loader2, X } from 'lucide-react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export default function NotificationInboxModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const notesRef = collection(db, 'notifications');
    const q = query(notesRef, where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return bTime - aTime;
        });
      setNotifications(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const markRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error(err);
      showToast('Failed to mark notification read.', 'error');
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((item) => !item.read);
    if (unread.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(unread.map((item) => updateDoc(doc(db, 'notifications', item.id), { read: true })));
      showToast('Notifications marked read.', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to mark notifications read.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (value: any) => {
    const date = value?.toDate ? value.toDate() : null;
    if (!date) return 'Just now';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-end p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[420px] mt-14 md:mt-16 bg-[#121212] border border-white/10 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden"
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#A855F7]/10 flex items-center justify-center">
              <Bell size={18} className="text-[#A855F7]" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white tracking-tight">Notifications</h2>
              <p className="text-[11px] text-white/40">{notifications.filter((item) => !item.read).length} unread</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[62vh] overflow-y-auto p-3">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#A855F7] animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center px-10">
              <Inbox size={34} className="text-white/15 mb-3" />
              <p className="text-[13px] text-white/40">No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((item) => (
                <div key={item.id} className={`rounded-[18px] border p-4 ${item.read ? 'bg-white/[0.02] border-white/[0.04]' : 'bg-[#A855F7]/10 border-[#A855F7]/20'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white font-bold text-[13px]">{item.title || 'GearUp update'}</p>
                      <p className="text-white/45 text-[12px] mt-1 leading-relaxed">{item.message || 'You have a new notification.'}</p>
                    </div>
                    <span className="text-[10px] text-white/30 whitespace-nowrap">{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-white/30 uppercase tracking-wider">{item.type || 'update'}</span>
                    {!item.read && (
                      <button
                        onClick={() => markRead(item.id)}
                        className="text-[11px] text-[#2DD4BF] font-bold flex items-center gap-1.5 hover:text-[#5eead4] transition-colors"
                      >
                        <Check size={13} /> Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex justify-end">
          <button
            onClick={markAllRead}
            disabled={saving || notifications.every((item) => item.read)}
            className="px-4 py-2.5 bg-white/5 text-white/80 font-bold rounded-[12px] text-[12px] hover:bg-white/10 transition-all disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>
      </motion.div>
    </div>
  );
}
