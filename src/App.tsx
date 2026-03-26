import { useState, useRef, useEffect, useCallback } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Hand, 
  MessageSquare, 
  Settings, 
  User, 
  Video, 
  X, 
  ChevronDown, 
  Globe, 
  Send, 
  Mic, 
  Camera,
  LayoutDashboard,
  History,
  HelpCircle,
  LogOut,
  Menu,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SIGN_LANGUAGES = [
  { id: "asl", name: "American Sign Language (ASL)" },
  { id: "bsl", name: "British Sign Language (BSL)" },
  { id: "isl", name: "Indian Sign Language (ISL)" },
  { id: "psl", name: "Pakistan Sign Language (PSL)" },
  { id: "fsl", name: "French Sign Language (LSF)" },
  { id: "auslan", name: "Australian Sign Language (Auslan)" },
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState(SIGN_LANGUAGES[0]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Please allow camera access to use the Sign Language AI.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      setIsCapturing(false);
    }
  };

  const captureAndTranslate = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing) return;

    setIsProcessing(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);

    const base64Image = canvas.toDataURL("image/jpeg").split(",")[1];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: `You are an expert sign language interpreter. Translate the sign language gesture in this image into text. The language is ${selectedLanguage.name}. If you see multiple gestures, provide a coherent sentence. If no gesture is clear, say "No gesture detected".` },
              { inlineData: { data: base64Image, mimeType: "image/jpeg" } }
            ]
          }
        ]
      });

      const translation = response.text || "Could not translate.";
      if (translation !== "No gesture detected") {
        const newMessage: Message = {
          id: Date.now().toString(),
          role: "user",
          content: `[Sign: ${translation}]`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, newMessage]);
        
        // Get AI response to the sign
        await getAIResponse(translation);
      }
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getAIResponse = async (userInput: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: "user", parts: [{ text: userInput }] }
        ],
        config: {
          systemInstruction: "You are a helpful assistant for Deaf and hard-of-hearing individuals. Respond concisely and clearly. Use simple language where appropriate."
        }
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response.text || "I'm sorry, I couldn't process that.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error("AI Response error:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    await getAIResponse(inputText);
  };

  return (
    <div className="flex h-screen bg-[#F5F5F0] font-sans text-[#1A1A1A] overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 z-[60] backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white border-r border-[#E5E5E0] transition-all duration-300 flex flex-col z-[70]",
          isMobile 
            ? cn("fixed inset-y-0 left-0 w-64 transform", isSidebarOpen ? "translate-x-0" : "-translate-x-full")
            : cn(isSidebarOpen ? "w-64" : "w-20")
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-xl flex items-center justify-center text-white shrink-0">
            <Hand className="w-6 h-6" />
          </div>
          {isSidebarOpen && <span className="font-serif text-xl font-bold">SignBridge</span>}
        </div>

        <nav className="flex-grow px-4 space-y-2">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active isOpen={isSidebarOpen} />
          <NavItem icon={<MessageSquare />} label="Chats" isOpen={isSidebarOpen} />
          <NavItem icon={<History />} label="History" isOpen={isSidebarOpen} />
          <NavItem icon={<Settings />} label="Settings" isOpen={isSidebarOpen} />
        </nav>

        <div className="p-4 border-t border-[#E5E5E0] space-y-2">
          <NavItem icon={<HelpCircle />} label="Support" isOpen={isSidebarOpen} />
          <NavItem icon={<LogOut />} label="Logout" isOpen={isSidebarOpen} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 bg-white border-b border-[#E5E5E0] flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-base md:text-lg font-medium truncate max-w-[150px] md:max-w-none">Welcome, User</h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#F5F5F0] rounded-full text-sm font-medium">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              AI Online
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-[#E5E5E0] rounded-full flex items-center justify-center">
              <User className="w-4 h-4 md:w-5 md:h-5" />
            </div>
          </div>
        </header>

        {/* Dashboard View */}
        <div className="flex-grow p-4 md:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-6 md:space-y-8">
            <section>
              <h1 className="font-serif text-3xl md:text-4xl font-bold mb-2">Accessibility Dashboard</h1>
              <p className="text-[#5A5A40] opacity-70 text-sm md:text-base">Empowering communication through AI sign language interpretation.</p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Sign Language AI Card */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setIsChatOpen(true);
                  startCamera();
                }}
                className="bg-[#5A5A40] text-white p-6 md:p-8 rounded-[24px] md:rounded-[32px] text-left relative overflow-hidden group shadow-xl"
              >
                <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:scale-110 transition-transform">
                  <Hand className="w-16 h-16 md:w-24 md:h-24" />
                </div>
                <div className="relative z-10 space-y-3 md:space-y-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-white/20 rounded-xl md:rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-serif font-bold">Sign Language AI</h3>
                    <p className="text-white/70 text-xs md:text-sm mt-1">Open real-time sign language emulator and chat box.</p>
                  </div>
                  <div className="pt-2 md:pt-4">
                    <span className="px-4 py-2 bg-white text-[#5A5A40] rounded-full text-xs md:text-sm font-bold">Launch Now</span>
                  </div>
                </div>
              </motion.button>

              {/* Other Cards */}
              <DashboardCard 
                icon={<Video className="w-6 h-6" />} 
                title="Video Calls" 
                desc="Connect with interpreters via video." 
                color="bg-white"
              />
              <DashboardCard 
                icon={<Globe className="w-6 h-6" />} 
                title="Global Signs" 
                desc="Explore 50+ sign language dialects." 
                color="bg-white"
              />
            </div>

            <section className="bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-8 border border-[#E5E5E0]">
              <h3 className="text-lg md:text-xl font-serif font-bold mb-4 md:mb-6">Recent Activity</h3>
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-3 md:py-4 border-b border-[#F5F5F0] last:border-0">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-8 h-8 md:w-10 md:h-10 bg-[#F5F5F0] rounded-full flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-[#5A5A40]" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm md:text-base truncate">Chat with AI Assistant</p>
                        <p className="text-[10px] md:text-xs text-[#5A5A40] opacity-60">Yesterday at 4:30 PM</p>
                      </div>
                    </div>
                    <button className="text-xs md:text-sm font-bold text-[#5A5A40] shrink-0">View</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        {/* Sign Language Chat Overlay */}
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-0 z-50 bg-[#F5F5F0] flex flex-col"
            >
              {/* Chat Header */}
              <div className="h-20 bg-white border-b border-[#E5E5E0] flex items-center justify-between px-4 md:px-8 shrink-0">
                <div className="flex items-center gap-2 md:gap-4 min-w-0">
                  <button 
                    onClick={() => {
                      setIsChatOpen(false);
                      stopCamera();
                    }}
                    className="p-2 hover:bg-[#F5F5F0] rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="font-serif font-bold text-base md:text-xl truncate">AI Emulator</h2>
                    <p className="text-[10px] md:text-xs text-[#5A5A40] opacity-70">Gemini 3 Flash</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Language Selector */}
                  <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-[#F5F5F0] rounded-full text-xs md:text-sm font-medium hover:bg-[#E5E5E0] transition-colors">
                      <Globe className="w-3 h-3 md:w-4 md:h-4" />
                      <span className="truncate max-w-[60px] md:max-w-none">{selectedLanguage.name.split(' ')[0]}</span>
                      <ChevronDown className="w-3 h-3 md:w-4 md:h-4" />
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 md:w-64 bg-white rounded-2xl shadow-2xl border border-[#E5E5E0] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                      {SIGN_LANGUAGES.map(lang => (
                        <button
                          key={lang.id}
                          onClick={() => setSelectedLanguage(lang)}
                          className={cn(
                            "w-full text-left px-4 py-2 md:py-3 text-xs md:text-sm hover:bg-[#F5F5F0] transition-colors",
                            selectedLanguage.id === lang.id && "bg-[#F5F5F0] font-bold"
                          )}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Content */}
              <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                {/* Camera View */}
                <div className="w-full md:w-1/2 p-4 md:p-8 flex flex-col gap-4 md:gap-6 h-[40vh] md:h-auto">
                  <div className="flex-grow bg-black rounded-[24px] md:rounded-[32px] overflow-hidden relative shadow-2xl border-2 md:border-4 border-white">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2 md:gap-4">
                          <div className="w-8 h-8 md:w-12 md:h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
                          <span className="text-white font-bold tracking-widest text-[10px] md:text-sm uppercase">Interpreting...</span>
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                      <button 
                        onClick={captureAndTranslate}
                        disabled={isProcessing}
                        className="px-6 py-3 md:px-8 md:py-4 bg-white text-[#5A5A40] rounded-full text-sm md:font-bold shadow-xl hover:bg-[#F5F5F0] transition-all flex items-center gap-2 disabled:opacity-50"
                      >
                        <Camera className="w-4 h-4 md:w-5 md:h-5" />
                        Capture
                      </button>
                    </div>
                  </div>
                  
                  <div className="hidden md:block bg-white p-6 rounded-[32px] border border-[#E5E5E0]">
                    <h4 className="font-bold mb-2 flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-[#5A5A40]" />
                      How to use
                    </h4>
                    <p className="text-sm text-[#5A5A40] opacity-70 leading-relaxed">
                      Position yourself in front of the camera. Perform a sign gesture clearly and click "Capture Sign". Our AI will translate it and respond in the chat.
                    </p>
                  </div>
                </div>

                {/* Messages View */}
                <div className="w-full md:w-1/2 bg-white border-t md:border-t-0 md:border-l border-[#E5E5E0] flex flex-col h-[60vh] md:h-auto">
                  <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-6">
                    {messages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                        <MessageSquare className="w-8 h-8 md:w-12 md:h-12" />
                        <p className="max-w-xs text-sm md:text-base">Start a conversation by signing or typing below.</p>
                      </div>
                    )}
                    {messages.map((msg) => (
                      <div 
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[90%] md:max-w-[85%]",
                          msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                        )}
                      >
                        <div 
                          className={cn(
                            "px-4 py-3 md:px-6 md:py-4 rounded-[20px] md:rounded-[24px] text-xs md:text-sm",
                            msg.role === "user" 
                              ? "bg-[#5A5A40] text-white rounded-tr-none" 
                              : "bg-[#F5F5F0] text-[#1A1A1A] rounded-tl-none"
                          )}
                        >
                          <div className="prose prose-sm max-w-none prose-invert">
                            <ReactMarkdown>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                        <span className="text-[8px] md:text-[10px] text-[#5A5A40] mt-1 opacity-50">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat Input */}
                  <div className="p-4 md:p-8 border-t border-[#E5E5E0] bg-white">
                    <form onSubmit={handleSendMessage} className="relative">
                      <input 
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full bg-[#F5F5F0] border-none rounded-full py-3 md:py-4 pl-4 md:pl-6 pr-20 md:pr-24 text-sm focus:ring-2 focus:ring-[#5A5A40] outline-none transition-all"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 md:gap-2">
                        <button 
                          type="button"
                          className="p-1.5 md:p-2 hover:bg-[#E5E5E0] rounded-full transition-colors text-[#5A5A40]"
                        >
                          <Mic className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button 
                          type="submit"
                          className="p-1.5 md:p-2 bg-[#5A5A40] text-white rounded-full hover:bg-[#4A4A30] transition-colors shadow-lg"
                        >
                          <Send className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active = false, isOpen = true }: { icon: React.ReactNode, label: string, active?: boolean, isOpen?: boolean }) {
  return (
    <button 
      className={cn(
        "w-full flex items-center gap-4 p-3 rounded-xl transition-all",
        active ? "bg-[#F5F5F0] text-[#5A5A40] font-bold" : "text-[#5A5A40] opacity-60 hover:bg-[#F5F5F0] hover:opacity-100"
      )}
    >
      <div className="shrink-0">{icon}</div>
      {isOpen && <span className="text-sm">{label}</span>}
    </button>
  );
}

function DashboardCard({ icon, title, desc, color }: { icon: React.ReactNode, title: string, desc: string, color: string }) {
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className={cn("p-6 md:p-8 rounded-[24px] md:rounded-[32px] border border-[#E5E5E0] space-y-3 md:space-y-4 shadow-sm", color)}
    >
      <div className="w-10 h-10 md:w-12 md:h-12 bg-[#F5F5F0] rounded-xl md:rounded-2xl flex items-center justify-center text-[#5A5A40]">
        {icon}
      </div>
      <div>
        <h3 className="text-lg md:text-xl font-serif font-bold">{title}</h3>
        <p className="text-xs md:text-sm text-[#5A5A40] opacity-70 mt-1">{desc}</p>
      </div>
      <button className="text-xs md:text-sm font-bold text-[#5A5A40] pt-1 md:pt-2 flex items-center gap-2">
        Explore <ChevronDown className="w-4 h-4 -rotate-90" />
      </button>
    </motion.div>
  );
}
