import { useState, useRef } from "react";
import { Mic, MicOff } from "lucide-react";

export default function MicButton({ onResult, className = "" }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      onResult(transcript);
    };

    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop recording" : "Speak to type"}
      className={`p-1.5 rounded-md transition-all ${
        listening
          ? "text-red-600 bg-red-500/10 animate-pulse"
          : "text-ink/[0.43] hover:text-orange-500/70 hover:bg-orange-500/10"
      } ${className}`}
    >
      {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
    </button>
  );
}