import { useState, useEffect, useRef } from "react";
import { Send, Paperclip, Mic, Image, FileText, Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import MicButton from "../MicButton";

const ADMIN_EMAIL = "justin@interstellar-strategies.com";

export default function ClientCommsTab({ clientEmail }) {
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef();
  const imageInputRef = useRef();
  const audioInputRef = useRef();

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 2000);
    return () => clearInterval(interval);
  }, [clientEmail]);

  const loadMessages = async () => {
    if (!clientEmail) return;
    try {
      const toClientMessages = await base44.entities.ConversationMessage.filter(
        { senderEmail: ADMIN_EMAIL, recipientEmail: clientEmail },
        "-timestamp",
        500
      );

      const fromClientMessages = await base44.entities.ConversationMessage.filter(
        { senderEmail: clientEmail, recipientEmail: ADMIN_EMAIL },
        "-timestamp",
        500
      );

      const combined = [...toClientMessages, ...fromClientMessages].sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      setMessages(combined);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      setLoading(false);
    } catch (error) {
      console.error("Error loading messages:", error);
      setLoading(false);
    }
  };

  const sendMessage = async (content, type = "text", attachments = []) => {
    if (!content.trim()) return;

    setSending(true);
    try {
      const newMessage = {
        senderEmail: ADMIN_EMAIL,
        recipientEmail: clientEmail,
        content,
        messageType: type,
        attachments,
        timestamp: new Date().toISOString()
      };

      await base44.entities.ConversationMessage.create(newMessage);
      await loadMessages();
      setMessageText("");
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 h-[600px] flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-3 border border-white/[0.06] rounded-lg p-4 bg-white/[0.02]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/25 text-sm">No messages yet</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderEmail === ADMIN_EMAIL ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs rounded-lg px-3 py-2 ${
                  msg.senderEmail === ADMIN_EMAIL
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
                  <audio controls src={msg.attachments[0].url} className="max-w-xs h-8" />
                )}
                <p className="text-xs text-white/30 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="space-y-2">
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
            title="Send image"
          >
            <Image className="w-4 h-4" />
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
            <Paperclip className="w-4 h-4" />
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
            title="Send audio"
          >
            <Mic className="w-4 h-4" />
          </button>

          <div className="flex-1" />

          <MicButton
            onResult={(text) => setMessageText((p) => p + (p ? " " : "") + text)}
            className="p-2 text-white/40 hover:text-white/60"
          />
        </div>

        <div className="flex gap-2">
          <textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(messageText);
              }
            }}
            placeholder="Type message... (Shift+Enter for new line)"
            className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/30 resize-none max-h-20"
            rows="2"
          />
          <button
            onClick={() => sendMessage(messageText)}
            disabled={!messageText.trim() || sending}
            className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2 h-fit"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}