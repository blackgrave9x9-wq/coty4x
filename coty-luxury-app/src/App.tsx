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
  Globe
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
  const [activeTab, setActiveTab] = useState<'Subscription' | 'Orders'>('Subscription');
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
  const [settings, setSettings] = useState<any>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [showRegistration, setShowRegistration] = useState(false);
  const [regData, setRegData] = useState<{ displayName: string; phoneNumber: string; location: string; language: Language }>({ displayName: '', phoneNumber: '', location: '', language: 'sw' });
  const [localLang, setLocalLang] = useState<Language>('sw');
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const handleLogin = () => setShowRegistration(true);
  const handleLogout = () => {
    localStorage.removeItem('coty_user_id');
    setUser(null);
    setIsAdminOpen(false);
  };

  const lang = showRegistration ? regData.language : (user?.language || localLang);

  useEffect(() => {
    // Load user from localStorage
    const userId = localStorage.getItem('coty_user_id');
    if (userId) {
      const userRef = doc(db, 'users', userId);
      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setUser(snapshot.data() as UserProfile);
        } else {
          localStorage.removeItem('coty_user_id');
          setUser(null);
        }
        setIsAuthLoading(false);
      }, (err) => {
        console.error("Firestore error:", err);
        setIsAuthLoading(false);
      });
      return () => unsubscribe();
    } else {
      setIsAuthLoading(false);
    }
  }, []);

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
              <h2 className="text-2xl font-serif italic text-primary mb-1">{t(lang, 'welcome')}</h2>
              <p className="text-[10px] text-text/40 font-bold uppercase tracking-[0.2em]">{t(lang, 'completeRegistration')}</p>
            </div>

            <div className="space-y-4 relative z-10">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold ml-4">{t(lang, 'fullName')}</label>
                <input 
                  type="text" 
                  value={regData.displayName} 
                  onChange={(e) => setRegData({ ...regData, displayName: e.target.value })}
                  placeholder={lang === 'sw' ? "Jina lako kamili" : "Your full name"}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold ml-4">{t(lang, 'phoneNumber')}</label>
                <input 
                  type="tel" 
                  value={regData.phoneNumber} 
                  onChange={(e) => setRegData({ ...regData, phoneNumber: e.target.value })}
                  placeholder={lang === 'sw' ? "Namba yako ya simu" : "Your phone number"}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-medium text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold ml-4">{t(lang, 'location')}</label>
                <input 
                  type="text" 
                  value={regData.location} 
                  onChange={(e) => setRegData({ ...regData, location: e.target.value })}
                  placeholder={lang === 'sw' ? "Eneo lako" : "Your location"}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-medium text-sm"
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
              className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-2xl shadow-primary/30 hover:bg-secondary transition-all transform active:scale-95 relative z-10 text-sm"
            >
              {t(lang, 'completeBtn')}
            </button>
          </motion.div>
        </div>
      )}

      {/* Rules Modal */}
      {user && <LoyaltyRulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} user={user} />}
      
      {/* Password Modal */}
      {showPasswordInput && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm">
          <div className="glassmorphism p-8 rounded-[32px] shadow-2xl space-y-6 max-w-sm w-full border border-white/10">
            <h2 className="text-2xl font-serif italic text-primary">{t(lang, 'adminAccess')}</h2>
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
              onClick={() => setActiveTab('Subscription')}
              className={`text-[10px] tracking-[0.2em] uppercase transition-all font-bold px-6 py-3 rounded-xl border ${activeTab === 'Subscription' ? 'text-primary bg-white/40 border-primary/20 shadow-lg' : 'text-text/40 border-transparent hover:text-text/60'}`}
            >
              {t(lang, 'subAndSupport')}
            </button>
            <button 
              onClick={() => setActiveTab('Orders')}
              className={`text-[10px] tracking-[0.2em] uppercase transition-all font-bold px-6 py-3 rounded-xl border ${activeTab === 'Orders' ? 'text-primary bg-white/40 border-primary/20 shadow-lg' : 'text-text/40 border-transparent hover:text-text/60'}`}
            >
              {t(lang, 'myOrders')}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={async () => {
              const newLang = lang === 'en' ? 'sw' : 'en';
              if (user) {
                await updateDoc(doc(db, 'users', user.uid), { language: newLang });
              } else {
                setLocalLang(newLang);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-white/40 hover:bg-white/60 border border-primary/10 rounded-xl text-xs font-bold uppercase tracking-widest text-primary transition-all shadow-sm"
          >
            <Globe size={14} />
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
      <main className="flex-1 px-6 py-32">
        <div className="max-w-7xl mx-auto space-y-12">
          {!user && (
            <div className="bg-white/50 p-8 rounded-[32px] border border-primary/10 text-center shadow-sm">
              <h2 className="text-2xl font-serif italic text-primary mb-4">
                {lang === 'sw' ? 'Karibu Coty!' : 'Welcome to Coty!'}
              </h2>
              <p className="text-text/60 font-medium mb-6">
                {lang === 'sw' 
                  ? 'Jisajili ili kuhifadhi taarifa zako, kufuatilia oda, na kufurahia huduma zetu kikamilifu.' 
                  : 'Register to save your information, track orders, and enjoy our services fully.'}
              </p>
              <button 
                onClick={() => setShowRegistration(true)}
                className="bg-primary text-white px-8 py-3 rounded-full font-bold hover:bg-secondary transition-all"
              >
                {t(lang, 'register')}
              </button>
            </div>
          )}
          
          {user && (
            <div className="max-w-md mx-auto">
              {settings.isLoyaltyEnabled === false && user?.role !== 'admin' ? (
                <div className="bg-white/50 p-8 rounded-[32px] border border-primary/10 text-center shadow-sm backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <h2 className="text-2xl font-serif italic text-primary">
                      {t(lang, 'comingSoon')}
                    </h2>
                    <p className="text-text/60 text-sm font-medium">
                      {lang === 'sw' 
                        ? 'Mfumo wa uaminifu (Loyalty) unaboreshwa. Tutarejea hivi punde!' 
                        : 'The loyalty system is being refined. We will be back shortly!'}
                    </p>
                    <div className="flex justify-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-150" />
                      <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce delay-300" />
                    </div>
                  </motion.div>
                </div>
              ) : (
                <LoyaltyCard user={user} lang={lang} onOpenRules={() => setIsRulesOpen(true)} />
              )}
            </div>
          )}
          
          {activeTab === 'Subscription' ? (
            <SubscriptionManager user={user} products={products} lang={lang} />
          ) : (
            <OrderManager user={user} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 pb-12 pt-6">
        <div className="max-w-7xl mx-auto bg-primary text-white rounded-[40px] p-12 sm:p-16 shadow-2xl border border-white/10 relative overflow-hidden">
          {/* Subtle decorative circle */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2 space-y-6">
              <span className="text-5xl font-playfair italic tracking-tighter text-white block">Coty</span>
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
