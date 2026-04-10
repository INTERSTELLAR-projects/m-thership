import { useState, useEffect, useRef } from "react";
import { Search, Send, Paperclip, Mic, Image, FileText, X, Loader2, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import MicButton from "../components/MicButton";

export default function Comms() {
  const [user, setUser] = useState(null);
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef();
  const imageInputRef = useRef();
  const audioInputRef = useRef();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load all CRM clients
      const allClients = await base44.entities.CRMClient.list("-created_date", 200);
      setClients(allClients);

      // Auto-select first client if available
      if (allClients.length > 0) {
        loadMessages(currentUser, allClients[0]);
        setSelectedClient(allClients[0]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
    setLoading(false);
  };

  const loadMessages = async (currentUser, client) => {
    try {
      const allMessages = await base44.entities.ConversationMessage.filter(
        {
          recipientEmail: client.emails?.[0] || "",
          senderEmail: currentUser.email
        },
        "-timestamp",
        500
      );

      const returnMessages = await base44.entities.ConversationMessage.filter(
        {
          senderEmail: client.emails?.[0] || "",
          recipientEmail: currentUser.email
        },
        "-timestamp",
        500
      );

      const combined = [...allMessages, ...returnMessages].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      setMessages(combined);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleClientSelect = (client) => {
    setSelectedClient(client);
    setShowClientDropdown(false);
    loadMessages(user, client);
    setSearch("");
    setSearchResults([]);
    setHighlightedMessageId(null);
  };

  const sendMessage = async (content, type = "text", attachments = []) => {
    if (!selectedClient || !content.trim()) return;

    setSending(true);
    try {
      const newMessage = {
        senderEmail: user.email,
        recipientEmail: selectedClient.emails?.[0] || "",
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
        <PageHeader breadcrumb="Portal / Comms" rightText="Private Messaging" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PageHeader breadcrumb="Portal / Comms" rightText="Private Messaging" />
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Client List */}
        <div className="w-64 border-r border-white/5 flex flex-col">
          <div className="p-4 border-b border-white/5">
            <div className="relative">
              <button
                onClick={() => setShowClientDropdown(!showClientDropdown)}
                className="w-full px-3 py-2 bg-card border border-white/[0.06] rounded-lg text-white text-sm font-medium flex items-center justify-between hover:border-white/[0.12] transition-all"
              >
                <span className="truncate">{selectedClient?.business || "Select Client"}</span>
                <ChevronDown className="w-4 h-4 text-white/40" />
              </button>
              {showClientDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-white/[0.06] rounded-lg z-50 max-h-64 overflow-y-auto">
                  {clients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleClientSelect(client)}
                      className="w-full text-left px-3 py-2 hover:bg-white/[0.05] border-b border-white/[0.03] last:border-0 text-white/70 text-sm transition-colors"
                    >
                      {client.business}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {clients.length === 0 ? (
              <p className="text-white/25 text-xs p-4">No clients yet.</p>
            ) : (
              clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => handleClientSelect(client)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                    selectedClient?.id === client.id
                      ? "bg-orange-500/10 border-l-2 border-l-orange-500 text-orange-400"
                      : "hover:bg-white/[0.02] text-white/60"
                  }`}
                >
                  <p className="text-sm font-medium truncate">{client.business}</p>
                  <p className="text-xs text-white/30 truncate">{client.emails?.[0]}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedClient ? (
            <>
              {/* Search Bar */}
              <div className="px-6 py-4 border-b border-white/5">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <input
                    type="text"
                    placeholder="Search conversation..."
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-card border border-white/[0.06] rounded-lg text-white placeholder:text-white/20 outline-none focus:border-orange-500/30"
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
                              ? "bg-orange-500/20 border border-orange-500/30 text-white"
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
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/25 text-sm">Select a client to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}