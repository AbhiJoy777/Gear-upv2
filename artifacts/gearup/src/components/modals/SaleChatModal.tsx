import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { X, Send, MessageCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { addDoc, arrayRemove, collection, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

export default function SaleChatModal({ saleListing, chatThread, onClose }: { saleListing?: any; chatThread?: any; onClose: () => void }) {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const chatId = useMemo(() => {
    if (chatThread?.id) return chatThread.id;
    if (!saleListing?.id || !user?.uid) return '';
    return `sale_${saleListing.id}_${user.uid}`;
  }, [chatThread?.id, saleListing?.id, user?.uid]);

  const title = saleListing?.title || chatThread?.listingTitle || 'Sale listing';
  const price = saleListing?.price || chatThread?.listingPrice || 0;
  const sellerId = saleListing?.sellerId || chatThread?.sellerId;
  const buyerId = chatThread?.buyerId || user?.uid;

  useEffect(() => {
    if (!user || !chatId || !sellerId) return;

    const ensureThread = async () => {
      try {
        const chatRef = doc(db, 'chats', chatId);
        const snap = await getDoc(chatRef);
        if (!snap.exists()) {
          await setDoc(chatRef, {
            type: 'sale',
            saleListingId: saleListing?.id || chatThread?.saleListingId || '',
            buyerId,
            sellerId,
            listingTitle: title,
            listingPrice: Number(price || 0),
            buyerName: profile?.name || profile?.username || user.email || 'GearUp Buyer',
            buyerEmail: user.email || '',
            sellerName: saleListing?.sellerName || chatThread?.sellerName || 'GearUp Seller',
            sellerEmail: saleListing?.sellerEmail || chatThread?.sellerEmail || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await addDoc(collection(db, 'chats', chatId, 'messages'), {
            type: 'system',
            senderId: 'system',
            senderName: 'GearUp',
            text: `Inquiry started for ${title} (${Number(price || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}).`,
            createdAt: serverTimestamp(),
          });
        } else {
          await setDoc(chatRef, {
            hiddenFor: arrayRemove(user.uid),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
      } catch (err) {
        console.error('Sale chat setup failed:', err);
        showToast('Could not open seller chat.', 'error');
      }
    };

    ensureThread();
  }, [buyerId, chatId, chatThread?.saleListingId, price, profile?.name, profile?.username, saleListing, sellerId, showToast, title, user]);

  useEffect(() => {
    if (!chatId) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, (err) => {
      console.error('Sale chat listener failed:', err);
      showToast('Could not load sale chat.', 'error');
    });

    return () => unsubscribe();
  }, [chatId, showToast]);

  const sendMessage = async () => {
    if (!user || !chatId || !text.trim()) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        type: 'sale',
        saleListingId: saleListing?.id || chatThread?.saleListingId || '',
        senderId: user.uid,
        senderName: profile?.username || profile?.fullName || profile?.name || user.email || 'GearUp User',
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'chats', chatId), {
        lastMessage: text.trim(),
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: user.uid,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setText('');
    } catch (err) {
      console.error(err);
      showToast('Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-[520px] h-[680px] max-h-[90vh] bg-[#121212] border border-white/10 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#A855F7]/10 flex items-center justify-center shrink-0">
              <MessageCircle size={18} className="text-[#A855F7]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-white tracking-tight">Seller Chat</h2>
              <p className="text-[11px] text-white/40 truncate">{title}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-10">
              <p className="text-[13px] text-white/35 leading-relaxed">
                Start the conversation about price, pickup, and item condition.
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const mine = message.senderId === user?.uid;
              const system = message.senderId === 'system';

              if (system) {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="max-w-[86%] rounded-[16px] px-4 py-2 bg-white/5 border border-white/10 text-white/45 text-[11px] text-center">
                      {message.text}
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] rounded-[20px] px-4 py-3 ${
                    mine ? 'bg-[#A855F7] text-white' : 'bg-[#0A0A0A] border border-white/10 text-white'
                  }`}>
                    {!mine && (
                      <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-1">
                        {message.senderName || 'GearUp User'}
                      </p>
                    )}
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{message.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-[#0A0A0A] flex gap-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendMessage();
            }}
            placeholder="Ask about this item..."
            className="flex-1 bg-[#121212] border border-white/10 rounded-[18px] px-4 text-white text-[13px] outline-none focus:border-[#A855F7]"
          />
          <button
            onClick={sendMessage}
            disabled={sending || !text.trim()}
            className="w-12 h-12 rounded-full bg-[#A855F7] text-white flex items-center justify-center hover:bg-[#9333EA] transition-all disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
