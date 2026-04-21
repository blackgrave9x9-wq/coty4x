import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { t } from '../i18n';

interface PopupAdProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  imageUrl?: string;
  lang?: 'en' | 'sw';
}

export default function PopupAd({ isOpen, onClose, title, message, imageUrl, lang = 'sw' }: PopupAdProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!imageUrl && !title && !message) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 sm:p-6 overflow-y-auto pt-[10cm]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`glassmorphism rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden relative z-10 border border-white/10 transition-all duration-500 ease-in-out mx-auto ${isExpanded ? 'w-auto max-w-[95vw]' : 'w-full max-w-lg'}`}
          >
            <div className="absolute top-4 right-4 z-20 flex gap-2">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 bg-gray-900/20 hover:bg-gray-900/40 text-white rounded-full transition-all backdrop-blur-md"
                title={isExpanded ? "Show less" : "Show original size"}
              >
                {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button 
                onClick={onClose}
                className="p-2 bg-gray-900/20 hover:bg-gray-900/40 text-white rounded-full transition-all backdrop-blur-md"
              >
                <X size={18} />
              </button>
            </div>

            <div 
              className={`relative cursor-pointer group overflow-hidden transition-all duration-500 flex justify-center items-center ${isExpanded ? 'h-auto max-h-[80vh] p-2' : 'h-64'}`}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <img 
                src={imageUrl} 
                alt="COTY Advertisement" 
                className={`transition-all duration-500 ${isExpanded ? 'max-w-full max-h-[75vh] w-auto h-auto rounded-2xl' : 'w-full h-full object-cover group-hover:scale-105'}`}
                referrerPolicy="no-referrer"
              />
              {!isExpanded && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="bg-white/20 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest border border-white/20">
                    Click for original size
                  </span>
                </div>
              )}
            </div>

            <div className={`p-6 sm:p-8 text-center transition-all duration-500 ${isExpanded ? 'bg-white/5' : ''}`}>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-primary">{title}</h3>
              <p className="text-text/70 mb-6 sm:mb-8 text-sm sm:text-base">{message}</p>
              <button 
                onClick={onClose}
                className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-secondary transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                {t(lang, 'shopNow')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
