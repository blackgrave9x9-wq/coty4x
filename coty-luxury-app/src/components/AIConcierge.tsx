import { useState, useRef, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, UserProfile } from '../types';
import { Send, X, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { t } from '../i18n';
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<any>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
  }, []);

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
      const systemPrompt = `You are "LYRA", the Coty Luxury AI Assistant.
      Customer: ${user ? `${user.displayName}, ${user.phoneNumber}` : 'Guest'}
      Products: ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, price: p.price })))}
      
      Rules:
      1. Communicate in ANY language the user prefers (Swahili, English, French, etc.).
      2. Use correct grammar and professional tone. For Swahili, ensure standard grammar (e.g., use "ya kubwa" instead of "ykubwa").
      3. Use product names EXACTLY as provided in the list. Do not translate or modify them.
      4. Respond FAST, SHORT, and accurately.
      5. List items clearly and show the TOTAL in TZS.
      6. Ask for confirmation in the user's language (e.g., "Je, unathibitisha oda hii? Jibu 'ndio' au 'hapana'").
      7. If the user confirms, use 'placeOrder'.
      8. If Guest, ask them to login.
      9. Use 'showRegistrationForm' if they need to register.`;

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

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-flash-latest",
        contents: [
          ...messages.slice(1).map(m => ({ 
            role: m.role === 'assistant' ? 'model' : 'user', 
            parts: [{ text: m.content }] 
          })),
          { role: "user", parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction: systemPrompt,
          tools,
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
        }
      });

      let fullText = '';
      setIsStreaming(true);

      for await (const chunk of responseStream) {
        const chunkText = chunk.text;
        
        if (chunkText) {
          if (isStreaming) setIsStreaming(false);
          if (fullText === '') {
            setMessages(prev => [...prev, { role: 'assistant', content: chunkText }]);
          } else {
            setMessages(prev => {
              const newMsgs = [...prev];
              newMsgs[newMsgs.length - 1].content += chunkText;
              return newMsgs;
            });
          }
          fullText += chunkText;
        }

        if (chunk.functionCalls) {
          for (const toolCall of chunk.functionCalls) {
            const name = toolCall.name;
            const args = toolCall.args as any;

            if (name === 'checkLoyaltyStatus') {
              const credits = user?.loyaltyCredits || 0;
              const points = user?.loyaltyPoints || 0;
              const text = lang === 'sw' 
                ? `\n\nUna krediti ${credits} na pointi ${points}. Baki krediti ${30 - (credits % 30)} kupata zawadi inayofuata!` 
                : `\n\nYou have ${credits} credits and ${points} points. You need ${30 - (credits % 30)} more credits for your next reward!`;
              
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content += text;
                return newMsgs;
              });
              setIsLoading(false);
              return;
            }

            if (name === 'showRegistrationForm') {
              onShowRegistration?.();
              const text = lang === 'sw' ? "\n\nNimekufungulia fomu ya usajili." : "\n\nI have opened the registration form for you.";
              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content += text;
                return newMsgs;
              });
              setIsLoading(false);
              return;
            }

            if (name === 'placeOrder') {
              if (!user || !user.phoneNumber) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  newMsgs[newMsgs.length - 1].content += `\n\n${t(lang, 'aiLoginRequired')}`;
                  return newMsgs;
                });
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

              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1].content += `\n\n${successMsg}`;
                newMsgs[newMsgs.length - 1].isOrder = true;
                return newMsgs;
              });
              setIsLoading(false);
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: t(lang, 'aiError') }]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
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
        <span className="hidden md:inline font-playfair italic">Huduma kwa Wateja</span>
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
                    <h3 className="text-white font-playfair font-bold text-xl">LYRA</h3>
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
                    <div className={`prose prose-sm ${msg.role === 'user' ? 'prose-invert' : 'prose-p:text-primary'}`}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && isStreaming && (
                <div className="flex justify-start">
                  <div className="bg-white p-4 rounded-3xl rounded-tl-none shadow-sm border border-primary/5 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-primary/30 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                    <span className="text-xs text-primary/50 italic">{t(lang, 'aiThinking')}</span>
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
