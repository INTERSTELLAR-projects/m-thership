import { useState, useEffect, useRef } from "react";
import { Search, Send, Paperclip, Mic, Image, FileText, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";

export default function ClientComms() {
  const [user, setUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef();
  const imageInputRef = useRef();
  const audioInputRef = useRef();

  const ADMIN_EMAIL = "justin@interstellar-strategies.com";

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      loadMessages(currentUser);
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const loadMessages = async (currentUser) => {
    try {
      // Get messages from admin to client
      const toClientMessages = await base44.entities.ConversationMessage.filter(
        {
          senderEmail: ADMIN_EMAIL,
          recipientEmail: currentUser.email
        },
        "-timestamp",
        500
      );

      // Get messages from client to admin
      const fromClientMessages = await base44.entities.ConversationMessage.filter(
        {
          senderEmail: currentUser.email,
          recipientEmail: ADMIN_EMAIL
        },
        "-timestamp",
        500
      );

      const combined = [...toClientMessages, ...fromClientMessages].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      setMessages(combined);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const sendMessage = async (content, type = "text", attachments = []) => {
    if (!content.trim()) return;

    setSending(true);
    try {
      const newMessage = {
        senderEmail: user.email,
        recipientEmail: ADMIN_EMAIL,
        content,
        messageType: type,
        attachments,
        timestamp: new Date().toISOString()
      };

      await base44.entities.ConversationMessage.create(newMessage);
      setMessages([...messages, newMessage]);
      setMessageText("");
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error) {
      console.error("Error sending message:", error);
    }
    setSending(false);
  };

  const handleFileUpload = async (e, type) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await sendMessage(
        type === "document" ? file.name : "",
        type,
        [{ name: file.name, url: file_url, type: file.type }]
      );
    }
    e.target.value = "";
  };

  const handleSearch = (query) => {
    setSearch(query);
    if (query.trim()) {
      const results = messages.filter((m) =>
        m.content.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
      if (results.length > 0) {
        setHighlightedMessageId(results[0].id);
        setTimeout(
          () =>
            document
              .getElementById(`msg-${results[0].id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" }),
          100
        );
      }
    } else {
      setSearchResults([]);
      setHighlightedMessageId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader breadcrumb="Portal / Comms" rightText="Message with Admin" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader breadcrumb="Portal / Comms" rightText="Message with Admin" />
      <div className="flex-1 flex flex-col">
        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input
              type="text"
              placeholder="Search conversation..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-card border border-white/[0.06] rounded-lg text-white placeholder:text-white/20 outline-none focus:border-orange-500/30 max-w-sm"
            />
          </div>
          {searchResults.length > 0 && (
            <p className="text-xs text-white/40 mt-2">
              Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/25 text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`transition-colors ${
                  highlightedMessageId === msg.id
                    ? "bg-orange-500/20 px-4 py-2 rounded-lg"
                    : ""
                }`}
              >
                <div className={`flex ${msg.senderEmail === user.email ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-md rounded-lg px-4 py-2 ${
                      msg.senderEmail === user.email
                        ? "bg-gradient-to-br from-orange-500/25 to-amber-400/10 border border-orange-500/40 text-white"
                        : "bg-white/[0.05] border border-white/[0.06] text-white/80"
                    }`}
                  >
                    {msg.messageType === "text" && (
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    )}
                    {msg.messageType === "image" && msg.attachments?.[0] && (
                      <img
                        src={msg.attachments[0].url}
                        alt="Sent image"
                        className="max-w-xs rounded-lg"
                      />
                    )}
                    {msg.messageType === "document" && msg.attachments?.[0] && (
                      <a
                        href={msg.attachments[0].url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm"
                      >
                        <FileText className="w-4 h-4" />
                        {msg.attachments[0].name}
                      </a>
                    )}
                    {msg.messageType === "audio" && msg.attachments?.[0] && (
                      <audio
                        controls
                        src={msg.attachments[0].url}
                        className="max-w-xs"
                      />
                    )}
                    <p className="text-xs text-white/30 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-6 py-4 border-t border-white/5 space-y-3">
          <div className="flex gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*,image/gif"
              onChange={(e) => handleFileUpload(e, "image")}
              className="hidden"
            />
            <button
              onClick={() => imageInputRef.current?.click()}
              className="p-2 text-white/40 hover:text-white/60 hover:bg-white/[0.05] rounded-lg transition-colors"
              title="Send image or GIF"
            >
              <Image className="w-5 h-5" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleFileUpload(e, "document")}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-white/40 hover:text-white/60 hover:bg-white/[0.05] rounded-lg transition-colors"
              title="Send document"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => handleFileUpload(e, "audio")}
              className="hidden"
            />
            <button
              onClick={() => audioInputRef.current?.click()}
              className="p-2 text-white/40 hover:text-white/60 hover:bg-white/[0.05] rounded-lg transition-colors"
              title="Send audio file"
            >
              <Mic className="w-5 h-5" />
            </button>

            <div className="flex-1" />

            <MicButton
              onResult={(text) => setMessageText((p) => p + (p ? " " : "") + text)}
              className="p-2 text-white/40 hover:text-white/60"
            />
          </div>

          <div className="flex gap-3">
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(messageText);
                }
              }}
              placeholder="Type a message... (Shift+Enter for new line)"
              className="flex-1 bg-card border border-white/[0.06] rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/30 resize-none max-h-24"
              rows="2"
            />
            <button
              onClick={() => sendMessage(messageText)}
              disabled={!messageText.trim() || sending}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-[0_0_14px_rgba(255,106,0,0.25)] flex items-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}