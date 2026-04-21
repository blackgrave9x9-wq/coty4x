import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, Gift, Sparkles, X, CheckCircle2, Truck, Tag, Package } from 'lucide-react';
import { UserProfile, Redemption } from '../types';
import { t } from '../i18n';
import { collection, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface LoyaltyCardProps {
  user: UserProfile | null;
  lang: 'en' | 'sw';
  onOpenRules?: () => void;
}

export default function LoyaltyCard({ user, lang, onOpenRules }: LoyaltyCardProps) {
  const credits = user?.loyaltyCredits || 0;
  const targetCredits = 30;
  const progress = Math.min(((credits % 30 === 0 && credits > 0) ? 100 : (credits % 30) / 30 * 100), 100);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedReward, setSelectedReward] = useState<'FREE DELIVERY' | 'ONE FOR FREE' | 'DISCOUNT' | null>(null);

  const handleRedeem = async () => {
    if (!user) return;
    console.log('handleRedeem called, selectedReward:', selectedReward);
    if (!selectedReward) {
      alert(lang === 'sw' ? 'Tafadhali chagua zawadi moja kabla ya kuthibitisha' : 'Please select a reward before confirming');
      return;
    }
    if (credits < 30) return;
    
    setIsSubmitting(true);
    try {
      console.log('Submitting redemption...');
      const redemptionData: Omit<Redemption, 'id'> = {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userEmail: user.email,
        userPhone: user.phoneNumber,
        userLocation: user.location,
        reward: selectedReward,
        points: 30,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'redemptions'), redemptionData);
      
      // Deduct points
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        loyaltyCredits: increment(-30)
      });

      console.log('Redemption successful, showing success message');
      setShowSuccess(true);
      setSelectedReward(null);
      
      setTimeout(() => {
        console.log('Closing success message');
        setShowSuccess(false);
        setIsRedeeming(false);
      }, 5000);
    } catch (error) {
      console.error('Redemption error:', error);
      handleFirestoreError(error, OperationType.CREATE, 'redemptions');
      alert(lang === 'sw' ? 'Imeshindwa kukomboa zawadi. Tafadhali jaribu tena.' : 'Failed to redeem reward. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="glassmorphism rounded-[32px] p-8 shadow-2xl text-text relative overflow-hidden border border-white/20 group transition-all hover:scale-[1.02]">
      {/* Luxury Background Effect */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -mr-24 -mt-24 group-hover:bg-primary/10 transition-all" />
      
      <div className="flex items-center gap-5 mb-8 relative z-10">
        <div className="p-4 bg-primary/10 rounded-2xl text-primary border border-primary/20 shadow-inner">
          <CreditCard size={28} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-primary/70 uppercase tracking-[0.2em] font-black leading-relaxed">{t(lang, 'loyaltyMembership')}</p>
          <p className="text-3xl font-bold tracking-tight text-primary mt-1">Loyalty Code: {user?.cardNumber || '---'}</p>
        </div>
        {onOpenRules && (
          <button 
            onClick={onOpenRules}
            className="text-sm font-black text-primary/70 hover:text-primary underline underline-offset-4 transition-colors"
          >
            {t(lang, 'instructions')}
          </button>
        )}
      </div>
      
      <div className="mb-8 relative z-10">
        <div className="flex justify-between items-end mb-4">
          <p className="text-xs text-primary/70 uppercase tracking-[0.2em] font-black">{t(lang, 'accumulatedCredits')}</p>
          <p className="text-xl font-black text-primary">{credits} <span className="text-sm font-bold opacity-50">/ {targetCredits}</span></p>
        </div>
        
        {/* Luxury Progress Bar */}
        <div className="w-full bg-white/30 h-4 rounded-full overflow-hidden border border-white/40 shadow-inner p-1">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full relative shadow-lg"
          >
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <motion.div 
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />
          </motion.div>
        </div>
      </div>

      {user && credits > 0 && credits % 30 === 0 ? (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsRedeeming(true)}
          className="w-full bg-primary text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 border border-primary/20 hover:bg-secondary transition-all"
        >
          <Sparkles size={24} />
          {t(lang, 'claimLuxuryReward')}
        </motion.button>
      ) : (
        <div className="flex items-center gap-3 text-xs text-primary/50 uppercase tracking-widest font-black justify-center leading-relaxed">
          <Gift size={16} />
          <span>{t(lang, 'rewardUnlocksAt')}</span>
        </div>
      )}

      {/* Reward Selection Modal */}
      <AnimatePresence>
        {isRedeeming && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsRedeeming(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glassmorphism border border-white/10 w-full max-w-md rounded-[32px] overflow-hidden relative z-10 shadow-2xl p-8"
            >
              {showSuccess ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-6"
                  >
                    <CheckCircle2 size={48} />
                  </motion.div>
                  <h2 className="text-xl font-bold text-primary leading-relaxed">
                    {lang === 'sw' 
                      ? `Hongera! Umechagua ${selectedReward}. Endelea kununua ili ujaze credits nyingi. Utapigiwa simu kupata zawadi yako.` 
                      : `Congratulations! You selected ${selectedReward}. Keep buying more to fill more credits. You will be called to receive your reward.`}
                  </h2>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-primary">{lang === 'sw' ? 'Chagua Zawadi Yako' : 'Choose Your Reward'}</h2>
                      <p className="text-xs text-primary/60 font-bold uppercase tracking-widest mt-1">{lang === 'sw' ? 'Hongera kwa kufikisha point 30!' : 'Congrats on reaching 30 points!'}</p>
                    </div>
                    <button 
                      onClick={() => setIsRedeeming(false)}
                      disabled={isSubmitting}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4 mb-8">
                    {[
                      { id: 'FREE DELIVERY', icon: Truck, label: 'GET FREE DELIVERY', sw: 'PATA USAFIRI BURE' },
                      { id: 'ONE FOR FREE', icon: Package, label: 'GET ONE FOR FREE', sw: 'PATA MOJA BURE' },
                      { id: 'DISCOUNT', icon: Tag, label: 'GET DISCOUNT', sw: 'PATA PUNGUZO' }
                    ].map((reward) => (
                      <button
                        key={reward.id}
                        onClick={() => setSelectedReward(reward.id as any)}
                        disabled={isSubmitting}
                        className={`w-full p-6 rounded-2xl border flex items-center gap-4 transition-all ${
                          selectedReward === reward.id 
                            ? 'border-primary bg-primary/10 text-primary shadow-lg' 
                            : 'border-white/10 hover:border-white/20 bg-white/5'
                        }`}
                      >
                        <div className={`p-3 rounded-xl ${selectedReward === reward.id ? 'bg-primary text-white' : 'bg-white/10 text-primary/60'}`}>
                          <reward.icon size={24} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">{lang === 'sw' ? reward.sw : reward.label}</p>
                          <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">{lang === 'sw' ? 'Zawadi ya Point 30' : '30 Points Reward'}</p>
                        </div>
                        {selectedReward === reward.id && <CheckCircle2 className="ml-auto text-primary" size={20} />}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleRedeem}
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:bg-secondary transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {lang === 'sw' ? 'Inatuma...' : 'Submitting...'}
                      </>
                    ) : (
                      <>
                        <Sparkles size={20} />
                        {lang === 'sw' ? 'THIBITISHA ZAWADI' : 'CONFIRM REWARD'}
                      </>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
