export interface Product {
  id: string;
  sku?: string;
  name: string;
  category: 'Butchery' | 'Poultry' | 'Seafood' | 'Processed' | 'African Market' | 'Specialty';
  subCategory?: string;
  price: number;
  unit: string;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  location?: string;
  walletBalance: number;
  loyaltyPoints: number;
  cardNumber?: string;
  loyaltyCredits: number;
  role: 'client' | 'admin';
  language?: 'en' | 'sw';
}

export interface Order {
  id?: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: {
    productId: string;
    name: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAt: string;
  deliveryAddress?: string;
  source?: 'lyra' | 'manual' | 'subscription';
  deliveryTime?: string;
  selectedDays?: string[];
  pointsAwarded?: boolean;
}

export interface Subscription {
  id?: string;
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  frequency: 'daily' | 'weekly' | 'monthly';
  status: 'active' | 'paused' | 'cancelled';
  nextOrderDate: string;
  lastOrderDate?: string;
  createdAt: string;
  deliveryTime?: string;
  timeFormat?: '12h' | '24h';
  amPm?: 'AM' | 'PM';
  selectedDays?: string[];
}

export interface Redemption {
  id?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  userLocation?: string;
  reward: 'FREE DELIVERY' | 'ONE FOR FREE' | 'DISCOUNT';
  points: number;
  status: 'pending' | 'completed';
  createdAt: string;
}

export interface Feedback {
  id?: string;
  userId?: string;
  userName?: string;
  userPhone?: string;
  location?: string;
  message: string;
  createdAt: string;
  time: string;
  date: string;
}
