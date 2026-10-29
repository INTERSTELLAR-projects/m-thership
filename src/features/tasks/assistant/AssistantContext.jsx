import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { createRecognizer, requestMicAccess, speak, speechSupported, stopSpeaking, warmVoices } from "@/features/tasks/lib/speech";
import { emitTasksChanged } from "@/features/tasks/lib/clients";

const AssistantContext = createContext(null);

// Returns null when no AssistantProvider is mounted above the caller.
export const useAssistant = () => useContext(AssistantContext);

const WAKE = /^(hey |ok |okay |yo )?(interstellar|command|computer|mothership)\b[,:.\s]*/i;

export function AssistantProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("idle");
  const [interim, setInterim] = useState("");
  const [turns, setTurns] = useState([]);
  const [notice, setNotice] = useState("");
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const supported = useMemo(() => speechSupported(), []);

  const toggleWebcam = useCallback(async () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      setWebcamStream(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      setWebcamStream(stream);
    } catch (error) {
      setNotice("Camera access was refused or is unavailable.");
    }
  }, [webcamStream]);

  useEffect(
    () => () => {
      if (webcamStream) webcamStream.getTracks().forEach((track) => track.stop());
    },
    [webcamStream]
  );

  const recRef = useRef(null);
  const listenRef = useRef(false);
  const alwaysRef = useRef(false);
  const busyRef = useRef(false);
  const runRef = useRef(null);
  const beginRef = useRef(null);

  useEffect(() => {
    warmVoices(() => {});
  }, []);

  const pushTurn = (role, text) => {
    setTurns((prev) => [...prev.slice(-7), { role, text, at: Date.now() + Math.random() }]);
  };

  const runCommand = useCallback(async (raw) => {
    const text = String(raw || "").trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setInterim("");
    setMode("processing");
    setNotice("Processing command...");
    pushTurn("you", text);

    const activeRecognition = recRef.current;
    recRef.current = null;
    if (activeRecognition) {
      try {
        activeRecognition.stop();
      } catch (error) {
        /* already stopped */
      }
    }

    let spoken = "I could not reach the command core just now.";
    try {
      const response = await base44.functions.invoke("voice-command", {
        transcript: text,
        page: typeof window !== "undefined" ? window.location.pathname : "/"
      });
      const data = (response && response.data) || {};
      if (data.speech) spoken = data.speech;
      else if (data.error) spoken = "The command core returned an error on that one.";
      if (data.filed || data.queued) emitTasksChanged();
    } catch (error) {
      const status = error && error.response && error.response.status;
      spoken = status === 403 ? "Only an admin can run the command core." : "I could not reach the command core just now.";
    }

    pushTurn("ai", spoken);
    setNotice(spoken);
    setMode("speaking");
    speak(spoken, {
      onEnd: () => {
        busyRef.current = false;
        setMode("idle");
        if (listenRef.current && beginRef.current) window.setTimeout(() => beginRef.current(), 250);
      }
    });
    window.setTimeout(() => {
      busyRef.current = false;
    }, 20000);
  }, []);

  useEffect(() => {
    runRef.current = runCommand;
  }, [runCommand]);

  const beginRecognition = useCallback(() => {
    if (!supported) {
      setNotice("Voice capture runs in Chrome. Use the typed command line for now.");
      return;
    }
    if (busyRef.current || recRef.current) return;
    const recognition = createRecognizer({
      onInterim: (text) => setInterim(text),
      onFinal: (text) => {
        if (alwaysRef.current) {
          const match = text.match(WAKE);
          if (!match) return;
          const command = text.replace(WAKE, "").trim();
          setInterim("");
          if (command.length > 2 && runRef.current) runRef.current(command);
          return;
        }
        if (runRef.current) runRef.current(text);
      },
      onEnd: () => {
        recRef.current = null;
        if (listenRef.current && !busyRef.current && beginRef.current) {
          window.setTimeout(() => {
            if (listenRef.current && !busyRef.current) beginRef.current();
          }, 400);
        }
      },
      onError: (event) => {
        const code = event && event.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          listenRef.current = false;
          setAlwaysOn(false);
          setMode("idle");
          setNotice("Microphone access is blocked for this app. Allow it in your browser, then reopen the mic.");
        }
      }
    });
    if (!recognition) return;
    recRef.current = recognition;
    try {
      recognition.start();
      setMode("listening");
      setNotice(alwaysRef.current ? "Listening. Say Interstellar, then your command." : "Listening...");
    } catch (error) {
      recRef.current = null;
    }
  }, [supported]);

  useEffect(() => {
    beginRef.current = beginRecognition;
  }, [beginRecognition]);

  const startListening = useCallback(async () => {
    setOpen(true);
    if (!supported) {
      setNotice("Voice capture runs in Chrome. Use the typed command line for now.");
      return;
    }
    const granted = await requestMicAccess();
    if (!granted) {
      setNotice("Microphone permission was refused. Allow mic access in your browser to talk to the assistant.");
      return;
    }
    listenRef.current = true;
    beginRecognition();
  }, [supported, beginRecognition]);

  const stopListening = useCallback(() => {
    listenRef.current = false;
    alwaysRef.current = false;
    setAlwaysOn(false);
    const recognition = recRef.current;
    recRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch (error) {
        /* already stopped */
      }
    }
    stopSpeaking();
    setMode("idle");
    setInterim("");
    setNotice("");
  }, []);

  const toggleAlwaysOn = useCallback(
    async (next) => {
      if (!next) {
        stopListening();
        return;
      }
      setOpen(true);
      alwaysRef.current = true;
      setAlwaysOn(true);
      await startListening();
      setAlwaysOn(true);
    },
    [startListening, stopListening]
  );

  useEffect(() => {
    alwaysRef.current = alwaysOn;
  }, [alwaysOn]);

  useEffect(() => () => stopListening(), [stopListening]);

  const value = {
    open,
    setOpen,
    mode,
    interim,
    turns,
    notice,
    alwaysOn,
    supported,
    webcamStream,
    webcamOn: !!webcamStream,
    toggleWebcam,
    listening: mode === "listening",
    busy: mode === "processing" || mode === "speaking",
    startListening,
    stopListening,
    toggleAlwaysOn,
    runCommand,
    clear: () => {
      setTurns([]);
      setNotice("");
    }
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}
