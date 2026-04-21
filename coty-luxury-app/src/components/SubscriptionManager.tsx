import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Package,
  ChevronRight,
  Plus,
  Minus,
  Trash2,
  Pause,
  Play
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  increment,
  Timestamp 
} from 'firebase/firestore';
import { Subscription, Product, UserProfile } from '../types';
import { t } from '../i18n';
import { getEATNow, calculateNextOrderDate } from '../services/SubscriptionService';

interface SubscriptionManagerProps {
  user: UserProfile | null;
  products: Product[];
  lang: 'en' | 'sw';
}

export default function SubscriptionManager({ user, products, lang }: SubscriptionManagerProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<{[productId: string]: number}>({});
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('24h');
  const [amPm, setAmPm] = useState<'AM' | 'PM'>('AM');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [butcherySearch, setButcherySearch] = useState('');
  const [marketSearch, setMarketSearch] = useState('');
  const [otherSearch, setOtherSearch] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'subscriptions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const subs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Subscription[];
      setSubscriptions(subs);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const toggleProduct = (product: Product) => {
    if (selectedProducts.find(p => p.id === product.id)) {
      setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
      const newQuantities = { ...quantities };
      delete newQuantities[product.id];
      setQuantities(newQuantities);
    } else {
      setSelectedProducts([...selectedProducts, product]);
      setQuantities({ ...quantities, [product.id]: 1 });
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [productId]: Math.max(1, (prev[productId] || 1) + delta)
    }));
  };

  const DAYS = [
    { en: 'Monday', sw: 'Jumatatu' },
    { en: 'Tuesday', sw: 'Jumanne' },
    { en: 'Wednesday', sw: 'Jumatano' },
    { en: 'Thursday', sw: 'Alhamisi' },
    { en: 'Friday', sw: 'Ijumaa' },
    { en: 'Saturday', sw: 'Jumamosi' },
    { en: 'Sunday', sw: 'Jumapili' }
  ];

  const toggleDay = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleAddSubscription = async () => {
    if (!user) return;

    if (selectedProducts.length === 0) {
      alert(lang === 'sw' ? 'Tafadhali chagua angalau bidhaa moja' : 'Please select at least one product');
      return;
    }

    // Validation: Time must be set
    if (!deliveryTime) {
      alert(lang === 'sw' ? 'Tafadhali weka saa ya kuletewa' : 'Please set a delivery time');
      return;
    }

    // Validation: Days must be set for weekly/monthly
    if ((frequency === 'weekly' || frequency === 'monthly') && selectedDays.length === 0) {
      alert(lang === 'sw' ? 'Tafadhali chagua angalau siku moja' : 'Please select at least one day');
      return;
    }

    let nextOrderDate = getEATNow();
    
    // Set time based on format
    let [hours, minutes] = deliveryTime.split(':').map(Number);
    if (timeFormat === '12h') {
      if (amPm === 'PM' && hours < 12) hours += 12;
      if (amPm === 'AM' && hours === 12) hours = 0;
    }
    
    nextOrderDate.setHours(hours, minutes, 0, 0);

    // If time is in the past OR if it's weekly/monthly and today is not a selected day
    const now = getEATNow();
    const DAYS_MAP: { [key: string]: number } = {
      'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6
    };

    if (nextOrderDate <= now) {
      nextOrderDate = calculateNextOrderDate(nextOrderDate, frequency, selectedDays);
    } else if ((frequency === 'weekly' || frequency === 'monthly') && selectedDays.length > 0) {
      const todayIndex = now.getDay();
      const isTodaySelected = selectedDays.some(day => DAYS_MAP[day] === todayIndex);
      if (!isTodaySelected) {
        // Find the next occurrence
        // We subtract 1 day from nextOrderDate because calculateNextOrderDate 
        // looks for the next day *after* the start date's day if it wraps, 
        // but if we are at today and today is not selected, we want the next one.
        // Actually, my calculateNextOrderDate logic:
        // if currentDayIndex = 1 (Mon), target = [3] (Wed). nextDayIndex = 3. daysToAdd = 2.
        // It works fine without subtracting.
        nextOrderDate = calculateNextOrderDate(nextOrderDate, frequency, selectedDays);
      }
    }

    setIsSubmitting(true);
    try {
      await Promise.all(selectedProducts.map(async (product) => {
        const qty = quantities[product.id] || 1;
        const subData: Omit<Subscription, 'id'> = {
          userId: user.uid,
          productId: product.id,
          productName: product.name,
          quantity: qty,
          price: product.price,
          frequency,
          status: 'active',
          nextOrderDate: nextOrderDate.toISOString(),
          createdAt: new Date().toISOString(),
          deliveryTime,
          timeFormat,
          amPm,
          selectedDays: (frequency === 'weekly' || frequency === 'monthly') ? selectedDays : []
        };
        await addDoc(collection(db, 'subscriptions'), subData);
      }));

      setIsAdding(false);
      setSelectedProducts([]);
      setQuantities({});
      setSelectedDays([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'subscriptions');
      alert(lang === 'sw' ? 'Imeshindwa kuhifadhi usajili. Tafadhali jaribu tena.' : 'Failed to save subscription. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (sub: Subscription) => {
    console.log("Toggle status clicked for:", sub.id);
    if (!sub.id) {
      console.error("No sub.id found");
      return;
    }
    const newStatus = sub.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'subscriptions', sub.id), { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'subscriptions/' + sub.id);
    }
  };

  const deleteSubscription = async (id: string) => {
    console.log("Delete clicked for:", id);
    if (!id) {
      console.error("No id found for deletion");
      return;
    }
    try {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          loyaltyCredits: increment(-3)
        });
      }
      await deleteDoc(doc(db, 'subscriptions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'subscriptions/' + id);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertCircle size={48} className="text-primary/40 mb-4" />
        <h2 className="text-2xl font-bold mb-2">{t(lang, 'loginRequired')}</h2>
        <p className="text-muted-foreground">{t(lang, 'loginToManage')}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-500 text-white px-8 py-4 rounded-2xl font-bold shadow-2xl flex items-center gap-3"
          >
            <CheckCircle2 size={24} />
            {lang === 'sw' ? 'Usajili umehifadhiwa kikamilifu!' : 'Subscription saved successfully!'}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 gap-4">
        <div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight mb-3">{t(lang, 'subscriptionTitle')}</h1>
          <p className="text-muted-foreground font-black text-sm uppercase tracking-widest leading-relaxed">{t(lang, 'autoDelivery')}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-6 sm:px-8 py-3 rounded-full font-medium flex items-center gap-2 shadow-xl shadow-primary/20 whitespace-nowrap"
        >
          <Plus size={20} />
          {t(lang, 'newSubscription')}
        </motion.button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="glassmorphism border border-white/10 rounded-[40px] p-20 text-center shadow-2xl">
          <Calendar size={64} className="mx-auto text-primary/20 mb-8" />
          <h3 className="text-3xl font-bold mb-4">{t(lang, 'noActiveSubs')}</h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-10 leading-relaxed">
            {t(lang, 'subDesc')}
          </p>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-primary text-white px-12 py-5 rounded-full font-black text-base shadow-lg shadow-primary/20 hover:bg-secondary transition-all"
          >
            {t(lang, 'createFirstSub')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {subscriptions.map((sub) => (
            <motion.div
              key={sub.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glassmorphism p-8 rounded-[32px] group relative overflow-hidden shadow-xl border border-white/10 transition-all hover:scale-[1.02]"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <RefreshCw size={80} />
              </div>
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col gap-2">
                  <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter ${
                    sub.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {sub.status}
                  </div>
                  {sub.lastOrderDate && new Date(sub.lastOrderDate).toDateString() === getEATNow().toDateString() && (
                    <div className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-tighter bg-primary/20 text-primary flex items-center gap-1.5">
                      <CheckCircle2 size={12} />
                      {t(lang, 'orderSent')}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 z-10">
                  <button 
                    onClick={() => toggleStatus(sub)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    {sub.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button 
                    onClick={() => sub.id && deleteSubscription(sub.id)}
                    className="p-2 hover:bg-red-500/20 text-red-400 rounded-full transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-3xl font-bold mb-3">{sub.productName}</h3>
              <div className="flex items-center gap-3 text-muted-foreground text-base mb-8 font-bold">
                <Package size={18} />
                <span>{sub.quantity} {t(lang, 'units')}</span>
                <span className="mx-1">•</span>
                <span>{sub.price.toLocaleString()} TZS</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Clock size={16} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-black mb-1">{t(lang, 'frequency')}</p>
                    <p className="font-black text-lg capitalize">{sub.frequency}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest opacity-60 font-black mb-1">{t(lang, 'nextDelivery')}</p>
                    <p className="font-black text-lg">{new Date(sub.nextOrderDate).toLocaleDateString()} {sub.deliveryTime && `at ${sub.deliveryTime}`}</p>
                    {sub.selectedDays && sub.selectedDays.length > 0 && (
                      <p className="text-xs text-primary mt-2 font-black italic">
                        {sub.selectedDays.map(day => {
                          const dayObj = DAYS.find(d => d.en === day);
                          return lang === 'sw' ? dayObj?.sw : dayObj?.en;
                        }).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Subscription Modal */}
      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdding(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glassmorphism border border-white/10 w-full max-w-2xl rounded-[30px] sm:rounded-[40px] overflow-hidden relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 sm:p-12">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold mb-2">{t(lang, 'newSubscription')}</h2>
                    <p className="text-muted-foreground text-sm">{t(lang, 'customizeOrder')}</p>
                  </div>
                  <button 
                    onClick={() => setIsAdding(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <XCircle size={24} />
                  </button>
                </div>

                <div className="space-y-8">
                  {products.length === 0 ? (
                    <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/10">
                      <p className="text-muted-foreground italic">{t(lang, 'noProducts')}</p>
                    </div>
                  ) : (
                    <>
                      {/* Product Selection */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Butchery Section */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] uppercase tracking-widest opacity-50 block">{t(lang, 'butchery')}</label>
                            <input 
                              type="text" 
                              placeholder={t(lang, 'search')} 
                              value={butcherySearch}
                              onChange={(e) => setButcherySearch(e.target.value)}
                              className="text-[10px] bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 focus:outline-none focus:border-primary/50 w-40 transition-all shadow-sm"
                            />
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {products.filter(p => 
                              p.isAvailable !== false && 
                              ['Butchery', 'Poultry', 'Seafood', 'Processed', 'Specialty'].includes(p.category) &&
                              p.name.toLowerCase().includes(butcherySearch.toLowerCase())
                            ).length === 0 ? (
                              <p className="text-[10px] text-muted-foreground italic p-3">{t(lang, 'noButcheryFound')}</p>
                            ) : (
                              products.filter(p => 
                                p.isAvailable !== false && 
                                ['Butchery', 'Poultry', 'Seafood', 'Processed', 'Specialty'].includes(p.category) &&
                                p.name.toLowerCase().includes(butcherySearch.toLowerCase())
                              ).map(p => (
                                <div key={p.id} onClick={() => toggleProduct(p)} className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all cursor-pointer bg-white/5 backdrop-blur-md">
                                  <div
                                    className={`w-6 h-6 rounded-full border flex items-center justify-center ${selectedProducts.find(sp => sp.id === p.id) ? 'bg-primary border-primary' : 'border-white/20'}`}
                                  >
                                    {selectedProducts.find(sp => sp.id === p.id) && <CheckCircle2 size={14} className="text-white" />}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{p.name}</p>
                                    <p className="text-xs opacity-50">{p.price.toLocaleString()} TZS</p>
                                  </div>
                                  {selectedProducts.find(sp => sp.id === p.id) && (
                                    <div className="flex items-center gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, -1); }} className="p-1 hover:text-primary"><Minus size={14} /></button>
                                      <span className="text-sm font-bold w-4 text-center">{quantities[p.id] || 1}</span>
                                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, 1); }} className="p-1 hover:text-primary"><Plus size={14} /></button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* African Market Section */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <label className="text-[10px] uppercase tracking-widest opacity-50 block">{t(lang, 'africanMarket')}</label>
                            <input 
                              type="text" 
                              placeholder={t(lang, 'search')} 
                              value={marketSearch}
                              onChange={(e) => setMarketSearch(e.target.value)}
                              className="text-[10px] bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 focus:outline-none focus:border-primary/50 w-40 transition-all shadow-sm"
                            />
                          </div>
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {products.filter(p => 
                              p.isAvailable !== false && 
                              p.category === 'African Market' &&
                              p.name.toLowerCase().includes(marketSearch.toLowerCase())
                            ).length === 0 ? (
                              <p className="text-[10px] text-muted-foreground italic p-3">{t(lang, 'noMarketFound')}</p>
                            ) : (
                              products.filter(p => 
                                p.isAvailable !== false && 
                                p.category === 'African Market' &&
                                p.name.toLowerCase().includes(marketSearch.toLowerCase())
                              ).map(p => (
                                <div key={p.id} onClick={() => toggleProduct(p)} className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all cursor-pointer bg-white/5 backdrop-blur-md">
                                  <div
                                    className={`w-6 h-6 rounded-full border flex items-center justify-center ${selectedProducts.find(sp => sp.id === p.id) ? 'bg-primary border-primary' : 'border-white/20'}`}
                                  >
                                    {selectedProducts.find(sp => sp.id === p.id) && <CheckCircle2 size={14} className="text-white" />}
                                  </div>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm">{p.name}</p>
                                    <p className="text-xs opacity-50">{p.price.toLocaleString()} TZS</p>
                                  </div>
                                  {selectedProducts.find(sp => sp.id === p.id) && (
                                    <div className="flex items-center gap-2">
                                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, -1); }} className="p-1 hover:text-primary"><Minus size={14} /></button>
                                      <span className="text-sm font-bold w-4 text-center">{quantities[p.id] || 1}</span>
                                      <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, 1); }} className="p-1 hover:text-primary"><Plus size={14} /></button>
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Other Products Section */}
                      <div>
                        <div className="flex justify-between items-center mb-3">
                          <label className="text-[10px] uppercase tracking-widest opacity-50 block">{t(lang, 'otherProducts')}</label>
                          <input 
                            type="text" 
                            placeholder={t(lang, 'search')} 
                            value={otherSearch}
                            onChange={(e) => setOtherSearch(e.target.value)}
                            className="text-[10px] bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 focus:outline-none focus:border-primary/50 w-40 transition-all shadow-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {products.filter(p => 
                            p.isAvailable !== false && 
                            !['Butchery', 'Poultry', 'Seafood', 'Processed', 'Specialty', 'African Market'].includes(p.category) &&
                            p.name.toLowerCase().includes(otherSearch.toLowerCase())
                          ).length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic p-3 col-span-full">{t(lang, 'noOtherFound')}</p>
                          ) : (
                            products.filter(p => 
                              p.isAvailable !== false && 
                              !['Butchery', 'Poultry', 'Seafood', 'Processed', 'Specialty', 'African Market'].includes(p.category) &&
                              p.name.toLowerCase().includes(otherSearch.toLowerCase())
                            ).map(p => (
                              <div key={p.id} onClick={() => toggleProduct(p)} className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all cursor-pointer bg-white/5 backdrop-blur-md">
                                <div
                                  className={`w-6 h-6 rounded-full border flex items-center justify-center ${selectedProducts.find(sp => sp.id === p.id) ? 'bg-primary border-primary' : 'border-white/20'}`}
                                >
                                  {selectedProducts.find(sp => sp.id === p.id) && <CheckCircle2 size={14} className="text-white" />}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{p.name}</p>
                                  <p className="text-xs opacity-50">{p.price.toLocaleString()} TZS</p>
                                </div>
                                {selectedProducts.find(sp => sp.id === p.id) && (
                                  <div className="flex items-center gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, -1); }} className="p-1 hover:text-primary"><Minus size={14} /></button>
                                    <span className="text-sm font-bold w-4 text-center">{quantities[p.id] || 1}</span>
                                    <button onClick={(e) => { e.stopPropagation(); updateQuantity(p.id, 1); }} className="p-1 hover:text-primary"><Plus size={14} /></button>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {/* Frequency */}
                    <div>
                      <label className="text-[10px] uppercase tracking-widest opacity-50 mb-3 block">{t(lang, 'frequency')}</label>
                      <div className="flex flex-col gap-2">
                        {(['daily', 'weekly', 'monthly'] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => {
                              setFrequency(f);
                              if (f === 'daily') setSelectedDays([]);
                            }}
                            className={`px-6 py-3 rounded-xl border text-sm font-medium transition-all text-left flex items-center justify-between ${
                              frequency === f 
                                ? 'border-primary bg-primary/10 text-primary' 
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <span className="capitalize">{f}</span>
                            {frequency === f && <CheckCircle2 size={16} />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Day Selection for Weekly/Monthly */}
                    {(frequency === 'weekly' || frequency === 'monthly') && (
                      <div className="col-span-full">
                        <label className="text-[10px] uppercase tracking-widest opacity-50 mb-3 block">
                          {lang === 'sw' ? 'Chagua Siku za Kuletewa' : 'Select Delivery Days'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {DAYS.map((day) => (
                            <button
                              key={day.en}
                              onClick={() => toggleDay(day.en)}
                              className={`px-4 py-2 rounded-xl border text-xs font-medium transition-all ${
                                selectedDays.includes(day.en)
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-white/10 hover:border-white/20'
                              }`}
                            >
                              {lang === 'sw' ? day.sw : day.en}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Delivery Time */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] uppercase tracking-widest opacity-50 block">
                          {t(lang, 'deliveryTime')}
                          {!deliveryTime && (
                            <span className="text-red-400 ml-2 animate-pulse">
                              ({lang === 'sw' ? 'Lazima uweke saa' : 'Required'})
                            </span>
                          )}
                        </label>
                        <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                          {(['12h', '24h'] as const).map((f) => (
                            <button
                              key={f}
                              onClick={() => setTimeFormat(f)}
                              className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-all ${
                                timeFormat === f ? 'bg-primary text-white shadow-sm' : 'text-text/40 hover:text-text/60'
                              }`}
                            >
                              {t(lang, f as any)}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <input
                            type="time"
                            value={deliveryTime}
                            onChange={(e) => setDeliveryTime(e.target.value)}
                            className="w-full px-6 py-3 rounded-xl border border-white/10 bg-transparent text-sm font-medium focus:border-primary focus:bg-primary/10 transition-all"
                          />
                        </div>
                        {timeFormat === '12h' && (
                          <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
                            {(['AM', 'PM'] as const).map((p) => (
                              <button
                                key={p}
                                onClick={() => setAmPm(p)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                  amPm === p ? 'bg-primary text-white shadow-sm' : 'text-text/40 hover:text-text/60'
                                }`}
                              >
                                {t(lang, p.toLowerCase() as any)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {!deliveryTime && (
                        <p className="text-[10px] text-red-400/80 italic mt-1">
                          {lang === 'sw' 
                            ? '* Tafadhali weka saa ya kuletewa ili kuendelea' 
                            : '* Please set a delivery time to continue'}
                        </p>
                      )}
                    </div>
                  </div>

                    {/* Total */}
                    <div className="flex flex-col justify-end">
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <p className="text-[10px] uppercase tracking-widest opacity-50 mb-2">{t(lang, 'totalPerDelivery')}</p>
                        <p className="text-3xl font-bold">
                          {selectedProducts.reduce((sum, p) => sum + (p.price * (quantities[p.id] || 1)), 0).toLocaleString()} TZS
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10 flex items-center justify-end">
                    <button
                      disabled={isSubmitting}
                      onClick={handleAddSubscription}
                      className="bg-primary text-white px-12 py-4 rounded-full font-medium shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          {lang === 'sw' ? 'Inahifadhi...' : 'Saving...'}
                        </>
                      ) : (
                        lang === 'sw' ? 'THIBITISHA USAJILI' : 'CONFIRM SUBSCRIPTION'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }
