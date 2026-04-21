import { useState, useRef, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, UserProfile } from '../types';
import { Send, X, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { t } from '../i18n';
import { GoogleGenAI, Type } from "@google/genai";

let genAI: GoogleGenAI | null = null;
function getAI() {
  if (!genAI) {
    genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }
  return genAI;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isOrder?: boolean;
}

export default function AIConcierge({ user, lang, onAddToCart, onShowRegistration }: { user: UserProfile | null, lang: 'en' | 'sw', onAddToCart: (productId: string) => void, onShowRegistration?: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: t(lang, 'aiWelcome') }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<any>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(productsData.filter(p => p.isAvailable !== false));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'site'), (snapshot) => {
      if (snapshot.exists()) setSettings(snapshot.data());
    }, (err) => handleFirestoreError(err, OperationType.GET, 'settings/site'));

    return () => {
      unsubscribe();
      unsubSettings();
    };
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const systemPrompt = `You are "LYRA", the Coty AI Assistant. 
            
      User Info: ${user ? `Name: ${user.displayName}, Phone: ${user.phoneNumber}, Email: ${user.email}` : 'Not logged in'}
      Product Catalog: ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, price: p.price, category: p.category })))}
      
      Instructions:
      1. Respond FAST, VERY SHORT, and DIRECT.
      2. Use very short sentences. Avoid long explanations make responses fast as you can.
      3. When a user mentions products they want, LIST them clearly with their prices and show the TOTAL COST in TZS.
      4. After listing the items and total, you MUST ask for confirmation in Swahili: "Je, unathibitisha oda hii? Jibu 'ndio' au 'hapana'."
      5. If the user says "ndio", use the 'placeOrder' tool.
      6. If the user says "hapana", ask: "Unataka kurekebisha nini?"
      7. Once they provide changes, update the list and ask for confirmation again.
      8. If the user is not logged in or hasn't provided details, ask them to login/register first.
      9. ALWAYS use Swahili for the conversation.
      10. Avoid any conversational filler. Be like a professional concierge.
      11. If the user wants to see the registration form, use the 'showRegistrationForm' tool.`;

      const tools = [
        {
          functionDeclarations: [
            {
              name: "placeOrder",
              description: "Place an order for the user with specified items. ONLY call this after the user says 'ndio' to confirm the list and total.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  items: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        productId: { type: Type.STRING },
                        name: { type: Type.STRING },
                        quantity: { type: Type.NUMBER },
                        price: { type: Type.NUMBER }
                      },
                      required: ["productId", "name", "quantity", "price"]
                    }
                  },
                  totalAmount: { type: Type.NUMBER }
                },
                required: ["items", "totalAmount"]
              }
            },
            {
              name: "showRegistrationForm",
              description: "Show the registration or profile completion form to the user.",
              parameters: { type: Type.OBJECT, properties: {} }
            },
            {
              name: "checkLoyaltyStatus",
              description: "Check the user's current loyalty points and credits.",
              parameters: { type: Type.OBJECT, properties: {} }
            }
          ]
        }
      ];

      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-latest",
        contents: [
          ...messages.slice(1).map(m => ({ 
            role: m.role === 'assistant' ? 'model' : 'user', 
            parts: [{ text: m.content }] 
          })),
          { role: "user", parts: [{ text: userMessage }] }
        ],
        config: {
          tools,
          systemInstruction: systemPrompt,
        }
      });

      const message = response.candidates?.[0]?.content;
      if (!message) throw new Error("No response from AI");

      if (response.functionCalls) {
        const functionCalls = response.functionCalls;
        for (const toolCall of functionCalls) {
          const name = toolCall.name;
          const args = toolCall.args as any;

          if (name === 'checkLoyaltyStatus') {
            const credits = user?.loyaltyCredits || 0;
            const points = user?.loyaltyPoints || 0;
            const text = lang === 'sw' 
              ? `Una krediti ${credits} na pointi ${points}. Baki krediti ${30 - (credits % 30)} kupata zawadi inayofuata!` 
              : `You have ${credits} credits and ${points} points. You need ${30 - (credits % 30)} more credits for your next reward!`;
            setMessages(prev => [...prev, { role: 'assistant', content: text }]);
            setIsLoading(false);
            return;
          }

          if (name === 'showRegistrationForm') {
            onShowRegistration?.();
            setMessages(prev => [...prev, { role: 'assistant', content: lang === 'sw' ? "Nimekufungulia fomu ya usajili." : "I have opened the registration form for you." }]);
            setIsLoading(false);
            return;
          }

          if (name === 'placeOrder') {
            if (!user || !user.phoneNumber) {
              setMessages(prev => [...prev, { role: 'assistant', content: t(lang, 'aiLoginRequired') }]);
              setIsLoading(false);
              return;
            }

            const newOrder: any = {
              userId: user.uid,
              items: args.items,
              totalAmount: args.totalAmount,
              status: 'pending',
              createdAt: new Date().toISOString(),
              customerName: user.displayName || '',
              customerPhone: user.phoneNumber || '',
              customerEmail: user.email || '',
              source: 'lyra',
              pointsAwarded: true
            };

            await addDoc(collection(db, 'orders'), newOrder);
            
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              loyaltyCredits: increment(3 * args.items.length),
              loyaltyPoints: increment(Math.floor(args.totalAmount / 1000))
            });
            
            let successMsg = t(lang, 'aiOrderSuccess');
            successMsg = successMsg.replace('{name}', user.displayName || '');
            successMsg = successMsg.replace('{amount}', args.totalAmount.toLocaleString());
            successMsg = successMsg.replace('{phone}', user.phoneNumber || '');

            setMessages(prev => [...prev, { 
              role: 'assistant', 
              content: successMsg,
              isOrder: true
            }]);
            setIsLoading(false);
            return;
          }
        }
      }

      const text = response.text || t(lang, 'aiFallbackError');
      setMessages(prev => [...prev, { role: 'assistant', content: text }]);
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMsg = error.message || t(lang, 'aiError');
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ **Error:** ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          if (!user || !user.displayName || !user.phoneNumber || !user.location) {
            onShowRegistration?.();
          } else {
            setIsOpen(true);
          }
        }}
        className="fixed bottom-6 right-6 bg-primary text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-all z-50 flex items-center gap-2 font-medium button-3d group"
      >
        <div className="animate-dancing">
          <ChefHat size={24} />
        </div>
        <span className="font-black">Weka oder hapa</span>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full border-2 border-white animate-pulse" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.9, x: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, y: 100, scale: 0.9, x: 20 }}
            className="fixed bottom-20 right-4 sm:right-6 w-[calc(100vw-32px)] sm:w-[420px] h-[550px] max-h-[calc(100vh-100px)] glassmorphism border-2 border-primary/20 rounded-[32px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] z-50 flex flex-col overflow-hidden card-3d"
          >
            <div className="p-6 border-b border-primary/10 flex justify-between items-center bg-primary relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.2),transparent)]" />
              </div>
              
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <ChefHat className="text-white" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-black text-xl">LYRA</h3>
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-bold">{t(lang, 'luxuryAIAssistant')}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/20 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide bg-white/5 backdrop-blur-md">
              {messages.map((msg, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white text-primary border border-primary/5 rounded-tl-none'
                  }`}>
                    <div className={`prose prose-sm md:prose-base leading-relaxed ${msg.role === 'user' ? 'prose-invert font-bold' : 'prose-p:text-primary font-bold'}`}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-3xl rounded-tl-none shadow-sm border border-primary/5 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    <span className="text-xs text-primary/50 italic">{t(lang, 'Thinking')}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 bg-white/5 backdrop-blur-md border-t border-primary/10">
              <div className="relative group">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={t(lang, 'aiPlaceholder')}
                  className="w-full bg-bg/50 border-2 border-primary/10 text-primary rounded-2xl py-4 px-6 pr-14 focus:outline-none focus:border-primary/40 transition-all placeholder:text-primary/30"
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[9px] text-center mt-4 text-primary/30 uppercase tracking-widest font-bold">
                {t(lang, 'aiPoweredBy')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
