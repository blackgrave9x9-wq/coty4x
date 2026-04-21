import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingCart, 
  User, 
  Wallet, 
  ChevronRight, 
  Plus, 
  Minus, 
  Trash2, 
  Gift, 
  Calculator,
  Search,
  Menu,
  X,
  Star,
  Package,
  RefreshCw,
  Globe,
  Home,
  Sparkles,
  ShoppingBag,
  MessageSquare
} from 'lucide-react';
import { PRODUCTS } from './constants';
import { Product, CartItem, UserProfile, Order } from './types';
import { t, Language } from './i18n';
import MeatScene from './components/MeatScene';
import React, { Suspense } from 'react';

const AIConcierge = React.lazy(() => import('./components/AIConcierge'));
import { db, handleFirestoreError, OperationType } from './firebase';
import { doc, onSnapshot, setDoc, updateDoc, increment, addDoc, collection, query, getDocFromServer } from 'firebase/firestore';
import { AdminDashboard } from './components/AdminDashboard';
import SubscriptionManager from './components/SubscriptionManager';
import PopupAd from './components/PopupAd';
import LoyaltyCard from './components/LoyaltyCard';
import LoyaltyRulesModal from './components/LoyaltyRulesModal';
import OrderManager from './components/OrderManager';
import FeedbackModal from './components/FeedbackModal';

const generateCardNumber = (uid: string) => {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  const positiveHash = Math.abs(hash);
  
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letter = letters[positiveHash % 26];
  const number = (positiveHash % 100).toString().padStart(2, '0');
  
  return `${letter}${number}`;
};

import { startSubscriptionChecker } from './services/SubscriptionService';

export default function App() {
  useEffect(() => {
    const unsubscribe = startSubscriptionChecker();
    return () => unsubscribe();
  }, []);
  const [activeTab, setActiveTab] = useState<'Main' | 'Subscription' | 'Orders'>('Main');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [showRegistration, setShowRegistration] = useState(false);
  const [localLang, setLocalLang] = useState<Language>('sw');
  const [regData, setRegData] = useState<{ displayName: string; phoneNumber: string; location: string; language: Language }>({ 
    displayName: '', 
    phoneNumber: '', 
    location: '', 
    language: 'sw' 
  });
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Sync regData language with localLang initially
  useEffect(() => {
    setRegData(prev => ({ ...prev, language: localLang }));
  }, [localLang]);

  const handleLogin = () => setShowRegistration(true);
  const handleLogout = () => {
    localStorage.removeItem('coty_user_id');
    setUser(null);
    setIsAdminOpen(false);
  };

  const lang = showRegistration ? regData.language : (user?.language || localLang);

  useEffect(() => {
    // Determine the user ID - either from the state or localStorage
    const userId = user?.uid || localStorage.getItem('coty_user_id');
    
    if (userId) {
      const userRef = doc(db, 'users', userId);
      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as UserProfile;
          setUser(userData);
          // Sync local lang with user lang if it exists
          if (userData.language) {
            setLocalLang(userData.language);
          }
        } else {
          // If we have a userId but no doc, and it's from localStorage, clear it
          if (!user) {
            localStorage.removeItem('coty_user_id');
            setUser(null);
          }
        }
        setIsAuthLoading(false);
      }, (err) => {
        console.error("Firestore user snapshot error:", err);
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      setIsAuthLoading(false);
    }
  }, [user?.uid]); // Re-run if user.uid changes (e.g. after registration)

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(productsData);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));
    return () => unsubscribe();
  }, []);

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount >= 5) {
      setShowPasswordInput(true);
      setClickCount(0);
    }
  };

  const handlePasswordSubmit = () => {
    if (passwordInput === '54321') {
      setIsAdminOpen(true);
      setShowPasswordInput(false);
      setPasswordInput('');
    } else {
      alert("Incorrect password");
      setPasswordInput('');
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'site'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSettings(data);
      } else {
        // Create settings document if it doesn't exist
        setDoc(doc(db, 'settings', 'site'), {
          isOpen: true,
          isAppEnabled: true,
          isSubscriptionEnabled: true,
          isLoyaltyEnabled: true,
          isPopupEnabled: false
        }).catch(err => console.error("Initial settings creation error:", err));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/site'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (settings.isPopupEnabled && !isAdminOpen && (settings.popupImageUrl || settings.popupTitle || settings.popupMessage)) {
      const timer = setTimeout(() => setIsPopupOpen(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [settings.isPopupEnabled, settings.popupLastUpdated, activeTab, isAdminOpen]);

  const handleRegistrationSubmit = async () => {
    if (!regData.displayName || !regData.phoneNumber || !regData.location) {
      alert("Please fill in all fields.");
      return;
    }
    
    let userId = localStorage.getItem('coty_user_id');
    if (!userId) {
      userId = crypto.randomUUID();
      localStorage.setItem('coty_user_id', userId);
    }

    const userRef = doc(db, 'users', userId);
    const newUser: UserProfile = {
      uid: userId,
      email: '',
      displayName: regData.displayName,
      phoneNumber: regData.phoneNumber,
      location: regData.location,
      walletBalance: 0,
      loyaltyPoints: 0,
      loyaltyCredits: 0,
      role: 'client',
      language: regData.language,
      cardNumber: generateCardNumber(userId)
    };
    
    try {
      await setDoc(userRef, newUser);
      setUser(newUser);
      setShowRegistration(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users/' + userId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-text">
      {/* Registration Modal */}
      {showRegistration && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-gray-900/60 backdrop-blur-md p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="glassmorphism p-6 sm:p-10 rounded-[32px] shadow-2xl space-y-6 max-w-md w-full border border-white/10 relative overflow-hidden max-h-[95vh] overflow-y-auto"
          >
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            
            <button 
              onClick={() => setShowRegistration(false)}
              className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-all z-20"
            >
              <X size={20} className="text-text/40" />
            </button>

            <div className="relative z-10 text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary/20">
                <User className="text-primary" size={32} />
              </div>
              <h2 className="text-3xl font-bold text-primary mb-2">{t(lang, 'welcome')}</h2>
              <p className="text-xs text-text/40 font-black uppercase tracking-[0.2em]">{t(lang, 'completeRegistration')}</p>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest opacity-60 font-black ml-4">{t(lang, 'fullName')}</label>
                <input 
                  type="text" 
                  value={regData.displayName} 
                  onChange={(e) => setRegData({ ...regData, displayName: e.target.value })}
                  placeholder={lang === 'sw' ? "Jina lako kamili" : "Your full name"}
                  className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest opacity-60 font-black ml-4">{t(lang, 'phoneNumber')}</label>
                <input 
                  type="tel" 
                  value={regData.phoneNumber} 
                  onChange={(e) => setRegData({ ...regData, phoneNumber: e.target.value })}
                  placeholder={lang === 'sw' ? "Namba yako ya simu" : "Your phone number"}
                  className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold text-base"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest opacity-60 font-black ml-4">{t(lang, 'location')}</label>
                <input 
                  type="text" 
                  value={regData.location} 
                  onChange={(e) => setRegData({ ...regData, location: e.target.value })}
                  placeholder={lang === 'sw' ? "Eneo lako" : "Your location"}
                  className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold text-base"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold ml-4">{t(lang, 'language')}</label>
                <div className="flex gap-4">
                  <label className={`flex-1 p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-center gap-2 ${regData.language === 'sw' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-text/60 hover:bg-white/10'}`}>
                    <input type="radio" name="language" value="sw" checked={regData.language === 'sw'} onChange={() => setRegData({ ...regData, language: 'sw' })} className="hidden" />
                    <span className="font-bold text-sm">Kiswahili</span>
                  </label>
                  <label className={`flex-1 p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-center gap-2 ${regData.language === 'en' ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-text/60 hover:bg-white/10'}`}>
                    <input type="radio" name="language" value="en" checked={regData.language === 'en'} onChange={() => setRegData({ ...regData, language: 'en' })} className="hidden" />
                    <span className="font-bold text-sm">English</span>
                  </label>
                </div>
              </div>
            </div>

            <button 
              onClick={handleRegistrationSubmit}
              className="w-full py-5 bg-primary text-white rounded-2xl font-black shadow-2xl shadow-primary/30 hover:bg-secondary transition-all transform active:scale-95 relative z-10 text-base"
            >
              {t(lang, 'completeBtn')}
            </button>
          </motion.div>
        </div>
      )}

      {/* Rules Modal */}
      {user && <LoyaltyRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} user={user} />}
      
      {/* Feedback Modal */}
      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} user={user} lang={lang} />
      
      {/* Password Modal */}
      {showPasswordInput && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="glassmorphism p-8 rounded-[32px] shadow-2xl space-y-6 max-w-sm w-full border border-white/10">
            <h2 className="text-2xl font-bold text-primary">{t(lang, 'adminAccess')}</h2>
            <p className="text-xs text-text/60 font-medium uppercase tracking-widest">{t(lang, 'enterPassword')}</p>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="••••••••"
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold tracking-widest"
              onKeyPress={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            <div className="flex gap-3">
              <button onClick={() => setShowPasswordInput(false)} className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all">{t(lang, 'cancel')}</button>
              <button onClick={handlePasswordSubmit} className="flex-1 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-secondary transition-all">{t(lang, 'submit')}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 glassmorphism border-b border-primary/10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <img 
            src="/logo.png" 
            alt="Coty Logo" 
            className="h-10 w-auto cursor-pointer" 
            onClick={handleLogoClick}
          />
          <div className="hidden md:flex gap-6">
            <button 
              onClick={() => setActiveTab('Main')}
              className={`text-xs tracking-[0.2em] uppercase transition-all font-black px-8 py-4 rounded-xl border ${activeTab === 'Main' ? 'text-primary bg-white/40 border-primary/20 shadow-lg' : 'text-text/40 border-transparent hover:text-text/60'}`}
            >
              {lang === 'en' ? 'Home' : 'Mwanzo'}
            </button>
            <button 
              onClick={() => setActiveTab('Subscription')}
              className={`text-xs tracking-[0.2em] uppercase transition-all font-black px-8 py-4 rounded-xl border ${activeTab === 'Subscription' ? 'text-primary bg-white/40 border-primary/20 shadow-lg' : 'text-text/40 border-transparent hover:text-text/60'}`}
            >
              {t(lang, 'subAndSupport')}
            </button>
            <button 
              onClick={() => setActiveTab('Orders')}
              className={`text-xs tracking-[0.2em] uppercase transition-all font-black px-8 py-4 rounded-xl border ${activeTab === 'Orders' ? 'text-primary bg-white/40 border-primary/20 shadow-lg' : 'text-text/40 border-transparent hover:text-text/60'}`}
            >
              {t(lang, 'myOrders')}
            </button>
            <button 
              onClick={() => setIsFeedbackOpen(true)}
              className="text-xs tracking-[0.2em] uppercase transition-all font-black px-8 py-4 rounded-xl border text-text/40 border-transparent hover:text-text/60"
            >
              {t(lang, 'feedback')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={async () => {
              const newLang = lang === 'en' ? 'sw' : 'en';
              
              // 1. Update Firestore if user is present
              if (user) {
                try {
                  await updateDoc(doc(db, 'users', user.uid), { language: newLang });
                } catch (err) {
                  console.error("Error updating language in Firestore:", err);
                }
              }
              
              // 2. Always update local state for immediate feedback and fallbacks
              setLocalLang(newLang);
              
              // 3. Update regData if modal is open
              if (showRegistration) {
                setRegData(prev => ({ ...prev, language: newLang }));
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-white/40 hover:bg-white/60 border border-primary/10 rounded-xl text-sm font-black uppercase tracking-widest text-primary transition-all shadow-sm"
          >
            <Globe size={18} />
            {lang === 'en' ? 'English' : 'Kiswahili'}
          </button>
          
          <button 
            onClick={() => {
              setRegData({
                displayName: user?.displayName || '',
                phoneNumber: user?.phoneNumber || '',
                location: user?.location || '',
                language: user?.language || 'sw'
              });
              setShowRegistration(true);
            }}
            className="w-10 h-10 rounded-full border border-primary/20 flex items-center justify-center bg-white/10 backdrop-blur-md shadow-inner hover:bg-white/20 transition-all"
          >
            <User size={20} className="text-primary" />
          </button>
        </div>
      </nav>
      
      {/* Mobile Bottom Navigation - iPhone Style Tab Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 md:hidden flex items-center justify-between gap-1 p-1.5 glassmorphism rounded-full border border-white/20 shadow-2xl w-[90%] max-w-[400px]">
        <button 
          onClick={() => setActiveTab('Main')} 
          className={`flex-1 flex flex-col items-center py-2.5 rounded-full transition-all ${activeTab === 'Main' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-text/40'}`}
        >
          <Home size={18} />
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">
            {t(lang, 'home')}
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('Subscription')} 
          className={`flex-1 flex flex-col items-center py-2.5 rounded-full transition-all ${activeTab === 'Subscription' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-text/40'}`}
        >
          <Sparkles size={18} />
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">
            {t(lang, 'support')}
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('Orders')} 
          className={`flex-1 flex flex-col items-center py-2.5 rounded-full transition-all ${activeTab === 'Orders' ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105' : 'text-text/40'}`}
        >
          <ShoppingBag size={18} />
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">
            {t(lang, 'myOrders')}
          </span>
        </button>
        <button 
          onClick={() => setIsFeedbackOpen(true)} 
          className="flex-1 flex flex-col items-center py-2.5 rounded-full transition-all text-text/40"
        >
          <MessageSquare size={18} />
          <span className="text-[10px] font-black mt-1 uppercase tracking-tighter">
            {t(lang, 'feedback')}
          </span>
        </button>
      </div>

      {/* Admin Dashboard */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <AdminDashboard 
            user={user || {
              uid: 'admin-session',
              email: 'admin@coty.luxury',
              displayName: 'Administrator',
              phoneNumber: '',
              location: '',
              walletBalance: 0,
              loyaltyPoints: 0,
              loyaltyCredits: 0,
              role: 'admin',
              language: localLang,
              cardNumber: 'ADMIN'
            }} 
            onLogout={() => {
              localStorage.removeItem('coty_user_id');
              setUser(null);
              setIsAdminOpen(false);
            }} 
            onClose={() => setIsAdminOpen(false)} 
          />
        </div>
      )}

      {/* Main Content */}
      <main className="pt-24 min-h-screen">
        <AnimatePresence mode="wait">
          {activeTab === 'Main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <MeatScene />
              
              <div className="max-w-7xl mx-auto px-6 py-16">
                {isAuthLoading ? (
                  <div className="flex justify-center p-12">
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="text-primary"
                    >
                      <RefreshCw size={48} />
                    </motion.div>
                  </div>
                ) : !user ? (
                  <div className="glassmorphism p-12 rounded-[40px] text-center border border-primary/10 shadow-2xl relative overflow-hidden group hover:border-primary/20 transition-all">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-all" />
                    <User size={64} className="mx-auto mb-8 text-primary opacity-20" />
                    <h3 className="text-3xl font-black text-primary mb-4 uppercase tracking-tighter">{t(lang, 'welcome')}</h3>
                    <p className="text-text/60 mb-10 max-w-sm mx-auto font-bold text-sm uppercase tracking-[0.2em] leading-relaxed">
                      {t(lang, 'loginToEarn')}
                    </p>
                    <button 
                      onClick={handleLogin}
                      className="px-12 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-[0.2em] text-sm shadow-xl shadow-primary/20 hover:bg-secondary hover:scale-105 active:scale-95 transition-all"
                    >
                      {t(lang, 'loginBtn')}
                    </button>
                  </div>
                ) : (
                  <LoyaltyCard user={user} lang={lang} onOpenRules={() => setIsRulesOpen(true)} />
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'Subscription' && (
            <motion.div
              key="subscription"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-7xl mx-auto px-6 py-16"
            >
              <SubscriptionManager user={user} products={products} lang={lang} />
            </motion.div>
          )}

          {activeTab === 'Orders' && (
            <motion.div
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-7xl mx-auto px-6 py-16"
            >
              <OrderManager user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-12 pt-6">
        <div className="max-w-7xl mx-auto bg-primary text-white rounded-[40px] p-12 sm:p-16 shadow-2xl border border-white/10 relative overflow-hidden">
          {/* Subtle decorative circle */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2 space-y-6">
              <span className="text-5xl font-black tracking-tighter text-white block">Coty</span>
              <p className="text-white/80 max-w-sm leading-relaxed font-bold text-sm uppercase tracking-[0.2em]">
                {t(lang, 'footerDesc')}
              </p>
            </div>
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40 mb-6">{t(lang, 'locationTitle')}</h4>
              <p className="text-white/80 text-sm font-light leading-loose">
                Mbezi beach kwa zena,<br />
                Dar Es Salam, Tanzania
              </p>
            </div>
            <div>
              <h4 className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40 mb-6">{t(lang, 'inquiries')}</h4>
              <div className="space-y-2">
                <p className="text-white/80 text-sm font-light">+255 715 993 341</p>
                <p className="text-white/80 text-sm font-light">+255 768 656 508</p>
              </div>
            </div>
          </div>
          
          <div className="relative z-10 pt-10 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[9px] uppercase tracking-[0.4em] text-white/30 font-medium">
              {t(lang, 'rights')}
            </p>
            <div className="flex gap-8">
              <span className="text-[9px] uppercase tracking-[0.4em] text-white/30 font-medium cursor-pointer hover:text-white/60 transition-colors">{t(lang, 'privacy')}</span>
              <span className="text-[9px] uppercase tracking-[0.4em] text-white/30 font-medium cursor-pointer hover:text-white/60 transition-colors">{t(lang, 'terms')}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* AI Concierge */}
      <Suspense fallback={null}>
        <AIConcierge 
          user={user} 
          lang={lang} 
          onAddToCart={() => {}} 
          onShowRegistration={() => {
            if (user) {
              setRegData({
                displayName: user.displayName || '',
                phoneNumber: user.phoneNumber || '',
                location: user.location || '',
                language: user.language || 'sw'
              });
              setShowRegistration(true);
            } else {
              handleLogin();
            }
          }}
        />
      </Suspense>
      {settings.isPopupEnabled && isPopupOpen && !isAdminOpen && (settings.popupImageUrl || settings.popupTitle || settings.popupMessage) && (
        <PopupAd 
          isOpen={isPopupOpen} 
          onClose={() => setIsPopupOpen(false)} 
          title={settings.popupTitle}
          message={settings.popupMessage}
          imageUrl={settings.popupImageUrl}
          lang={lang}
        />
      )}
    </div>
  );
}
