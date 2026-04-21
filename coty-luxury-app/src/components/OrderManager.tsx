import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Package, Clock, CheckCircle, Truck, AlertCircle, ShoppingBag, RefreshCw, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { Order, UserProfile } from '../types';
import { t } from '../i18n';

interface OrderManagerProps {
  user: UserProfile | null;
}

export default function OrderManager({ user }: OrderManagerProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const lang = user?.language || 'sw';

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'orders'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
      setOrders(ordersData);
      setIsLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders'));

    return () => unsubscribe();
  }, [user]);

  const getStatusIcon = (status: Order['status']) => {
    switch (status) {
      case 'pending': return <Clock className="text-yellow-500" />;
      case 'processing': return <Package className="text-blue-500" />;
      case 'shipped': return <Truck className="text-purple-500" />;
      case 'delivered': return <CheckCircle className="text-green-500" />;
    }
  };

  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteOrder = async (orderId: string) => {
    setIsDeleting(true);
    try {
      const order = orders.find(o => o.id === orderId);
      if (order && order.pointsAwarded && user) {
        const userRef = doc(db, 'users', user.uid);
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

  if (!user) {
    return (
      <div className="glassmorphism rounded-[40px] p-12 text-center shadow-lg border border-white/10">
        <ShoppingBag size={48} className="mx-auto text-primary/40 mb-6" />
        <h3 className="text-2xl font-bold mb-4 text-primary">{t(lang, 'loginRequired')}</h3>
        <p className="text-text/60 max-w-sm mx-auto leading-relaxed">
          {lang === 'sw' 
            ? 'Ingia (Login) ili kuona historia ya oda zako na kufuatilia hali ya oda zako kwa urahisi.' 
            : 'Log in to view your order history and track your order status easily.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
          <div className="glassmorphism p-8 rounded-[32px] shadow-2xl space-y-6 max-w-sm w-full border border-white/10">
            <h2 className="text-2xl font-bold text-primary">{t(lang, 'confirmDelete')}</h2>
            <p className="text-sm text-text/60 leading-relaxed">
              {lang === 'sw' ? 'Una uhakika unataka kufuta oda hii?' : 'Are you sure you want to delete this order?'}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setOrderToDelete(null)} 
                disabled={isDeleting}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {t(lang, 'cancel')}
              </button>
              <button 
                onClick={() => orderToDelete && handleDeleteOrder(orderToDelete)} 
                disabled={isDeleting}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw className="animate-spin" size={18} /> : t(lang, 'delete')}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20 shadow-inner">
          <ShoppingBag size={24} />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-primary">{t(lang, 'myOrders')}</h2>
          <p className="text-[10px] text-text/40 uppercase tracking-[0.2em] font-bold">{t(lang, 'purchaseHistory')}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="animate-spin text-primary" size={32} />
        </div>
      ) : orders.length === 0 ? (
        <div className="glassmorphism rounded-[40px] p-20 text-center shadow-2xl border border-white/10">
          <Package size={64} className="mx-auto text-primary/20 mb-8" />
          <h3 className="text-3xl font-bold mb-4 text-primary/60">{t(lang, 'noOrdersYet')}</h3>
          <p className="text-text/50 max-w-md mx-auto leading-relaxed">
            {t(lang, 'noOrdersDesc')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {orders.map((order) => (
            <div key={order.id} className="glassmorphism rounded-[32px] p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-8 shadow-xl border border-white/10 transition-all hover:scale-[1.01] group">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-[24px] bg-primary/5 flex items-center justify-center text-primary border border-primary/10 shadow-inner group-hover:bg-primary/10 transition-all">
                  <Package size={32} />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-bold">{t(lang, 'orderNumber')}{order.id?.slice(-6)}</p>
                    <span className="w-1 h-1 rounded-full bg-primary/20" />
                    <p className="text-xs text-text/40 font-medium">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">{order.totalAmount.toLocaleString()} <span className="text-xs font-normal opacity-60">TZS</span></p>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-4 bg-white/20 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/20 shadow-sm group-hover:bg-white/30 transition-all">
                  <div className="p-2 rounded-full bg-white/50 shadow-inner">
                    {getStatusIcon(order.status)}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{t(lang, order.status)}</span>
                </div>
                
                <button 
                  onClick={() => order.id && setOrderToDelete(order.id)}
                  className="p-4 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-2xl transition-all border border-red-500/20 shadow-lg shadow-red-500/5"
                  title="Delete Order"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
