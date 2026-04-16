import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, setDoc, getDocs, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Order, UserProfile, Product, Subscription, Redemption } from '../types';
import { t } from '../i18n';
import { PRODUCTS } from '../constants';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Clock, CheckCircle, Truck, X, User as UserIcon, Users, Settings, LogOut, LayoutDashboard, ShoppingBag, Plus, Trash2, Edit2, Save, Search, Filter, Download, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle2, Calendar, RefreshCw, Gift, Tag, Sparkles } from 'lucide-react';

interface AdminDashboardProps {
  user: UserProfile;
  onLogout: () => void;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout, onClose }) => {
  const [activeTab, setActiveTab] = useState<'orders' | 'users' | 'products' | 'settings' | 'subscriptions' | 'redemptions'>('orders');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Order['status'] | 'all' | 'subscription'>('all');
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplyingPopup, setIsApplyingPopup] = useState(false);

  useEffect(() => {
    const ordersQuery = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    const usersQuery = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const productsQuery = query(collection(db, 'products'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'site'), (snapshot) => {
      if (snapshot.exists()) setSettings(snapshot.data());
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/site'));

    const unsubSubs = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
      setSubscriptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Subscription[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'subscriptions'));

    const unsubRedemptions = onSnapshot(query(collection(db, 'redemptions'), orderBy('createdAt', 'desc')), (snapshot) => {
      setRedemptions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Redemption[]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'redemptions'));

    return () => {
      unsubscribeOrders();
      unsubscribeUsers();
      unsubscribeProducts();
      unsubscribeSettings();
      unsubSubs();
      unsubRedemptions();
    };
  }, []);

  const updateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const updateData: any = { status };

      // Rule: For orders that haven't been awarded points yet, add credits when status becomes 'processing'
      if (status === 'processing' && order.status === 'pending' && !order.pointsAwarded) {
        const userRef = doc(db, 'users', order.userId);
        await updateDoc(userRef, {
          loyaltyCredits: increment(3 * (order.items?.length || 1)),
          loyaltyPoints: increment(Math.floor(order.totalAmount / 1000))
        });
        updateData.pointsAwarded = true;
      }

      await updateDoc(doc(db, 'orders', orderId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'orders/' + orderId);
    }
  };

  const deleteOrder = async (orderId: string) => {
    setIsDeleting(true);
    try {
      const order = orders.find(o => o.id === orderId);
      if (order && order.pointsAwarded) {
        const userRef = doc(db, 'users', order.userId);
        await updateDoc(userRef, {
          loyaltyCredits: increment(-(3 * (order.items?.length || 1))),
          loyaltyPoints: increment(-Math.floor(order.totalAmount / 1000))
        });
      }
      await deleteDoc(doc(db, 'orders', orderId));
      setOrderToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'orders/' + orderId);
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteUser = async (uid: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users/' + uid);
    } finally {
      setIsDeleting(false);
    }
  };

  const updateUserRole = async (uid: string, role: 'client' | 'admin') => {
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users/' + uid);
    }
  };

  const updateProductPrice = async (productId: string, price: number) => {
    try {
      await updateDoc(doc(db, 'products', productId), { price });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'products/' + productId);
    }
  };

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [localPopupSettings, setLocalPopupSettings] = useState({
    title: '',
    message: '',
    imageUrl: '',
    isEnabled: false
  });

  useEffect(() => {
    if (settings) {
      setLocalPopupSettings({
        title: settings.popupTitle || '',
        message: settings.popupMessage || '',
        imageUrl: settings.popupImageUrl || '',
        isEnabled: settings.isPopupEnabled || false
      });
    }
  }, [settings]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size before processing (limit to 5MB raw for safety)
      if (file.size > 1024 * 1024 * 5) {
        alert("Image is too large. Please choose an image under 5MB.");
        return;
      }

      setIsProcessingImage(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions for pop-up (e.g., 800px)
          const MAX_DIM = 800;
          if (width > height) {
            if (width > MAX_DIM) {
              height *= MAX_DIM / width;
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width *= MAX_DIM / height;
              height = MAX_DIM;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            alert("Could not process image.");
            setIsProcessingImage(false);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.6 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          
          // Final check on compressed size (Firestore limit is 1MB total for doc)
          if (compressedDataUrl.length > 900000) { // ~900KB
            alert("Even after compression, this image is too large for the database. Please use a smaller image or a URL.");
            setIsProcessingImage(false);
            return;
          }

          setLocalPopupSettings(prev => ({ ...prev, imageUrl: compressedDataUrl }));
          setIsProcessingImage(false);
        };
        img.onerror = () => {
          alert("Failed to load image. Please try another file.");
          setIsProcessingImage(false);
        };
        img.src = event.target?.result as string;
      };
      reader.onerror = () => {
        alert("Failed to read file.");
        setIsProcessingImage(false);
      };
      reader.readAsDataURL(file);
      // Reset input value to allow re-uploading the same file
      e.target.value = '';
    }
  };

  const handleApplyPopup = async () => {
    // Final safety check on size
    const totalSize = (localPopupSettings.title?.length || 0) + 
                     (localPopupSettings.message?.length || 0) + 
                     (localPopupSettings.imageUrl?.length || 0);
    
    if (totalSize > 900000) { // ~900KB
      alert("The total size of the pop-up settings is too large. Please use a smaller image or a URL.");
      return;
    }

    setIsApplyingPopup(true);
    try {
      await setDoc(doc(db, 'settings', 'site'), {
        popupTitle: localPopupSettings.title,
        popupMessage: localPopupSettings.message,
        popupImageUrl: localPopupSettings.imageUrl,
        isPopupEnabled: true, // Force enable when applying
        popupLastUpdated: Date.now() // Add timestamp to trigger re-show
      }, { merge: true });
      setImportStatus({ type: 'success', message: 'Pop-up ad settings applied successfully!' });
      setTimeout(() => setImportStatus(null), 5000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/site');
      setImportStatus({ type: 'error', message: 'Failed to apply pop-up settings.' });
      setTimeout(() => setImportStatus(null), 5000);
    } finally {
      setIsApplyingPopup(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    // Safety check on size if value is a string
    if (typeof value === 'string' && value.length > 900000) {
      alert("The value you are trying to save is too large for the database.");
      return;
    }
    
    try {
      await setDoc(doc(db, 'settings', 'site'), { [key]: value }, { merge: true });
      if (key === 'isPopupEnabled') {
        setImportStatus({ 
          type: 'success', 
          message: value ? 'Pop-up ad enabled!' : 'Pop-up ad disabled!' 
        });
        setTimeout(() => setImportStatus(null), 3000);
      } else if (key === 'isLoyaltyEnabled') {
        setImportStatus({ 
          type: 'success', 
          message: value ? 'Loyalty system is now LIVE!' : 'Loyalty system is now DISABLED (Coming Soon mode)!' 
        });
        setTimeout(() => setImportStatus(null), 3000);
      } else if (key === 'isOpen') {
        setImportStatus({ 
          type: 'success', 
          message: value ? 'Store is now OPEN!' : 'Store is now CLOSED!' 
        });
        setTimeout(() => setImportStatus(null), 3000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/site');
    }
  };

  const handleClearAllProducts = async () => {
    setImportStatus({ type: 'success', message: 'Clearing all products... Please wait.' });
    try {
      const productsSnapshot = await getDocs(collection(db, 'products'));
      
      // Delete existing products in batches
      const deleteBatches = [];
      for (let i = 0; i < productsSnapshot.docs.length; i += 400) {
        const batch = writeBatch(db);
        productsSnapshot.docs.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
        deleteBatches.push(batch.commit());
      }
      await Promise.all(deleteBatches);

      setImportStatus({ type: 'success', message: 'All products have been cleared! You can now import new ones.' });
    } catch (error: any) {
      console.error(error);
      setImportStatus({ type: 'error', message: 'Failed to clear products.' });
    }
  };

  const handleFileImport = async (file: File, type: 'butchery' | 'market') => {
    setImportStatus(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const data = e.target?.result;
      let results: any[] = [];

      try {
        if (file.name.endsWith('.csv')) {
          const text = data as string;
          results = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
        } else {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          results = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        }

        if (results.length === 0) {
          setImportStatus({ type: 'error', message: 'No data found in file.' });
          return;
        }

        // Delete existing products of this type first
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const toDelete = productsSnapshot.docs.filter(doc => {
          const p = doc.data() as Product;
          if (type === 'butchery') {
            return ['Butchery', 'Poultry', 'Seafood', 'Processed', 'Specialty'].includes(p.category);
          } else {
            return p.category === 'African Market';
          }
        });

        // Use multiple batches if needed (Firestore limit is 500)
        const deleteBatches = [];
        for (let i = 0; i < toDelete.length; i += 400) {
          const batch = writeBatch(db);
          toDelete.slice(i, i + 400).forEach(doc => batch.delete(doc.ref));
          deleteBatches.push(batch.commit());
        }
        await Promise.all(deleteBatches);

        // Import new products
        const importBatches = [];
        let currentBatch = writeBatch(db);
        let count = 0;

        results.forEach((row: any) => {
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = row[key];
          });

          // Look for name/product/item/bidhaa
          const name = normalizedRow.name || normalizedRow.product || normalizedRow.item || normalizedRow.bidhaa || normalizedRow.jina;
          
          // Look for price/bei/amount/cost/tzs
          let priceRaw = normalizedRow.price || normalizedRow.bei || normalizedRow.amount || normalizedRow.cost || normalizedRow.tzs || normalizedRow.priceperkg || normalizedRow.priceperunit;
          
          // If price is still not found, try to find any key that contains "price" or "bei"
          if (priceRaw === undefined) {
            const priceKey = Object.keys(normalizedRow).find(k => k.includes('price') || k.includes('bei'));
            if (priceKey) priceRaw = normalizedRow[priceKey];
          }

          if (name) {
            // Clean price: remove commas, currency symbols, etc.
            let price = 0;
            if (typeof priceRaw === 'number') {
              price = priceRaw;
            } else if (typeof priceRaw === 'string') {
              price = Number(priceRaw.replace(/[^0-9.]/g, '')) || 0;
            }

            const category = normalizedRow.category || (type === 'butchery' ? 'Butchery' : 'African Market');
            const validCategories = ['Butchery', 'Poultry', 'Seafood', 'Processed', 'African Market', 'Specialty'];
            const finalCategory = validCategories.find(c => c.toLowerCase() === String(category).toLowerCase()) || (type === 'butchery' ? 'Butchery' : 'African Market');

            const newProductRef = doc(collection(db, 'products'));
            currentBatch.set(newProductRef, {
              name: String(name).trim(),
              category: finalCategory,
              price: price,
              unit: normalizedRow.unit || normalizedRow.kipimo || 'kg',
              isAvailable: true,
              sku: normalizedRow.sku || normalizedRow.code || '',
              description: normalizedRow.description || normalizedRow.maelezo || '',
              subCategory: normalizedRow.subcategory || normalizedRow.subcat || '',
              imageUrl: normalizedRow.imageurl || normalizedRow.image || normalizedRow.picha || '',
            });
            
            count++;
            if (count % 400 === 0) {
              importBatches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
            }
          }
        });

        if (count % 400 !== 0) {
          importBatches.push(currentBatch.commit());
        }

        await Promise.all(importBatches);
        setImportStatus({ type: 'success', message: `Successfully imported ${count} products!` });
      } catch (error: any) {
        console.error(error);
        setImportStatus({ type: 'error', message: 'Failed to import products. Check file format.' });
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.id || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                         order.userId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'subscription' ? order.source === 'subscription' : order.status === statusFilter);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-bg">
      {/* Delete Order Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl space-y-6 max-w-sm w-full border border-primary/10">
            <h2 className="text-2xl font-serif italic text-primary">{t(user.language || 'en', 'confirmDelete')}</h2>
            <p className="text-sm text-text/60 leading-relaxed">
              Are you sure you want to delete this order?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setOrderToDelete(null)} 
                disabled={isDeleting}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {t(user.language || 'en', 'cancel')}
              </button>
              <button 
                onClick={() => orderToDelete && deleteOrder(orderToDelete)} 
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={18} /> : t(user.language || 'en', 'delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl space-y-6 max-w-sm w-full border border-primary/10">
            <h2 className="text-2xl font-serif italic text-primary">{t(user.language || 'en', 'confirmDelete')}</h2>
            <p className="text-sm text-text/60 leading-relaxed">
              Are you sure you want to delete this user? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setUserToDelete(null)} 
                disabled={isDeleting}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {t(user.language || 'en', 'cancel')}
              </button>
              <button 
                onClick={() => userToDelete && deleteUser(userToDelete)} 
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={18} /> : t(user.language || 'en', 'delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto bg-white rounded-[40px] p-8 sm:p-12 shadow-2xl border border-primary/10">
        <header className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
              <LayoutDashboard className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-3xl font-serif italic">Admin Portal</h1>
              <p className="text-muted-foreground text-sm">Welcome back, {user.displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white hover:bg-secondary rounded-2xl transition-all shadow-lg shadow-primary/20 text-sm font-bold"
            >
              <ShoppingBag size={18} /> Back to Store
            </button>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 text-sm font-bold"
            >
              <LogOut size={18} /> Sign Out
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <aside className="lg:col-span-1 space-y-3">
            {[
              { id: 'orders', icon: ShoppingBag, label: t(user.language || 'sw', 'myOrders') },
              { id: 'subscriptions', icon: Calendar, label: t(user.language || 'sw', 'subscriptionTitle') },
              { id: 'redemptions', icon: Gift, label: 'Redemptions' },
              { id: 'users', icon: Users, label: 'Users' },
              { id: 'products', icon: Package, label: 'Products' },
              { id: 'settings', icon: Settings, label: 'Settings' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-4 px-8 py-5 rounded-[24px] transition-all font-bold text-sm border ${activeTab === tab.id ? 'bg-primary text-white shadow-2xl shadow-primary/30 border-primary/20 scale-[1.05] z-10' : 'bg-white/5 hover:bg-white/10 text-text/50 border-white/10'}`}
              >
                <tab.icon size={22} />
                <span className="tracking-widest uppercase text-[10px]">{tab.label}</span>
              </button>
            ))}
          </aside>

          <main className="lg:col-span-3 space-y-8">
            {importStatus && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`p-4 rounded-2xl shadow-lg border border-white/10 flex items-center gap-3 ${importStatus.type === 'success' ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-red-500/10 text-red-600 border-red-500/20'}`}
              >
                {importStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                <p className="text-sm font-bold uppercase tracking-widest flex-1">{importStatus.message}</p>
                <button onClick={() => setImportStatus(null)} className="opacity-50 hover:opacity-100 transition-opacity">
                  <X size={16} />
                </button>
              </motion.div>
            )}

            {activeTab === 'orders' ? (
              <>
                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search orders..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all text-sm font-medium"
                    />
                  </div>
                  <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-6 py-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="subscription">Subscription Orders</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>

                <div className="space-y-6">
                  {filteredOrders.map(order => (
                    <div key={order.id} className="glassmorphism p-8 rounded-[32px] border border-white/10 shadow-xl transition-all hover:scale-[1.01]">
                      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <ShoppingBag size={24} />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-primary/60 mb-1 uppercase tracking-[0.2em]">
                              Order Reference #{order.id?.slice(-6)} 
                              {order.source === 'lyra' && <span className="ml-2 bg-accent/20 text-accent px-2 py-0.5 rounded-full">LYRA AI</span>}
                              {order.source === 'subscription' && <span className="ml-2 bg-primary/20 text-primary px-2 py-0.5 rounded-full">SUBSCRIPTION</span>}
                            </p>
                            <p className="font-serif italic text-xl text-primary">{order.customerName || users.find(u => u.uid === order.userId)?.displayName || 'Unknown Customer'}</p>
                            <p className="text-xs text-text/60 font-medium">{order.customerPhone || 'No Phone'}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <p className="text-[10px] text-text/40 font-medium">{new Date(order.createdAt).toLocaleString()}</p>
                              {order.deliveryTime && (
                                <div className="flex items-center gap-1 text-primary/60">
                                  <Clock size={10} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Scheduled: {order.deliveryTime}</span>
                                </div>
                              )}
                              {order.selectedDays && order.selectedDays.length > 0 && (
                                <div className="flex items-center gap-1 text-accent/60">
                                  <Calendar size={10} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Days: {order.selectedDays.join(', ')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 bg-white/10 p-2 rounded-2xl border border-white/10 items-center">
                          {(['pending', 'processing', 'shipped', 'delivered'] as Order['status'][]).map(status => (
                            <button
                              key={status}
                              onClick={() => updateOrderStatus(order.id!, status)}
                              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${order.status === status ? 'bg-primary text-white shadow-lg border-primary/20' : 'bg-transparent hover:bg-white/10 text-text/40 border-transparent hover:text-text/60'}`}
                            >
                              {status}
                            </button>
                          ))}
                          <button 
                            onClick={() => setOrderToDelete(order.id!)}
                            className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 ml-2"
                            title="Delete Order"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 space-y-3 border border-white/10 shadow-inner">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm items-center">
                            <span className="text-text/60 font-medium">{item.name} <span className="text-[10px] opacity-40 ml-2">x {item.quantity}</span></span>
                            <span className="font-bold text-primary">{(item.price * item.quantity).toLocaleString()} <span className="text-[10px] font-normal opacity-50">TZS</span></span>
                          </div>
                        ))}
                        <div className="pt-4 mt-2 border-t border-white/10 flex justify-between items-center">
                          <span className="text-xs font-bold uppercase tracking-widest opacity-40">Total Amount</span>
                          <span className="text-xl font-bold text-primary">{order.totalAmount.toLocaleString()} <span className="text-xs font-normal opacity-60">TZS</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : activeTab === 'subscriptions' ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-serif italic text-primary mb-6">Active Subscriptions</h2>
                {subscriptions.length === 0 ? (
                  <div className="glassmorphism p-12 rounded-[32px] text-center border border-white/10">
                    <Calendar size={48} className="mx-auto mb-4 text-primary/20" />
                    <p className="text-text/40 font-medium tracking-widest uppercase text-xs">No active subscriptions found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {subscriptions.map(sub => (
                      <div key={sub.id} className="glassmorphism p-8 rounded-[32px] border border-white/10 shadow-xl">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                              <Calendar size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-primary/60 mb-1 uppercase tracking-[0.2em]">Subscription #{sub.id?.slice(-6)}</p>
                              <p className="font-serif italic text-xl text-primary">{users.find(u => u.uid === sub.userId)?.displayName || 'Unknown Customer'}</p>
                              <p className="text-xs text-text/60 font-medium">{users.find(u => u.uid === sub.userId)?.phoneNumber || 'No Phone'}</p>
                              {sub.selectedDays && sub.selectedDays.length > 0 && (
                                <p className="text-[10px] text-primary/60 font-bold italic mt-1">
                                  Days: {sub.selectedDays.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Frequency: {sub.frequency}</span>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 space-y-3 border border-white/10">
                          <div className="flex justify-between text-sm items-center">
                            <span className="text-text/60 font-medium">{sub.productName} <span className="text-[10px] opacity-40 ml-2">x {sub.quantity}</span></span>
                            <span className="font-bold text-primary">{(sub.price * sub.quantity).toLocaleString()} TZS</span>
                          </div>
                          <div className="flex justify-between text-sm items-center pt-2">
                            <span className="text-text/40 text-[10px] uppercase tracking-widest font-bold">Delivery Time</span>
                            <span className="font-bold text-primary/60 text-xs">{sub.deliveryTime} {sub.timeFormat === '12h' ? sub.amPm : ''}</span>
                          </div>
                          <div className="pt-4 mt-2 border-t border-white/10 flex justify-between items-center">
                            <span className="text-xs font-bold uppercase tracking-widest opacity-40">Total Per Delivery</span>
                            <span className="text-xl font-bold text-primary">{(sub.price * sub.quantity).toLocaleString()} TZS</span>
                          </div>
                        </div>
                        <div className="mt-6 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-text/40">
                          <div className="flex flex-col gap-1">
                            <span>Next Delivery: {new Date(sub.nextOrderDate).toLocaleDateString()}</span>
                            <span>Created: {new Date(sub.createdAt).toLocaleDateString()}</span>
                          </div>
                          <button
                            onClick={async () => {
                              if (window.confirm('Are you sure you want to delete this subscription? Loyalty credits will be deducted.')) {
                                try {
                                  const userRef = doc(db, 'users', sub.userId);
                                  await updateDoc(userRef, {
                                    loyaltyCredits: increment(-3)
                                  });
                                  await deleteDoc(doc(db, 'subscriptions', sub.id!));
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.DELETE, 'subscriptions/' + sub.id);
                                }
                              }
                            }}
                            className="p-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Subscription Order History */}
                <div className="mt-12">
                  <h3 className="text-xl font-serif italic text-primary mb-6 flex items-center gap-2">
                    <Clock className="text-primary/40" size={20} />
                    Recent Subscription Orders
                  </h3>
                  <div className="space-y-4">
                    {orders.filter(o => o.source === 'subscription').slice(0, 10).map(order => (
                      <div key={order.id} className="glassmorphism p-6 rounded-[24px] border border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <Package size={18} />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{order.customerName}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-text/40 font-medium">{new Date(order.createdAt).toLocaleString()}</p>
                              {order.deliveryTime && (
                                <span className="text-[10px] text-primary/60 font-bold uppercase tracking-widest flex items-center gap-1">
                                  <Clock size={8} /> {order.deliveryTime}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs font-bold text-primary">{order.totalAmount.toLocaleString()} TZS</p>
                            <p className="text-[10px] text-text/40 font-medium uppercase tracking-widest">{order.status}</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${
                            order.status === 'delivered' ? 'bg-green-500' : 
                            order.status === 'shipped' ? 'bg-blue-500' : 
                            'bg-yellow-500'
                          }`} />
                        </div>
                      </div>
                    ))}
                    {orders.filter(o => o.source === 'subscription').length === 0 && (
                      <p className="text-center text-text/40 text-xs py-8 border border-dashed border-white/10 rounded-[24px]">No subscription orders generated yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : activeTab === 'redemptions' ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-serif italic text-primary mb-6">Loyalty Redemptions</h2>
                {redemptions.length === 0 ? (
                  <div className="glassmorphism p-12 rounded-[32px] text-center border border-white/10">
                    <Gift size={48} className="mx-auto mb-4 text-primary/20" />
                    <p className="text-text/40 font-medium tracking-widest uppercase text-xs">No redemptions found</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-6">
                    {redemptions.map(redemption => (
                      <div key={redemption.id} className="glassmorphism p-8 rounded-[32px] border border-white/10 shadow-xl">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                              <Gift size={24} />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-primary/60 mb-1 uppercase tracking-[0.2em]">Redemption #{redemption.id?.slice(-6)}</p>
                              <p className="font-serif italic text-xl text-primary">{redemption.userName}</p>
                              <p className="text-xs text-text/60 font-medium">{redemption.userEmail}</p>
                            </div>
                          </div>
                          <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10 flex items-center gap-2">
                            <Sparkles size={14} className="text-primary" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Points: {redemption.points}</span>
                          </div>
                        </div>
                        <div className="bg-white/5 rounded-2xl p-6 border border-white/10 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-xl text-primary">
                              {redemption.reward === 'FREE DELIVERY' ? <Truck size={24} /> : 
                               redemption.reward === 'ONE FOR FREE' ? <Package size={24} /> : 
                               <Tag size={24} />}
                            </div>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest opacity-40">Chosen Reward</p>
                              <p className="text-lg font-bold text-primary">{redemption.reward}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-text/40">Status</p>
                            <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${redemption.status === 'completed' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}>
                              {redemption.status}
                            </span>
                          </div>
                        </div>
                        <div className="mt-6 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-text/40">
                          <span>Redeemed on: {new Date(redemption.createdAt).toLocaleString()}</span>
                          {redemption.status === 'pending' && (
                            <button 
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db, 'redemptions', redemption.id!), { status: 'completed' });
                                } catch (error) {
                                  handleFirestoreError(error, OperationType.UPDATE, 'redemptions/' + redemption.id);
                                }
                              }}
                              className="bg-primary text-white px-6 py-2 rounded-xl hover:bg-secondary transition-all shadow-lg shadow-primary/20"
                            >
                              {(user.language || 'en') === 'sw' ? 'Thibitisha Utekelezaji' : 'Confirm Fulfillment'}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'users' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {users.map(u => (
                  <div key={u.uid} className="bg-white p-6 rounded-[24px] flex items-center gap-6 border border-primary/10 shadow-lg transition-all hover:scale-[1.02]">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
                      <UserIcon className="text-primary" size={28} />
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{u.displayName}</p>
                      <p className="text-xs text-text/40 font-medium uppercase tracking-widest">{u.email}</p>
                      <div className="flex gap-4 mt-2">
                        <span className="text-[10px] font-bold text-primary/60">Credits: {u.loyaltyCredits || 0}</span>
                        <span className="text-[10px] font-bold text-primary/60">Points: {u.loyaltyPoints || 0}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <select 
                        value={u.role}
                        onChange={(e) => updateUserRole(u.uid, e.target.value as any)}
                        className="bg-gray-50 border border-primary/10 rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest focus:outline-none focus:border-primary"
                      >
                        <option value="client">Client</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button 
                        onClick={() => setUserToDelete(u.uid)}
                        className="w-full py-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : activeTab === 'products' ? (
              <>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-primary">
                  Product Management <span className="bg-primary text-white text-xs px-2 py-1 rounded-full shadow-md">{products.length}</span>
                </h3>
                
                <div className="flex flex-wrap gap-4 mb-4">
                  <label className="bg-primary text-white px-4 py-2 rounded-lg font-bold cursor-pointer hover:bg-secondary transition-colors shadow-lg">
                    Import Butchery (CSV/Excel)
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files && handleFileImport(e.target.files[0], 'butchery')} />
                  </label>
                  <label className="bg-accent text-white px-4 py-2 rounded-lg font-bold cursor-pointer hover:opacity-90 transition-all shadow-lg">
                    Import Market (CSV/Excel)
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => e.target.files && handleFileImport(e.target.files[0], 'market')} />
                  </label>
                  <button 
                    onClick={handleClearAllProducts}
                    className="bg-red-50 border-2 border-red-200 text-red-600 px-4 py-2 rounded-lg font-bold hover:bg-red-100 transition-all shadow-lg"
                  >
                    Clear All Products
                  </button>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-6 rounded-[24px] border border-white/10 mb-8 shadow-xl">
                  <p className="text-xs font-bold text-primary mb-3 uppercase tracking-[0.2em]">Import Format Guide</p>
                  <p className="text-[11px] text-text/70 leading-relaxed font-medium">
                    File must have headers: <span className="font-bold text-primary">name, category, price, unit</span>.
                    <br />
                    Butchery categories: <span className="text-primary/60 italic">Butchery, Poultry, Seafood, Processed, Specialty</span>.
                    <br />
                    Market category: <span className="text-primary/60 italic">African Market</span>.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {products.map((product) => (
                    <div key={product.id} className={`glassmorphism p-6 rounded-[24px] flex justify-between items-center border border-white/10 shadow-lg transition-all hover:scale-[1.01] ${product.isAvailable === false ? 'opacity-50 grayscale' : ''}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-lg">{product.name}</p>
                          {product.isAvailable === false && <span className="text-[10px] bg-red-500/10 text-red-600 px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-red-500/20">Unavailable</span>}
                        </div>
                        <p className="text-xs text-text/40 font-medium uppercase tracking-widest mt-1">{product.category} • {product.unit}</p>
                      </div>
                      <div className="flex items-center gap-8">
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-bold">Price (TZS)</span>
                          <input 
                            type="number" 
                            value={product.price}
                            onChange={(e) => updateProductPrice(product.id, Number(e.target.value))}
                            className="w-32 p-3 bg-white/5 border border-white/10 rounded-xl text-sm font-bold text-right focus:outline-none focus:border-primary"
                          />
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-bold">Visibility</span>
                          <button 
                            onClick={() => updateDoc(doc(db, 'products', product.id), { isAvailable: product.isAvailable === false })}
                            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${product.isAvailable === false ? 'bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20'}`}
                          >
                            {product.isAvailable === false ? 'Hidden' : 'Visible'}
                          </button>
                        </div>
                        <button 
                          onClick={() => deleteDoc(doc(db, 'products', product.id))}
                          className="w-10 h-10 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-full transition-all border border-transparent hover:border-red-500/20"
                          title="Permanently Delete"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="glassmorphism p-10 rounded-[32px] space-y-10 border border-white/10 shadow-2xl">
                <h3 className="text-2xl font-serif italic flex items-center gap-3 text-primary">
                  <Settings className="text-primary/40" size={28} />
                  Site Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold block">Loyalty Status</label>
                    <button 
                      onClick={() => updateSetting('isLoyaltyEnabled', settings.isLoyaltyEnabled === false)}
                      className={`w-full py-5 rounded-2xl font-bold transition-all border-2 ${settings.isLoyaltyEnabled !== false ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 shadow-lg shadow-blue-500/10' : 'bg-gray-500/10 text-gray-600 border-gray-500/20 shadow-lg shadow-gray-500/10'}`}
                    >
                      {settings.isLoyaltyEnabled !== false ? 'LOYALTY LIVE' : 'LOYALTY DISABLED'}
                    </button>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold block">Operational Status</label>
                    <button 
                      onClick={() => updateSetting('isOpen', !settings.isOpen)}
                      className={`w-full py-5 rounded-2xl font-bold transition-all border-2 ${settings.isOpen ? 'bg-green-500/10 text-green-600 border-green-500/20 shadow-lg shadow-green-500/10' : 'bg-red-500/10 text-red-600 border-red-500/20 shadow-lg shadow-red-500/10'}`}
                    >
                      {settings.isOpen ? 'STORE IS OPEN' : 'STORE IS CLOSED'}
                    </button>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold block">Minimum Order Threshold (TZS)</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={settings.minOrder || 0}
                        onChange={(e) => updateSetting('minOrder', Number(e.target.value))}
                        className="w-full p-5 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-primary transition-all font-bold text-lg"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-bold opacity-30 tracking-widest">TZS</span>
                    </div>
                  </div>
                </div>

                <div className="pt-10 border-t border-white/10 space-y-8">
                  <h4 className="text-lg font-serif italic text-primary flex items-center gap-2">
                    <Sparkles className="text-primary/40" size={20} />
                    AI Configuration (Lyra AI)
                  </h4>
                  <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                    <p className="text-sm text-primary font-medium">
                      Lyra AI is now powered by <strong>Gemini 3 Flash</strong>. 
                    </p>
                    <p className="text-[10px] text-primary/60 mt-2 uppercase tracking-widest font-bold">
                      No manual API key configuration is required.
                    </p>
                  </div>
                </div>

                <div className="pt-10 border-t border-white/10 space-y-8">
                  <h4 className="text-lg font-serif italic text-primary flex items-center gap-2">
                    <Package className="text-primary/40" size={20} />
                    Pop-up Advertisement Settings
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold block">Pop-up Title</label>
                      <input 
                        type="text" 
                        value={localPopupSettings.title}
                        onChange={(e) => setLocalPopupSettings({ ...localPopupSettings, title: e.target.value })}
                        placeholder="Special Offer!"
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary transition-all text-sm font-medium"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold block">Pop-up Message</label>
                      <textarea 
                        value={localPopupSettings.message}
                        onChange={(e) => setLocalPopupSettings({ ...localPopupSettings, message: e.target.value })}
                        placeholder="Check out our new products..."
                        rows={3}
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary transition-all text-sm font-medium resize-none"
                      />
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold block">Upload Image</label>
                      <div className="flex flex-col gap-4">
                        <label className={`w-full p-4 bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer hover:bg-white/10 transition-all flex flex-col items-center justify-center gap-2 ${isProcessingImage ? 'opacity-50 cursor-wait' : ''}`}>
                          {isProcessingImage ? (
                            <RefreshCw size={20} className="text-primary animate-spin" />
                          ) : (
                            <Upload size={20} className="text-primary/60" />
                          )}
                          <span className="text-xs font-bold text-text/40 uppercase tracking-widest text-center px-4">
                            {isProcessingImage ? 'Processing Image...' : 'Click to upload image'}
                            {!isProcessingImage && (
                              <>
                                <br/>
                                <span className="text-[10px] opacity-60 font-normal">(Max 1MB after compression)</span>
                              </>
                            )}
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isProcessingImage} />
                        </label>
                        {localPopupSettings.imageUrl && (
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-white/10">
                            <img src={localPopupSettings.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => setLocalPopupSettings({ ...localPopupSettings, imageUrl: '' })}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-[0.2em] opacity-50 font-bold block">Image URL (Optional)</label>
                      <input 
                        type="text" 
                        value={localPopupSettings.imageUrl}
                        onChange={(e) => setLocalPopupSettings({ ...localPopupSettings, imageUrl: e.target.value })}
                        placeholder="https://example.com/image.jpg"
                        className="w-full p-4 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:border-primary transition-all text-sm font-medium"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button 
                      onClick={handleApplyPopup}
                      disabled={isApplyingPopup}
                      className={`flex-1 py-4 bg-primary text-white rounded-2xl font-bold shadow-xl shadow-primary/20 hover:bg-secondary transition-all transform active:scale-95 flex items-center justify-center gap-2 ${isApplyingPopup ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {isApplyingPopup ? (
                        <RefreshCw size={20} className="animate-spin" />
                      ) : (
                        <Save size={20} />
                      )}
                      {isApplyingPopup ? 'APPLYING...' : 'APPLY POP-UP AD'}
                    </button>
                    <button 
                      onClick={() => updateSetting('isPopupEnabled', !settings.isPopupEnabled)}
                      className={`flex-1 py-4 rounded-2xl font-bold transition-all border-2 ${settings.isPopupEnabled ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20'}`}
                    >
                      {settings.isPopupEnabled ? 'DISABLE POP-UP' : 'ENABLE POP-UP'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
