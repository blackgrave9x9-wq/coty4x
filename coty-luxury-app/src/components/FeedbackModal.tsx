import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageSquare } from 'lucide-react';
import { t, Language } from '../i18n';
import { UserProfile, Feedback } from '../types';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  lang: Language;
}

export default function FeedbackModal({ isOpen, onClose, user, lang }: Props) {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;

    setIsSending(true);
    try {
      const now = new Date();
      const feedback: Feedback = {
        userId: user?.uid || 'anonymous',
        userName: user?.displayName || 'Anonymous',
        userPhone: user?.phoneNumber || '',
        location: user?.location || 'Unknown',
        message: message.trim(),
        createdAt: now.toISOString(),
        date: now.toLocaleDateString(),
        time: now.toLocaleTimeString(),
      };

      await addDoc(collection(db, 'feedbacks'), feedback);
      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error("Error sending feedback:", error);
      alert(t(lang, 'feedbackError'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="glassmorphism w-full max-w-md rounded-[32px] overflow-hidden border border-white/20 shadow-2xl"
          >
            <div className="p-8 space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="text-primary" size={20} />
                  </div>
                  <h2 className="text-2xl font-black text-primary uppercase tracking-tighter">
                    {t(lang, 'feedbackTitle')}
                  </h2>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X size={24} className="text-text/40" />
                </button>
              </div>

              {success ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-500/10 border border-green-500/20 p-6 rounded-2xl text-center"
                >
                  <p className="text-green-600 font-bold uppercase tracking-widest text-xs">
                    {t(lang, 'feedbackSuccess')}
                  </p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t(lang, 'feedbackPlaceholder')}
                    className="w-full h-32 p-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all text-sm font-bold resize-none"
                  />
                  <button
                    onClick={handleSubmit}
                    disabled={isSending || !message.trim()}
                    className={`w-full py-4 rounded-xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-2 transition-all ${
                      isSending || !message.trim() 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-primary text-white shadow-xl shadow-primary/20 hover:bg-secondary hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    <Send size={18} />
                    {t(lang, 'sendFeedback')}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
