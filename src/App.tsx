import { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { Search, Globe, ChevronLeft, ChevronRight, RotateCcw, Plus, X, Command, ExternalLink, Image as ImageIcon, Camera, Hand } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Tab {
  id: string;
  title: string;
  query: string;
  response: string;
  isLoading: boolean;
  sources: { title: string; uri: string }[];
}

interface SignLanguageChat {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const SIGN_LANGUAGES = [
  { id: 'psl', name: 'Pakistan Sign Language (PSL)' },
  { id: 'asl', name: 'American Sign Language (ASL)' },
  { id: 'bsl', name: 'British Sign Language (BSL)' },
  { id: 'isl', name: 'International Sign Language (ISL)' },
];

export default function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', title: 'New Tab', query: '', response: '', isLoading: false, sources: [] }
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<{ data: string; mimeType: string } | null>(null);
  const [isPSLMode, setIsPSLMode] = useState(false);
  const [selectedSignLanguage, setSelectedSignLanguage] = useState('psl');
  const [slChatHistory, setSlChatHistory] = useState<SignLanguageChat[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const queryToUse = input.trim();
    if (!queryToUse && !selectedImage && !isPSLMode) return;

    const currentImage = selectedImage;
    const currentPSLMode = isPSLMode;
    setInput("");
    setSelectedImage(null);
    
    // Update active tab state
    setTabs(prev => prev.map(t => 
      t.id === activeTabId 
        ? { 
            ...t, 
            query: currentPSLMode ? "PSL Interpretation" : (queryToUse || "Image Search"), 
            isLoading: true, 
            response: '', 
            sources: [], 
            title: currentPSLMode ? "PSL Assistant" : (queryToUse ? (queryToUse.slice(0, 15) + (queryToUse.length > 15 ? '...' : '')) : 'Image Search') 
          } 
        : t
    ));

    try {
      const parts: any[] = [];
      
      if (currentPSLMode && videoRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0);
        const base64Frame = canvas.toDataURL('image/jpeg').split(',')[1];
        
        const langName = SIGN_LANGUAGES.find(l => l.id === selectedSignLanguage)?.name || "Sign Language";
        
        parts.push({
          text: `Interpret this frame as ${langName}. Tell me what it means and respond in a way that helps someone who uses this sign language. If possible, describe the signs used.`
        });
        parts.push({
          inlineData: {
            data: base64Frame,
            mimeType: 'image/jpeg'
          }
        });
      } else {
        if (queryToUse) parts.push({ text: queryToUse });
        if (currentImage) {
          parts.push({
            inlineData: {
              data: currentImage.data,
              mimeType: currentImage.mimeType
            }
          });
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts },
        config: {
          systemInstruction: currentPSLMode ? `You are a ${SIGN_LANGUAGES.find(l => l.id === selectedSignLanguage)?.name} expert. Your goal is to interpret signs from images/frames and provide clear, helpful responses. If the user is signing, translate it to text and respond with the meaning and how to sign back if applicable.` : undefined,
          tools: currentPSLMode ? [] : [{ googleSearch: {} }],
        },
      });

      const text = response.text || "No response generated.";
      
      if (currentPSLMode) {
        setSlChatHistory(prev => [...prev, 
          { role: 'user', content: 'Captured Sign', timestamp: Date.now() },
          { role: 'assistant', content: text, timestamp: Date.now() }
        ]);
      }
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.filter(chunk => chunk.web)
        ?.map(chunk => ({ title: chunk.web!.title || 'Source', uri: chunk.web!.uri })) || [];

      setTabs(prev => prev.map(t => 
        t.id === activeTabId 
          ? { ...t, response: text, sources, isLoading: false } 
          : t
      ));
    } catch (error) {
      console.error("Search error:", error);
      setTabs(prev => prev.map(t => 
        t.id === activeTabId 
          ? { ...t, response: "Error: Could not fetch results. Please try again.", isLoading: false } 
          : t
      ));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      setSelectedImage({
        data: base64String,
        mimeType: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setCameraError(null);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setCameraError("Camera access denied. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  const togglePSLMode = () => {
    if (!isPSLMode) {
      setIsPSLMode(true);
      startCamera();
    } else {
      setIsPSLMode(false);
      stopCamera();
    }
  };

  const addNewTab = () => {
    const newId = Math.random().toString(36).substring(7);
    setTabs([...tabs, { id: newId, title: 'New Tab', query: '', response: '', isLoading: false, sources: [] }]);
    setActiveTabId(newId);
    setInput("");
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeTabId, activeTab.response]);

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fa] overflow-hidden">
      {/* Browser Chrome */}
      <div className="bg-[#e9ecef] border-b border-[#dee2e6] flex flex-col pt-2 px-2 gap-1">
        {/* Tabs Bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "group flex items-center gap-2 px-3 py-1.5 rounded-t-lg cursor-pointer min-w-[120px] max-w-[200px] transition-all",
                activeTabId === tab.id 
                  ? "bg-white text-[#202124] shadow-sm" 
                  : "text-[#5f6368] hover:bg-[#dadce0]"
              )}
            >
              <Globe className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-xs truncate flex-grow font-medium">
                {tab.title}
              </span>
              <button 
                onClick={(e) => closeTab(tab.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:bg-[#bdc1c6] rounded-full p-0.5 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button 
            onClick={addNewTab}
            className="p-1.5 hover:bg-[#dadce0] rounded-full text-[#5f6368] transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-t-none rounded-b-lg flex items-center gap-4 px-4 py-2 shadow-sm mb-1">
          <div className="flex items-center gap-2 text-[#5f6368]">
            <ChevronLeft className="w-4 h-4 cursor-pointer hover:text-black" />
            <ChevronRight className="w-4 h-4 cursor-pointer hover:text-black" />
            <RotateCcw className="w-4 h-4 cursor-pointer hover:text-black ml-1" />
          </div>
          
          <form onSubmit={handleSearch} className="flex-grow relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5f6368] flex items-center gap-2">
              <Search className="w-4 h-4" />
              {selectedImage && (
                <div className="relative w-6 h-6 rounded border border-[#dadce0] overflow-hidden group/img">
                  <img 
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                    className="w-full h-full object-cover"
                    alt="Preview"
                  />
                  <button 
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                </div>
              )}
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={selectedImage ? "Add a question about this image..." : "Search or enter query..."}
              className={cn(
                "w-full bg-[#f1f3f4] border-none rounded-full py-1.5 pr-12 text-sm focus:bg-white focus:ring-2 focus:ring-[#8ab4f8] outline-none transition-all",
                selectedImage ? "pl-16" : "pl-10"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <button
                type="button"
                onClick={togglePSLMode}
                className={cn(
                  "p-1 rounded-full transition-colors",
                  isPSLMode ? "bg-[#1a73e8] text-white" : "hover:bg-[#dadce0] text-[#5f6368]"
                )}
                title="PSL Sign Language Mode"
              >
                <Hand className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1 hover:bg-[#dadce0] rounded-full text-[#5f6368] transition-colors"
                title="Upload image"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
              <div className="hidden group-focus-within:flex items-center gap-1 text-[10px] text-[#5f6368] font-mono">
                <Command className="w-2.5 h-2.5" />
                <span>ENTER</span>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Browser Content Viewport */}
      <main className="flex-grow overflow-hidden bg-white relative">
        <div 
          ref={scrollRef}
          className="h-full overflow-y-auto px-6 py-8 md:px-12 lg:px-24"
        >
          {!activeTab.query && !activeTab.isLoading && (
            <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto text-center space-y-8">
              {isPSLMode ? (
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                  {/* Camera Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xl font-bold text-[#202124] flex items-center gap-2">
                        <Camera className="w-5 h-5 text-[#1a73e8]" />
                        Sign Language AI Emulator
                      </h2>
                      <select 
                        value={selectedSignLanguage}
                        onChange={(e) => setSelectedSignLanguage(e.target.value)}
                        className="text-xs bg-white border border-[#dadce0] rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-[#8ab4f8]"
                      >
                        {SIGN_LANGUAGES.map(lang => (
                          <option key={lang.id} value={lang.id}>{lang.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border-4 border-[#1a73e8] shadow-2xl">
                      <video 
                        ref={videoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {!isCameraActive && !cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center text-white bg-black/60">
                          <p>Starting Camera...</p>
                        </div>
                      )}
                      {cameraError && (
                        <div className="absolute inset-0 flex items-center justify-center text-red-400 bg-black/80 px-4">
                          <p>{cameraError}</p>
                        </div>
                      )}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <button 
                          onClick={() => handleSearch()}
                          className="bg-[#1a73e8] text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-[#1557b0] transition-all flex items-center gap-2 active:scale-95"
                        >
                          <Camera className="w-5 h-5" />
                          Capture Sign
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-[#5f6368]">Position yourself clearly and click capture for AI interpretation.</p>
                  </div>

                  {/* Chat History Section */}
                  <div className="bg-[#f8f9fa] rounded-2xl border border-[#dadce0] h-[400px] lg:h-[450px] flex flex-col overflow-hidden shadow-inner">
                    <div className="bg-white border-b border-[#dadce0] px-4 py-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-[#202124]">Sign Language Chat</span>
                      <button 
                        onClick={() => setSlChatHistory([])}
                        className="text-[10px] text-[#5f6368] hover:text-red-500 font-medium"
                      >
                        Clear Chat
                      </button>
                    </div>
                    <div className="flex-grow overflow-y-auto p-4 space-y-4">
                      {slChatHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-[#5f6368] space-y-2 opacity-60">
                          <Hand className="w-8 h-8" />
                          <p className="text-xs">No messages yet. Start signing!</p>
                        </div>
                      ) : (
                        slChatHistory.map((msg, i) => (
                          <div key={i} className={cn(
                            "flex flex-col max-w-[85%]",
                            msg.role === 'user' ? "ml-auto items-end" : "items-start"
                          )}>
                            <div className={cn(
                              "px-3 py-2 rounded-2xl text-sm",
                              msg.role === 'user' 
                                ? "bg-[#1a73e8] text-white rounded-tr-none" 
                                : "bg-white border border-[#dadce0] text-[#202124] rounded-tl-none"
                            )}>
                              <ReactMarkdown>{msg.content}</ReactMarkdown>
                            </div>
                            <span className="text-[9px] text-[#5f6368] mt-1">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="w-20 h-20 bg-[#f1f3f4] rounded-2xl flex items-center justify-center animate-pulse">
                    <Globe className="w-10 h-10 text-[#1a73e8]" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight text-[#202124]">Gemini Flash Browser</h1>
                    <p className="text-[#5f6368] text-lg">Search the web with the speed of Flash and the intelligence of Gemini.</p>
                  </div>
                </>
              )}
              
              {!isPSLMode && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {[
                    "Latest tech news today",
                    "How to bake sourdough bread",
                    "Best travel destinations for 2024",
                    "Explain quantum computing simply"
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        // Trigger search immediately
                        const fakeEvent = { preventDefault: () => {} } as any;
                        setTimeout(() => handleSearch(fakeEvent), 0);
                      }}
                      className="p-4 border border-[#dadce0] rounded-xl text-left hover:bg-[#f8f9fa] hover:border-[#8ab4f8] transition-all group"
                    >
                      <span className="text-sm font-medium text-[#202124] group-hover:text-[#1a73e8]">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab.isLoading && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="h-8 bg-[#f1f3f4] rounded w-3/4 animate-pulse" />
              <div className="space-y-3">
                <div className="h-4 bg-[#f1f3f4] rounded animate-pulse" />
                <div className="h-4 bg-[#f1f3f4] rounded animate-pulse" />
                <div className="h-4 bg-[#f1f3f4] rounded w-5/6 animate-pulse" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 bg-[#f1f3f4] rounded-full w-24 animate-pulse" />
                <div className="h-8 bg-[#f1f3f4] rounded-full w-24 animate-pulse" />
              </div>
            </div>
          )}

          {activeTab.response && (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="prose prose-slate max-w-none">
                <ReactMarkdown
                  components={{
                    h1: ({ ...props }) => <h1 className="text-3xl font-bold mb-4 text-[#202124]" {...props} />,
                    h2: ({ ...props }) => <h2 className="text-2xl font-semibold mb-3 text-[#202124]" {...props} />,
                    p: ({ ...props }) => <p className="text-[#3c4043] leading-relaxed mb-4" {...props} />,
                    ul: ({ ...props }) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
                    li: ({ ...props }) => <li className="text-[#3c4043]" {...props} />,
                    code: ({ ...props }) => <code className="bg-[#f1f3f4] px-1.5 py-0.5 rounded font-mono text-sm" {...props} />,
                  }}
                >
                  {activeTab.response}
                </ReactMarkdown>
              </div>

              {activeTab.sources.length > 0 && (
                <div className="border-t border-[#dadce0] pt-6">
                  <h3 className="text-sm font-semibold text-[#5f6368] uppercase tracking-wider mb-4 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Sources & References
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {activeTab.sources.map((source, i) => (
                      <a
                        key={i}
                        href={source.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border border-[#dadce0] hover:bg-[#f8f9fa] hover:border-[#1a73e8] transition-all group"
                      >
                        <div className="w-8 h-8 rounded bg-[#f1f3f4] flex items-center justify-center flex-shrink-0 group-hover:bg-[#e8f0fe]">
                          <Globe className="w-4 h-4 text-[#5f6368] group-hover:text-[#1a73e8]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#202124] truncate">{source.title}</p>
                          <p className="text-xs text-[#5f6368] truncate">{new URL(source.uri).hostname}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Status Bar */}
      <footer className="bg-[#f1f3f4] border-t border-[#dee2e6] px-4 py-1 flex items-center justify-between text-[10px] text-[#5f6368] font-medium">
        <div className="flex items-center gap-4">
          <span>Gemini 3 Flash</span>
          <span>Google Search Grounding Enabled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>Secure Connection</span>
        </div>
      </footer>
    </div>
  );
}
