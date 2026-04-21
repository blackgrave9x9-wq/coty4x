import React from 'react';
import { UserProfile } from '../types';
import { t } from '../i18n';

interface LoyaltyRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
}

export default function LoyaltyRulesModal({ isOpen, onClose, user }: LoyaltyRulesModalProps) {
  if (!isOpen) return null;
  const lang = user?.language || 'sw';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glassmorphism rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6 text-primary">{t(lang, 'instructions')}</h2>
        <ul className="space-y-4 text-sm text-text/70 mb-8 leading-relaxed">
          <li className="flex gap-3">
            <span className="text-primary font-bold">1.</span>
            <span>{t(lang, 'rule1')}</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold">2.</span>
            <span>{t(lang, 'rule2')}</span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-bold">3.</span>
            <span>{t(lang, 'rule3')} <br/>{t(lang, 'cardNumberIs')} <span className="font-mono font-bold text-primary">{user?.cardNumber || '---'}</span></span>
          </li>
        </ul>
        <button 
          className="w-full bg-primary text-white py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:bg-secondary transition-all"
          onClick={onClose}
        >
          {t(lang, 'close')}
        </button>
      </div>
    </div>
  );
}
