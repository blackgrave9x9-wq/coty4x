import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDoc, getDocs, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Subscription, Order, UserProfile } from '../types';

// East Africa Time (EAT) is UTC+3
export const getEATNow = () => {
  const now = new Date();
  // Get UTC time
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  // Add 3 hours for EAT
  return new Date(utc + (3600000 * 3));
};

const DAYS_MAP: { [key: string]: number } = {
  'Sunday': 0,
  'Monday': 1,
  'Tuesday': 2,
  'Wednesday': 3,
  'Thursday': 4,
  'Friday': 5,
  'Saturday': 6
};

export const calculateNextOrderDate = (startDate: Date, frequency: string, selectedDays?: string[]) => {
  const nextDate = new Date(startDate.getTime());
  
  if (frequency === 'daily') {
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate;
  }

  if (selectedDays && selectedDays.length > 0) {
    const targetDayIndices = selectedDays.map(day => DAYS_MAP[day]).sort((a, b) => a - b);
    const currentDayIndex = startDate.getDay();
    
    // Find the next day index that is greater than currentDayIndex
    let nextDayIndex = targetDayIndices.find(idx => idx > currentDayIndex);
    
    let daysToAdd = 0;
    if (nextDayIndex !== undefined) {
      daysToAdd = nextDayIndex - currentDayIndex;
    } else {
      // Wrap around to the first day in the list next week
      nextDayIndex = targetDayIndices[0];
      daysToAdd = (7 - currentDayIndex) + nextDayIndex;
    }
    
    // If it's monthly, we might want to skip weeks? 
    // But the user's request is a bit vague on "monthly" with day names.
    // We'll treat it as "every occurrence of these days" for now, 
    // or if it's monthly we could add 28 days (4 weeks) if it wraps?
    // Let's stick to the simplest interpretation: it follows the days.
    
    nextDate.setDate(nextDate.getDate() + daysToAdd);
    return nextDate;
  }

  // Default fallback if no days selected
  if (frequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (frequency === 'monthly') {
    nextDate.setDate(nextDate.getDate() + 30);
  }
  
  return nextDate;
};

export const startSubscriptionChecker = () => {
  console.log("Starting Subscription Checker (EAT)...");
  
  const checkSubscriptions = async () => {
    const now = getEATNow();
    console.log(`Checking subscriptions at ${now.toISOString()} (EAT)`);

    const q = query(
      collection(db, 'subscriptions'),
      where('status', '==', 'active')
    );

    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      const sub = { id: docSnap.id, ...docSnap.data() } as Subscription;
      const nextDate = new Date(sub.nextOrderDate);
      
      // If nextDate is in the past, trigger order
      if (nextDate <= now) {
        console.log(`Subscription ${sub.id} is due! Triggering order...`);
        await triggerSubscriptionOrder(sub);
      }
    }
  };

  // Run immediately and then every minute
  checkSubscriptions();
  const interval = setInterval(checkSubscriptions, 60000);

  return () => clearInterval(interval);
};

const triggerSubscriptionOrder = async (sub: Subscription) => {
  try {
    // 1. Get User Profile for details
    const userSnap = await getDoc(doc(db, 'users', sub.userId));
    if (!userSnap.exists()) return;
    const user = userSnap.data() as UserProfile;

    // 2. Create Order
    const newOrder: Omit<Order, 'id'> = {
      userId: sub.userId,
      customerName: user.displayName || 'Subscriber',
      customerPhone: user.phoneNumber || '',
      customerEmail: user.email,
      items: [{
        productId: sub.productId,
        name: sub.productName,
        quantity: sub.quantity,
        price: sub.price
      }],
      totalAmount: sub.price * sub.quantity,
      status: 'pending',
      createdAt: getEATNow().toISOString(),
      source: 'subscription',
      deliveryAddress: user.location || '',
      ...(sub.deliveryTime ? { deliveryTime: `${sub.deliveryTime} ${sub.timeFormat === '12h' ? sub.amPm : ''}` } : {}),
      selectedDays: sub.selectedDays || [],
      pointsAwarded: true
    };

    await addDoc(collection(db, 'orders'), newOrder);

    // 3. Update loyalty credits and points (3 credits per product as per Rule 1)
    const userRef = doc(db, 'users', sub.userId);
    await updateDoc(userRef, {
      loyaltyCredits: increment(3 * newOrder.items.length),
      loyaltyPoints: increment(Math.floor(newOrder.totalAmount / 1000))
    });

    // 4. Calculate next order date based on frequency and selected days
    const currentNextDate = new Date(sub.nextOrderDate);
    const nextDate = calculateNextOrderDate(currentNextDate, sub.frequency, sub.selectedDays);

    // 4. Update Subscription
    await updateDoc(doc(db, 'subscriptions', sub.id!), {
      nextOrderDate: nextDate.toISOString(),
      lastOrderDate: getEATNow().toISOString()
    });

    console.log(`Order sent for subscription ${sub.id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'orders from subscription');
  }
};
