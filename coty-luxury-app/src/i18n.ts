export type Language = 'en' | 'sw';

export const translations = {
  en: {
    // Registration
    welcome: "Welcome to Coty Luxury",
    completeRegistration: "Complete Your Registration",
    fullName: "Full Name",
    phoneNumber: "Phone Number",
    location: "Location (Street/Area)",
    language: "Preferred Language",
    completeBtn: "COMPLETE REGISTRATION",
    
    // Admin
    adminAccess: "Admin Access",
    enterPassword: "Enter security password to continue",
    cancel: "Cancel",
    submit: "Submit",
    delete: "Delete",
    confirmDelete: "Confirm Delete",
    
    // Navigation
    home: "Home",
    support: "Support",
    subAndSupport: "Subscription & Support",
    myOrders: "My Orders",
    login: "Login",
    register: "Register",
    
    // Hero
    heroTitle: "Coty Luxury",
    heroSubtitle: "Experience the pinnacle of butchery and market excellence. Login to access our premium catalog and personalized concierge services.",
    getStarted: "GET STARTED",
    
    // Footer
    footerDesc: "EAT FRESH BE HEALTHY",
    locationTitle: "Location",
    inquiries: "Inquiries",
    rights: "© 2026 COTY LUXURY. ALL RIGHTS RESERVED.",
    privacy: "Privacy",
    terms: "Terms",
    loginToEarn: "Login to save your information, track orders, and enjoy our luxury loyalty rewards.",
    loginBtn: "Login / Register",
    // Subscription
    loginRequired: "Login Required",
    loginToManage: "Please log in to manage your subscriptions.",
    subscriptionTitle: "Subscription",
    autoDelivery: "Automatic Luxury Delivery",
    newSubscription: "New Subscription",
    noActiveSubs: "No Active Subscriptions",
    subDesc: "Experience the ultimate convenience. Set up recurring orders for your favorite cuts and market essentials.",
    createFirstSub: "Create your first subscription",
    units: "unit(s)",
    frequency: "Frequency",
    nextDelivery: "Next Delivery",
    customizeOrder: "Customize your recurring luxury order.",
    noProducts: "No products found. Please add products in the Admin Dashboard.",
    butchery: "Butchery",
    africanMarket: "African Market",
    otherProducts: "Other Products",
    deliveryTime: "Delivery Time",
    totalPerDelivery: "Total per delivery",
    confirmSub: "Confirm Subscription",
    search: "Search...",
    noButcheryFound: "No butchery products found.",
    noMarketFound: "No market products found.",
    noOtherFound: "No other products found.",
    // OrderManager
    purchaseHistory: "Purchase History",
    noOrdersYet: "No Orders Yet",
    noOrdersDesc: "Your luxury meat orders will appear here once you make your first purchase.",
    orderNumber: "Order #",
    
    // LoyaltyCard
    loyaltyCardTitle: "Loyalty Card",
    memberSince: "Member Since",
    walletBalance: "Wallet Balance",
    loyaltyPoints: "Loyalty Points",
    loyaltyCredits: "Loyalty Credits",
    topUp: "Top Up",
    viewRules: "View Rules",
    loyaltyMembership: "Loyalty Membership",
    accumulatedCredits: "Accumulated Credits",
    claimLuxuryReward: "Claim Luxury Reward",
    rewardUnlocksAt: "Reward unlocks at 30 credits",
    
    // AIConcierge
    aiWelcome: "Welcome to Coty Luxury. I am LYRA, your personal chef and concierge. What products do you prefer today?",
    aiThinking: "LYRA is thinking...",
    aiPlaceholder: "Ask LYRA for a recipe or advice...",
    aiPoweredBy: "Powered by LYRA Intelligence",
    aiError: "I'm sorry, I encountered an error. Please try again.",
    aiLoginRequired: "I apologize, you must login first so I can place your order. Please complete your registration.",
    aiOrderSuccess: "✅ **Order Received!**\n\nThank you {name}, your order of TZS {amount} has been sent to the Admin. We will contact you shortly via {phone}.",
    aiFallbackError: "I apologize, I'm having trouble connecting to my culinary database. How else can I help?",
    luxuryAIAssistant: "Luxury AI Assistant",
    shopNow: "Shop Now",
    
    // LoyaltyRulesModal
    instructions: "Instructions",
    rule1: "\"Every time you buy a product, you earn 3 credits\"",
    rule2: "\"When you reach 30 credits, you can choose one free product, free delivery, or a discount\"",
    rule3: "\"Continue buying to reach the goal\".",
    cardNumberIs: "Your card number:",
    close: "Close",

    // Statuses
    pending: "pending",
    processing: "processing",
    shipped: "shipped",
    delivered: "delivered",
    orderSent: "Order Sent",
    timeFormat: "Time Format",
    h12: "12h",
    h24: "24h",
    am: "AM",
    pm: "PM",
    selectTime: "Select Time",
    comingSoon: "Coming Soon",
    feedback: "Feedback",
    sendFeedback: "Send Feedback",
    feedbackTitle: "Your Feedback",
    feedbackPlaceholder: "Tell us how we can improve our service...",
    feedbackSuccess: "Thank you for your feedback! It has been sent to the Admin.",
    feedbackError: "Error sending feedback. Please try again.",
  },
  sw: {
    // Registration
    welcome: "Karibu Coty Luxury",
    completeRegistration: "Kamilisha Usajili Wako",
    fullName: "Jina Kamili",
    phoneNumber: "Namba ya Simu",
    location: "Eneo (Mtaa/Wilaya)",
    language: "Lugha Unayopendelea",
    completeBtn: "KAMILISHA USAJILI",
    
    // Admin
    adminAccess: "Ufikiaji wa Admin",
    enterPassword: "Ingiza nenosiri la usalama ili kuendelea",
    cancel: "Ghairi",
    submit: "Wasilisha",
    delete: "Futa",
    confirmDelete: "Thibitisha Kufuta",
    
    // Navigation
    home: "weka oder yako hapa",
    support: "Huduma",
    subAndSupport: "Usajili & Msaada",
    myOrders: "Oda zangu",
    login: "Ingia",
    register: "Jisajili",
    
    // Hero
    heroTitle: "Coty Luxury",
    heroSubtitle: "Pata uzoefu wa kilele cha ubora wa bucha na soko. Ingia ili kufikia bidhaa zetu bora na huduma za kibinafsi.",
    getStarted: "ANZA SASA",
    
    // Footer
    footerDesc: "EAT FRESH BE HEALTHY",
    locationTitle: "Mahali",
    inquiries: "Mawasiliano",
    rights: "© 2026 COTY LUXURY. HAKI ZOTE ZIMEHIFADHIWA.",
    privacy: "Faragha",
    terms: "Vigezo",
    loginToEarn: "Jisajili ili kuhifadhi taarifa zako, kufuatilia oda, na kufurahia zawadi zetu za uaminifu za kifahari.",
    loginBtn: "Ingia / Jisajili",

    // Subscription
    loginRequired: "Ingia Kwanza",
    loginToManage: "Tafadhali ingia ili kudhibiti usajili wako.",
    subscriptionTitle: "Usajili (Subscription)",
    autoDelivery: "Uletaji wa Kiotomatiki",
    newSubscription: "Usajili Mpya",
    noActiveSubs: "Hakuna Usajili Unaofanya Kazi",
    subDesc: "Pata urahisi zaidi. Weka oda za kujirudia kwa bidhaa unazozipenda.",
    createFirstSub: "Tengeneza usajili wako wa kwanza",
    units: "idadi",
    frequency: "Mzunguko",
    nextDelivery: "Uletaji Ujao",
    customizeOrder: "Boresha oda yako ya kujirudia.",
    noProducts: "Hakuna bidhaa zilizopatikana.",
    butchery: "Bucha",
    africanMarket: "Soko la Kiafrika",
    otherProducts: "Bidhaa Nyingine",
    deliveryTime: "Muda wa Kuleta",
    totalPerDelivery: "Jumla kwa kila uletaji",
    confirmSub: "Thibitisha Usajili",
    search: "Tafuta...",
    noButcheryFound: "Hakuna bidhaa za bucha zilizopatikana.",
    noMarketFound: "Hakuna bidhaa za soko zilizopatikana.",
    noOtherFound: "Hakuna bidhaa nyingine zilizopatikana.",

    // OrderManager
    purchaseHistory: "Historia ya Manunuzi",
    noOrdersYet: "Hakuna Oda Bado",
    noOrdersDesc: "Oda zako za nyama bora zitaonekana hapa ukishafanya manunuzi yako ya kwanza.",
    orderNumber: "Oda #",
    
    // LoyaltyCard
    loyaltyCardTitle: "Kadi ya Uaminifu",
    memberSince: "Mwanachama Tangu",
    walletBalance: "Salio la Pochi",
    loyaltyPoints: "Pointi za Uaminifu",
    loyaltyCredits: "Krediti za Uaminifu",
    topUp: "Ongeza Salio",
    viewRules: "Soma Vigezo",
    loyaltyMembership: "Uanachama wa Uaminifu",
    accumulatedCredits: "Krediti Zilizokusanywa",
    claimLuxuryReward: "Dai Zawadi Yako",
    rewardUnlocksAt: "Zawadi hufunguliwa kwa krediti 30",
    
    // AIConcierge
    aiWelcome: "Karibu Coty Luxury. Mimi ni LYRA, mpishi wako binafsi na msaidizi. Unapendelea bidhaa gani leo?",
    aiThinking: "LYRA anafikiria...",
    aiPlaceholder: "Muulize LYRA kwa mapishi au ushauri...",
    aiPoweredBy: "Inaendeshwa na LYRA Intelligence",
    aiError: "Samahani, nimepata hitilafu. Tafadhali jaribu tena.",
    aiLoginRequired: "Samahani, unapaswa kujisajili kwanza ili niweze kutuma oda yako. Tafadhali kamilisha usajili wako.",
    aiOrderSuccess: "✅ **Oda Yako Imepokelewa!**\n\nAsante {name}, oda yako ya TZS {amount} imetumwa kwa Admin. Tutakuwasiliana hivi punde kupitia {phone}.",
    aiFallbackError: "Samahani, ninapata shida kuunganishwa na hifadhidata yangu ya mapishi. Nikusaidie vipi vinginevyo?",
    luxuryAIAssistant: "Msaidizi wa AI wa Kifahari",
    shopNow: "Nunua Sasa",
    
    // LoyaltyRulesModal
    instructions: "Maelekezo",
    rule1: "\"Kila unaponunua bidhaa inaongezeka credit 3\"",
    rule2: "\"Ukifikisha credits 30 unachagua pata Bidhaa moja bure, Free delivery, Au punguzo la bei\"",
    rule3: "\"Endelea kununua kufikia lengo\".",
    cardNumberIs: "Namba ya card yako:",
    close: "Funga",

    // Statuses
    pending: "inasubiri",
    processing: "inashughulikiwa",
    shipped: "imesafirishwa",
    delivered: "imefikishwa",
    orderSent: "Oda Imetumwa",
    timeFormat: "Mfumo wa Saa",
    h12: "Saa 12",
    h24: "Saa 24",
    am: "AM",
    pm: "PM",
    selectTime: "Chagua Saa",
    comingSoon: "Inakuja Hivi Punde",
    feedback: "Maoni",
    sendFeedback: "Tuma Maoni",
    feedbackTitle: "Maoni Yako",
    feedbackPlaceholder: "Tuambie jinsi tunavyoweza kuboresha huduma zetu...",
    feedbackSuccess: "Asante kwa maoni yako! Yametumwa kwa Admin.",
    feedbackError: "Hitilafu imetokea wakati wa kutuma maoni. Tafadhali jaribu tena.",
  }
};

export function t(lang: Language, key: keyof typeof translations['en']): string {
  return translations[lang][key] || translations['en'][key] || key;
}
