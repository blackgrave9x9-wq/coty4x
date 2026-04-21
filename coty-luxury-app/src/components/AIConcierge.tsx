import { useState, useRef, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, UserProfile } from '../types';
import { Send, X, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { t } from '../i18n';

// ---------- DeepSeek Client (badala ya Gemini) ----------
// KUMBUKA: Hii API key itaonekana kwenye frontend ikiwa haipo kwenye backend proxy.
// Kwa usalama, tumia Cloudflare Worker au Next.js API route kuproxya ombi.
// Mfano wa proxy umetolewa mwishoni mwa faili.
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/v1/chat/completions';

interface DeepSeekTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// Badilisha tools za Gemini kuwa muundo wa DeepSeek (OpenAI)
const tools: DeepSeekTool[] = [
  {
    type: 'function',
    function: {
      name: 'placeOrder',
      description: 'Place order after user confirms "ndio".',
      parameters: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                name: { type: 'string' },
                quantity: { type: 'number' },
                price: { type: 'number' }
              },
              required: ['productId', 'name', 'quantity', 'price']
            }
          },
          totalAmount: { type: 'number' }
        },
        required: ['items', 'totalAmount']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'showRegistrationForm',
      description: 'Show registration form.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'checkLoyaltyStatus',
      description: 'Check user points/credits.',
      parameters: { type: 'object', properties: {} }
    }
  }
];

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

  // Function to call DeepSeek with streaming + tool calls
  const callDeepSeek = async (userMessage: string, history: Message[]) => {
    const systemPrompt = `Wewe ni "LYRA", Concierge wa Coty Luxury. 
      Respond VERY FAST and SHORT. Use Swahili ALWAYS.
      User: ${user ? `${user.displayName}` : 'Guest'}
      Catalog: ${JSON.stringify(products.map(p => ({ n: p.name, p: p.price })))}
      
      Rules:
      1. Short sentences only.
      2. If user wants items, LIST them + TOTAL in TZS.
      3. Ask confirmation: "Je, unathibitisha oda hii? Jibu 'ndio' au 'hapana'."
      4. Use 'placeOrder' ONLY after 'ndio'.
      5. Use 'showRegistrationForm' for login/register needs.`;

    // Convert message history to DeepSeek format (roles: user/assistant)
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(1).map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ];

    const response = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',   // Inaweza kubadilishwa kuwa 'deepseek-reasoner' kwa logic ngumu
        messages: apiMessages,
        tools: tools,
        tool_choice: 'auto',
        stream: true,
        temperature: 0.1,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let accumulatedToolCalls: any[] = [];
    let isFirstChunk = true;

    // Soma stream ya SSE (data: {...}\n\n)
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            
            if (delta?.content) {
              fullText += delta.content;
              // Update UI incrementally
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && !last.isOrder) {
                  const updated = [...prev];
                  updated[updated.length - 1] = { ...last, content: fullText };
                  return updated;
                } else {
                  // Kama hakuna placeholder, ongeza moja
                  return [...prev, { role: 'assistant', content: fullText }];
                }
              });
              if (isFirstChunk) {
                setIsLoading(false);
                isFirstChunk = false;
              }
            }

            // Collect tool calls from delta (DeepSeek inatuma tool_calls kama array)
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                // Inawezekana tool_calls inakuja kwa sehemu (index, id, function.name, function.arguments)
                // Tuna accumulate kwa kutumia index
                const index = tc.index || 0;
                if (!accumulatedToolCalls[index]) {
                  accumulatedToolCalls[index] = {
                    id: tc.id,
                    type: tc.type,
                    function: { name: '', arguments: '' }
                  };
                }
                if (tc.function?.name) accumulatedToolCalls[index].function.name = tc.function.name;
                if (tc.function?.arguments) accumulatedToolCalls[index].function.arguments += tc.function.arguments;
              }
            }
          } catch (e) {
            console.warn('Failed to parse SSE chunk:', line, e);
          }
        }
      }
    }

    // Baada ya stream kumaliza, angalia kama kuna tool calls
    if (accumulatedToolCalls.length > 0) {
      // Onyesha placeholder ya kazi ikiwa hakuna maandishi
      if (!fullText) {
        setMessages(prev => prev.filter(m => !(m.role === 'assistant' && m.content === '')));
      }
      for (const tc of accumulatedToolCalls) {
        const toolName = tc.function.name;
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || '{}');
        } catch (e) {
          console.error('Failed to parse tool arguments', tc.function.arguments);
        }

        // Tekeleza kazi zinazolingana (sawa na kabla)
        if (toolName === 'checkLoyaltyStatus') {
          const credits = user?.loyaltyCredits || 0;
          const points = user?.loyaltyPoints || 0;
          const text = lang === 'sw' 
            ? `Una krediti ${credits} na pointi ${points}. Baki krediti ${30 - (credits % 30)} kupata zawadi inayofuata!` 
            : `You have ${credits} credits and ${points} points. You need ${30 - (credits % 30)} more credits for your next reward!`;
          setMessages(prev => [...prev, { role: 'assistant', content: text }]);
          return;
        }

        if (toolName === 'showRegistrationForm') {
          onShowRegistration?.();
          setMessages(prev => [...prev, { role: 'assistant', content: lang === 'sw' ? "Nimekufungulia fomu ya usajili." : "I have opened the registration form for you." }]);
          return;
        }

        if (toolName === 'placeOrder') {
          if (!user || !user.phoneNumber) {
            setMessages(prev => [...prev, { role: 'assistant', content: t(lang, 'aiLoginRequired') }]);
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
          return;
        }
      }
    }

    // Hakuna tool call, tumia maandishi yaliyokusanywa
    if (!fullText && accumulatedToolCalls.length === 0) {
      throw new Error('No response from AI');
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Ongeza placeholder ya assistant kwa streaming
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      await callDeepSeek(userMessage, messages);
    } catch (error: any) {
      console.error("DeepSeek Error:", error);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && last.content === '') {
          // Badilisha placeholder kuwa ujumbe wa kosa
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, content: t(lang, 'aiError') };
          return updated;
        } else {
          return [...prev, { role: 'assistant', content: t(lang, 'aiError') }];
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ... sehemu ya JSX haibadilishwi, ni sawa kabisa na awali ...
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
        <span className="font-black">Weka oder yako hapa</span>
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
