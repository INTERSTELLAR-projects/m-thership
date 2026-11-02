import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  coreVoiceStatus,
  createRecognizer,
  requestMicAccess,
  speak,
  speechSupported,
  stopSpeaking,
  transcribeAudio,
  warmVoices
} from "@/features/tasks/lib/speech";
import { recorderSupported, startRecorder } from "@/features/tasks/lib/recorder";
import { emitTasksChanged } from "@/features/tasks/lib/clients";

const AssistantContext = createContext(null);

// Returns null when no AssistantProvider is mounted above the caller.
export const useAssistant = () => useContext(AssistantContext);

const WAKE = /^(hey |ok |okay |yo )?(interstellar|command|computer|mothership)\b[,:.\s]*/i;

const join = (...parts) => parts.map((p) => String(p || "").trim()).filter(Boolean).join(" ");

// Dictation works like Whisper: it records until Justin taps Stop (pauses never end it),
// then the transcript lands in an editable box. Nothing is sent until he taps Send.
// Hands-free mode (wake word) is the one opt-in exception that sends on its own.
export function AssistantProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("idle"); // idle | listening | transcribing | processing | speaking
  const [interim, setInterim] = useState("");
  const [heard, setHeard] = useState(""); // settled Web Speech text this take
  const [draft, setDraft] = useState("");
  const [level, setLevel] = useState(0);
  const [turns, setTurns] = useState([]);
  const [notice, setNotice] = useState("");
  const [alwaysOn, setAlwaysOn] = useState(false);
  const [webcamStream, setWebcamStream] = useState(null);
  const [voiceServer, setVoiceServer] = useState(false);
  const recognitionSupported = useMemo(() => speechSupported(), []);
  const canRecord = useMemo(() => recorderSupported(), []);
  const supported = recognitionSupported || canRecord;

  const recRef = useRef(null); // Web Speech recognizer
  const recorderRef = useRef(null); // MediaRecorder session
  const dictatingRef = useRef(false);
  const alwaysRef = useRef(false);
  const busyRef = useRef(false);
  const heardRef = useRef("");
  const interimRef = useRef("");
  const baseRef = useRef(""); // text already in the box when this take started
  const levelAtRef = useRef(0);
  const beginRecRef = useRef(null);

  useEffect(() => warmVoices(() => {}), []);
  useEffect(() => {
    coreVoiceStatus().then((s) => setVoiceServer(!!s.available));
  }, []);

  const toggleWebcam = useCallback(async () => {
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      setWebcamStream(null);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false });
      setWebcamStream(stream);
    } catch {
      setNotice("Camera access was refused or is unavailable.");
    }
  }, [webcamStream]);

  useEffect(
    () => () => {
      if (webcamStream) webcamStream.getTracks().forEach((track) => track.stop());
    },
    [webcamStream]
  );

  const pushTurn = (role, text) => {
    setTurns((prev) => [...prev.slice(-7), { role, text, at: Date.now() + Math.random() }]);
  };

  const stopRecognition = () => {
    const recognition = recRef.current;
    recRef.current = null;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        /* already stopped */
      }
    }
  };

  const onLevel = (value) => {
    const now = performance.now();
    if (value === 0 || now - levelAtRef.current > 60) {
      levelAtRef.current = now;
      setLevel(value);
    }
  };

  /* ---------------- Command + reply ---------------- */

  const runCommand = useCallback(async (raw) => {
    const text = String(raw || "").trim();
    if (!text || busyRef.current) return;
    busyRef.current = true;
    setInterim("");
    setMode("processing");
    setNotice("Processing command...");
    pushTurn("you", text);
    if (!alwaysRef.current) stopRecognition();

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
      const status = (error && error.response && error.response.status) || (error && error.status);
      spoken = status === 403 ? "Only an admin can run the command core." : "I could not reach the command core just now.";
    }

    pushTurn("ai", spoken);
    setNotice(spoken);
    setMode("speaking");
    const done = () => {
      busyRef.current = false;
      setMode((m) => (m === "speaking" ? "idle" : m));
      if (alwaysRef.current && beginRecRef.current) window.setTimeout(() => beginRecRef.current(), 250);
    };
    speak(spoken, { onEnd: done });
  }, []);

  const interrupt = useCallback(() => {
    stopSpeaking();
    busyRef.current = false;
    setMode((m) => (m === "speaking" ? "idle" : m));
  }, []);

  /* ---------------- Web Speech (live words + hands-free) ---------------- */

  const beginRecognition = useCallback(() => {
    if (!recognitionSupported || recRef.current) return;
    if (!dictatingRef.current && !alwaysRef.current) return;
    if (alwaysRef.current && busyRef.current) return;
    const recognition = createRecognizer({
      onInterim: (text) => {
        interimRef.current = text;
        setInterim(text);
      },
      onFinal: (text) => {
        if (alwaysRef.current) {
          const match = text.match(WAKE);
          if (!match) return;
          const command = text.replace(WAKE, "").trim();
          interimRef.current = "";
          setInterim("");
          if (command.length > 2) runCommand(command);
          return;
        }
        heardRef.current = join(heardRef.current, text);
        interimRef.current = "";
        setHeard(heardRef.current);
        setInterim("");
      },
      onEnd: () => {
        recRef.current = null;
        // Chrome ends recognition after a pause or ~60s. Keep going until Justin taps Stop.
        if (interimRef.current && dictatingRef.current) {
          heardRef.current = join(heardRef.current, interimRef.current);
          interimRef.current = "";
          setHeard(heardRef.current);
          setInterim("");
        }
        const keepGoing = dictatingRef.current || (alwaysRef.current && !busyRef.current);
        if (keepGoing && beginRecRef.current) window.setTimeout(() => beginRecRef.current && beginRecRef.current(), 150);
      },
      onError: (event) => {
        const code = event && event.error;
        if (code === "not-allowed" || code === "service-not-allowed") {
          alwaysRef.current = false;
          setAlwaysOn(false);
          if (!recorderRef.current) {
            dictatingRef.current = false;
            setMode("idle");
          }
          setNotice("Live captions are blocked for this app. Allow the microphone in your browser.");
        }
      }
    });
    if (!recognition) return;
    recRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recRef.current = null;
    }
  }, [recognitionSupported, runCommand]);

  useEffect(() => {
    beginRecRef.current = beginRecognition;
  }, [beginRecognition]);

  /* ---------------- Dictation ---------------- */

  const finishDictation = useCallback(async () => {
    if (!dictatingRef.current) return;
    dictatingRef.current = false;
    stopRecognition();
    const spokenText = join(heardRef.current, interimRef.current);
    const session = recorderRef.current;
    recorderRef.current = null;
    setInterim("");
    let finalText = spokenText;

    if (session) {
      const blob = await session.stop();
      if (voiceServer && blob.size > 2000) {
        setMode("transcribing");
        setNotice("Transcribing...");
        try {
          const text = await transcribeAudio(blob);
          if (text) finalText = text;
        } catch {
          setNotice("Server transcription failed, using the live captions instead.");
        }
      }
    }

    heardRef.current = "";
    interimRef.current = "";
    setHeard("");
    setDraft(join(baseRef.current, finalText));
    setMode("idle");
    setNotice((n) => (n === "Transcribing..." || n === "Recording... tap Stop when you're done." ? "" : n));
  }, [voiceServer]);

  const startListening = useCallback(async () => {
    setOpen(true);
    if (dictatingRef.current) return;
    if (!supported) {
      setNotice("Voice capture is not available in this browser. Type the command instead.");
      return;
    }
    stopSpeaking();
    busyRef.current = false;
    alwaysRef.current = false;
    setAlwaysOn(false);
    stopRecognition();

    baseRef.current = draft;
    heardRef.current = "";
    interimRef.current = "";
    setHeard("");
    setInterim("");

    if (canRecord) {
      try {
        recorderRef.current = await startRecorder({
          onLevel,
          onAutoStop: () => {
            setNotice("Ten minute limit reached, stopping.");
            finishDictation();
          }
        });
      } catch {
        recorderRef.current = null;
        if (!recognitionSupported) {
          setNotice("Microphone permission was refused. Allow mic access in your browser to talk to the core.");
          return;
        }
      }
    } else {
      const granted = await requestMicAccess();
      if (!granted) {
        setNotice("Microphone permission was refused. Allow mic access in your browser to talk to the core.");
        return;
      }
    }

    dictatingRef.current = true;
    setMode("listening");
    setNotice("Recording... tap Stop when you're done.");
    beginRecognition();
  }, [supported, canRecord, recognitionSupported, draft, beginRecognition, finishDictation]);

  const cancelDictation = useCallback(() => {
    dictatingRef.current = false;
    stopRecognition();
    if (recorderRef.current) recorderRef.current.cancel();
    recorderRef.current = null;
    heardRef.current = "";
    interimRef.current = "";
    setHeard("");
    setInterim("");
    setMode("idle");
    setNotice("");
  }, []);

  // Stop everything: dictation keeps what was captured, hands-free turns off, speech stops.
  const stopListening = useCallback(() => {
    if (dictatingRef.current) finishDictation();
    alwaysRef.current = false;
    setAlwaysOn(false);
    if (!dictatingRef.current) stopRecognition();
    stopSpeaking();
    busyRef.current = false;
    setMode((m) => (m === "listening" || m === "transcribing" ? m : "idle"));
  }, [finishDictation]);

  const toggleAlwaysOn = useCallback(
    async (next) => {
      if (!next) {
        alwaysRef.current = false;
        setAlwaysOn(false);
        stopRecognition();
        setMode("idle");
        setNotice("");
        return;
      }
      setOpen(true);
      if (!recognitionSupported) {
        setNotice("Hands-free mode needs Chrome or Edge.");
        return;
      }
      if (dictatingRef.current) cancelDictation();
      const granted = await requestMicAccess();
      if (!granted) {
        setNotice("Microphone permission was refused.");
        return;
      }
      alwaysRef.current = true;
      setAlwaysOn(true);
      setMode("listening");
      setNotice("Hands free. Say Interstellar, then your command.");
      beginRecognition();
    },
    [recognitionSupported, cancelDictation, beginRecognition]
  );

  const sendDraft = useCallback(() => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    runCommand(text);
  }, [draft, runCommand]);

  useEffect(
    () => () => {
      dictatingRef.current = false;
      alwaysRef.current = false;
      stopRecognition();
      if (recorderRef.current) recorderRef.current.cancel();
      stopSpeaking();
    },
    []
  );

  const listening = mode === "listening";
  const value = {
    open,
    setOpen,
    mode,
    interim,
    turns,
    notice,
    alwaysOn,
    supported,
    voiceServer,
    level,
    webcamStream,
    webcamOn: !!webcamStream,
    toggleWebcam,
    listening,
    dictating: listening && !alwaysOn,
    busy: mode === "processing" || mode === "speaking" || mode === "transcribing",
    speaking: mode === "speaking",
    startListening,
    stopListening,
    finishDictation,
    cancelDictation,
    toggleAlwaysOn,
    runCommand,
    interrupt,
    draft,
    setDraft,
    sendDraft,
    // What is being dictated right now (box text + settled words + the live phrase).
    capturing: listening && !alwaysOn ? join(baseRef.current, heard, interim) : "",
    sendNow: sendDraft,
    clear: () => {
      setTurns([]);
      setNotice("");
      setDraft("");
    }
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}