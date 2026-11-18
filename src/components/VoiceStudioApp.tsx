"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRealtimeVoice } from "@/hooks/useRealtimeVoice";
import {
  DEFAULT_VOICE_SETTINGS,
  VOICE_PERSONAS,
} from "@/lib/voicePrompts";
import { ReasoningEffort, VoiceSettings } from "@/types/voice";
import { VoiceOrb } from "@/components/VoiceOrb";
import { VoiceSettingsModal } from "@/components/VoiceSettingsModal";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  Ear,
  EyeOff,
  Hand,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PanelRightClose,
  PanelRightOpen,
  PhoneCall,
  PhoneOff,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  Volume2,
  VolumeX,
  Wand2,
  Zap,
} from "lucide-react";

const REASONING_LEVELS: Array<{
  id: ReasoningEffort;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    id: "none",
    label: "Directo",
    shortLabel: "Off",
    description: "Respuesta inmediata sin cadena de pensamiento",
  },
  {
    id: "low",
    label: "Rápido",
    shortLabel: "Bajo",
    description: "2 validaciones rápidas de intención y contexto",
  },
  {
    id: "medium",
    label: "Balanceado",
    shortLabel: "Medio",
    description: "3 pasos: intención, memoria de sala y deducción",
  },
  {
    id: "high",
    label: "Profundo",
    shortLabel: "Alto",
    description: "4+ fases analíticas profundas antes de responder",
  },
];

export function VoiceStudioApp() {
  const [settings, setSettings] = useState<VoiceSettings>(
    DEFAULT_VOICE_SETTINGS
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hasServerKey, setHasServerKey] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [newFactText, setNewFactText] = useState("");
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<
    Record<string, boolean>
  >({});
  const [activeSideTab, setActiveSideTab] = useState<
    "transcript" | "phonetics" | "context"
  >("transcript");

  const {
    state,
    isConnected,
    isMuted,
    activeEngine,
    transcript,
    corrections,
    facts,
    speakers,
    activeSpeaker,
    liveUserText,
    liveAssistantText,
    liveReasoningSteps,
    userVolume,
    assistantVolume,
    noiseFloor,
    lastFloorDecision,
    skippedTurnsCount,
    errorMessage,
    interruptionCount,
    latencyMs,
    connect,
    disconnect,
    toggleMute,
    interruptAssistant,
    sendTextTurn,
    speakText,
    clearHistory,
    addFact,
    removeFact,
  } = useRealtimeVoice(settings);

  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/realtime/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.hasServerKey) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript, liveUserText, liveAssistantText, liveReasoningSteps]);

  const currentPersona =
    VOICE_PERSONAS.find((p) => p.id === settings.personaId) ||
    VOICE_PERSONAS[0];

  const organicSimulations = [
    {
      label: "1. Carlos se presenta y consulta stack",
      spoken:
        "Hola Aura, soy Carlos. Estoy armando un proyecto con nejs, taylwind y weberretese conectado a chagpt.",
      badge: "Infiere nombre + corrige 4 términos",
    },
    {
      label: "2. Llega Laura y le habla a Carlos",
      spoken:
        "Oye Carlos, yo propongo que usemos kubernetis y posgres para la base de datos.",
      badge: "Detecta 2da persona + IA calla y toma nota",
    },
    {
      label: "3. Laura le pide opinión a la IA",
      spoken:
        "Oye Aura, ¿tú qué opinas de combinar lo que propuso Carlos con lo mío?",
      badge: "Invoca a la IA + conecta las posturas",
    },
  ];

  const handleOrbClick = () => {
    if (!isConnected) {
      connect();
      return;
    }
    if (state === "assistant_speaking") {
      interruptAssistant("Toque directo en el orbe");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    const text = manualInput;
    setManualInput("");
    await sendTextTurn(text, {
      reasoningEffort: settings.reasoningEffort,
      speakResponse: settings.speakChatResponses,
    });
  };

  const toggleReasoningExpand = (turnId: string) => {
    setExpandedReasoningIds((prev) => ({
      ...prev,
      [turnId]: !(prev[turnId] ?? true),
    }));
  };

  const handleAddFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFactText.trim()) return;
    addFact("acuerdo", newFactText);
    setNewFactText("");
  };

  return (
    <div className="h-screen max-h-screen bg-[#060913] text-slate-100 flex flex-col selection:bg-indigo-500/30 overflow-y-auto lg:overflow-hidden">
      {/* Fondo ambiental */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 w-[36rem] h-[36rem] rounded-full bg-indigo-600/10 blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[32rem] h-[32rem] rounded-full bg-violet-600/10 blur-[140px]" />
      </div>

      {/* Barra superior */}
      <header className="relative z-10 shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 sm:px-8 py-3.5 border-b border-slate-800/70 bg-slate-950/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 shadow-lg shadow-indigo-500/20">
            <Volume2 className="w-5 h-5 text-white" />
            {isConnected && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">
                Aura Voice Live
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                Filtro DSP Anti-Ruido Activo
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {activeEngine === "openai-realtime"
                  ? "OpenAI Realtime GA"
                  : "Modo Sala Híbrido"}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Noise Gate adaptativo · Inferencia orgánica de interlocutores · Interrupción natural
            </p>
          </div>
        </div>

        {/* Métricas en tiempo real y botones de acción */}
        <div className="flex items-center gap-2.5">
          <div className="hidden xl:flex items-center gap-3 px-3.5 py-1.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 text-xs">
            <span
              className="flex items-center gap-1.5 text-slate-300"
              title="Latencia de respuesta"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              {latencyMs ? `${latencyMs} ms` : "~240 ms"}
            </span>
            <span className="text-slate-700">|</span>
            <span
              className="flex items-center gap-1.5 text-slate-300"
              title="Piso de ruido ambiente medido en la sala"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Ruido base: {Math.round(noiseFloor * 100)}%
            </span>
            <span className="text-slate-700">|</span>
            <span
              className="flex items-center gap-1.5 text-slate-300"
              title="Turnos laterales donde la IA guardó silencio"
            >
              <EyeOff className="w-3.5 h-3.5 text-sky-400" />
              {skippedTurnsCount} cedidos
            </span>
            <span className="text-slate-700">|</span>
            <span
              className="flex items-center gap-1.5 text-slate-300"
              title="Interrupciones humanas a la IA (Barge-In)"
            >
              <Hand className="w-3.5 h-3.5 text-rose-400" />
              {interruptionCount} barge-in
            </span>
            <span className="text-slate-700">|</span>
            <span
              className="flex items-center gap-1.5 text-slate-300"
              title="Palabras mal pronunciadas corregidas por contexto"
            >
              <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
              {corrections.length} fonéticas
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              isSidebarOpen
                ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/30"
                : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300"
            }`}
            title={
              isSidebarOpen
                ? "Ocultar panel lateral (Agrandar orbe de voz)"
                : "Mostrar panel de diálogo y memoria"
            }
          >
            {isSidebarOpen ? (
              <PanelRightClose className="w-4 h-4 text-indigo-400" />
            ) : (
              <PanelRightOpen className="w-4 h-4 text-indigo-400" />
            )}
            <span className="hidden sm:inline">
              {isSidebarOpen ? "Ocultar panel" : "Ver diálogo"}
            </span>
            {transcript.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-indigo-500/30 text-indigo-200">
                {transcript.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs sm:text-sm font-medium text-slate-200 transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-indigo-400" />
            <span>Filtro & Ajustes</span>
          </button>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className={`relative z-10 flex-1 min-h-0 w-full mx-auto p-3 sm:p-5 lg:p-6 gap-6 transition-all duration-300 ${
        isSidebarOpen
          ? "grid grid-cols-1 lg:grid-cols-12 max-w-[1560px] h-full"
          : "flex flex-col items-center justify-center max-w-4xl h-full"
      }`}>
        {/* Columna Izquierda: Orbe y Controles */}
        <section className={`flex flex-col justify-between rounded-3xl bg-slate-950/65 border border-slate-800/80 backdrop-blur-xl p-5 sm:p-7 shadow-2xl relative overflow-hidden transition-all duration-300 ${
          isSidebarOpen
            ? "lg:col-span-7 xl:col-span-8 h-full min-h-0"
            : "w-full h-full min-h-0"
        }`}>
          {/* Barra superior de presencia orgánica: chips de personas detectadas en vivo */}
          <div className="space-y-3 z-10">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  Presencia en sala:
                </span>
                {speakers.length === 0 ? (
                  <span className="text-xs text-slate-500 italic">
                    Escuchando en modo adaptativo (sin pre-configuración)...
                  </span>
                ) : (
                  speakers.map((spk) => (
                    <span
                      key={spk.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                        activeSpeaker?.id === spk.id
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-200 animate-pulse"
                          : "bg-slate-900 border-slate-800 text-slate-300"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {spk.name}
                    </span>
                  ))
                )}
              </div>

              {/* Selector de personalidad IA */}
              <div className="flex items-center gap-1">
                {VOICE_PERSONAS.map((p) => {
                  const isSelected = settings.personaId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          personaId: p.id,
                          voice: p.voice,
                        }))
                      }
                      className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-violet-600/25 text-violet-200 border border-violet-500/50"
                          : "bg-slate-900/60 text-slate-400 border border-slate-800/70 hover:text-slate-200"
                      }`}
                    >
                      {p.name.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Aviso de estado / modo híbrido */}
          {errorMessage && (
            <div className="mt-2.5 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-3">
              <span>{errorMessage}</span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="shrink-0 underline font-medium hover:text-white cursor-pointer"
              >
                Configurar Key
              </button>
            </div>
          )}

          {/* Decisión de Floor Control en vivo */}
          {lastFloorDecision && (
            <div className="mt-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    state === "passive_listening"
                      ? "bg-sky-400 animate-ping"
                      : "bg-emerald-400"
                  }`}
                />
                <span>
                  <strong className="text-white">Smart Floor:</strong>{" "}
                  {lastFloorDecision}
                </span>
              </div>
            </div>
          )}

          {/* Centro: Orbe Reactivo + Subtítulos */}
          <div className="my-auto py-4 flex flex-col items-center justify-center">
            <VoiceOrb
              state={state}
              userVolume={userVolume}
              assistantVolume={assistantVolume}
              onOrbClick={handleOrbClick}
              activeSpeakerName={activeSpeaker?.name}
              isExpanded={!isSidebarOpen}
            />

            <div className="mt-4 w-full max-w-xl min-h-[4.75rem] flex flex-col items-center justify-center text-center px-4">
              {liveUserText ? (
                <div className="space-y-1 animate-fade-in">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400">
                    Hablando en vivo ({activeSpeaker?.name || "Voz"})
                  </span>
                  <p className="text-base sm:text-lg font-medium text-emerald-100">
                    &ldquo;{liveUserText}&rdquo;
                  </p>
                </div>
              ) : liveAssistantText ? (
                <div className="space-y-1 animate-fade-in">
                  <span className="text-[11px] uppercase tracking-wider font-semibold text-violet-400">
                    {currentPersona.name.split(" ")[0]} hablando
                  </span>
                  <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
                    {liveAssistantText}
                  </p>
                </div>
              ) : transcript.length > 0 ? (
                <div className="space-y-1 opacity-85">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500">
                    Última intervención (
                    {transcript[transcript.length - 1].role === "user"
                      ? transcript[transcript.length - 1].speakerName || "Interlocutor"
                      : currentPersona.name.split(" ")[0]}
                    )
                  </span>
                  <p className="text-sm sm:text-base text-slate-300 line-clamp-2">
                    {transcript[transcript.length - 1].text}
                  </p>
                </div>
              ) : (
                <p className="text-xs sm:text-sm text-slate-400 max-w-lg leading-relaxed">
                  Habla con naturalidad. La IA aísla tu voz del ruido ambiental con la compuerta vocal, deduce palabras trabadas por contexto e infiere orgánicamente si estás solo o conversando con más personas.
                </p>
              )}
            </div>
          </div>

          {/* Controles de llamada + Simulador de pruebas orgánicas */}
          <div className="space-y-3.5 z-10">
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isConnected ? (
                <button
                  type="button"
                  onClick={connect}
                  disabled={state === "connecting"}
                  className="flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>
                    {state === "connecting"
                      ? "Conectando..."
                      : "Iniciar Conversación de Voz"}
                  </span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                      isMuted
                        ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
                        : "bg-slate-900/90 border-slate-700 text-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {isMuted ? (
                      <>
                        <MicOff className="w-4 h-4 text-rose-400" />
                        <span>Micrófono silenciado</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-emerald-400" />
                        <span>Micrófono activo (DSP filtrado)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      interruptAssistant("Interrupción manual")
                    }
                    disabled={state !== "assistant_speaking"}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                      state === "assistant_speaking"
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-200 hover:bg-amber-500/30 animate-pulse"
                        : "bg-slate-900/50 border-slate-800/80 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Hand className="w-4 h-4" />
                    <span>Interrumpir</span>
                  </button>

                  <button
                    type="button"
                    onClick={disconnect}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-rose-600/25 transition-all cursor-pointer"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>Finalizar</span>
                  </button>
                </>
              )}
            </div>

            {/* Simulador rápido de prueba sin pestañas */}
            <div className="pt-3 border-t border-slate-800/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Simular descubrimiento orgánico de personas (haz clic en orden 1 → 2 → 3):
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {organicSimulations.map((sim, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => sendTextTurn(sim.spoken)}
                    className="text-left p-2.5 rounded-2xl bg-slate-900/75 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 transition-all group cursor-pointer"
                  >
                    <div className="text-[11px] font-semibold text-indigo-300 group-hover:text-indigo-200">
                      {sim.label}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      &ldquo;{sim.spoken}&rdquo;
                    </div>
                    <div className="text-[10px] text-emerald-400/90 mt-1">
                      {sim.badge}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Columna Derecha: Diálogo, Fonética y Contexto (Sidebar colapsable) */}
        {isSidebarOpen && (
          <section className="lg:col-span-5 xl:col-span-4 flex flex-col rounded-3xl bg-slate-950/65 border border-slate-800/80 backdrop-blur-xl shadow-2xl overflow-hidden h-full min-h-0 animate-fade-in">
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-slate-800/80 bg-slate-900/40 shrink-0">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setActiveSideTab("transcript")}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
                    activeSideTab === "transcript"
                      ? "border-indigo-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Diálogo ({transcript.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSideTab("phonetics")}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
                    activeSideTab === "phonetics"
                      ? "border-emerald-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Ear className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Fonética ({corrections.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSideTab("context")}
                  className={`flex items-center gap-1.5 px-3 py-2 border-b-2 text-xs font-semibold transition-all cursor-pointer ${
                    activeSideTab === "context"
                      ? "border-violet-500 text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Brain className="w-3.5 h-3.5 text-violet-400" />
                  <span>Memoria ({facts.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-1">
                {transcript.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Limpiar transcripción"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Ocultar panel lateral (agrandar orbe de voz)"
                >
                  <PanelRightClose className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {activeSideTab === "transcript" && (
              <>
                {transcript.length === 0 && state !== "thinking" ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-700" />
                    <p className="text-sm font-medium text-slate-300">
                      Chat Híbrido con Razonamiento & Voz
                    </p>
                    <p className="text-xs max-w-xs">
                      Escribe abajo o habla por micrófono. Puedes elegir el nivel de razonamiento (Directo, Bajo, Medio, Profundo) y ver paso a paso cómo piensa la IA antes de responder.
                    </p>
                  </div>
                ) : (
                  transcript.map((turn) => {
                    const isUser = turn.role === "user";
                    const hasReasoning =
                      !isUser &&
                      turn.reasoningSteps &&
                      turn.reasoningSteps.length > 0;
                    const isReasoningOpen =
                      expandedReasoningIds[turn.id] ?? true;

                    return (
                      <div
                        key={turn.id}
                        className={`flex flex-col ${
                          isUser ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[92%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                            !isUser
                              ? "bg-slate-900/90 border border-violet-500/30 text-slate-200 rounded-bl-sm"
                              : "bg-indigo-600/20 border border-indigo-500/40 text-slate-100 rounded-br-sm"
                          }`}
                        >
                          {isUser && turn.speakerName && (
                            <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px]">
                              <span className="font-bold uppercase tracking-wider text-emerald-300">
                                {turn.speakerName}
                              </span>
                              <div className="flex items-center gap-1.5">
                                {turn.reasoningEffort &&
                                  turn.reasoningEffort !== "none" && (
                                    <span className="px-1.5 py-0.2 rounded bg-violet-500/20 border border-violet-500/30 text-violet-300 font-medium">
                                      Razonamiento: {turn.reasoningEffort}
                                    </span>
                                  )}
                                <span className="text-slate-400">
                                  {turn.addressedTo === "peer_human"
                                    ? "→ Hablando con otra persona"
                                    : turn.addressedTo === "assistant"
                                    ? `→ A ${currentPersona.name.split(" ")[0]}`
                                    : "→ Abierto a la sala"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Bloque desplegable de Cadena de Razonamiento (Chain-of-Thought) */}
                          {hasReasoning && (
                            <div className="mb-2.5 rounded-xl bg-slate-950/85 border border-violet-500/25 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleReasoningExpand(turn.id)}
                                className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left text-[11px] font-medium text-violet-300 hover:bg-violet-500/10 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Cpu className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                                  <span className="truncate">
                                    {turn.reasoningSummary ||
                                      `Proceso de razonamiento (${turn.reasoningSteps?.length} pasos)`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {turn.reasoningDurationMs && (
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      {turn.reasoningDurationMs}ms
                                    </span>
                                  )}
                                  {isReasoningOpen ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </div>
                              </button>

                              {isReasoningOpen && (
                                <div className="px-3 pb-2.5 pt-1 border-t border-slate-800/80 space-y-2">
                                  {turn.reasoningSteps?.map((step, idx) => (
                                    <div
                                      key={step.id || idx}
                                      className="relative pl-3 border-l-2 border-violet-500/40 text-[11px] space-y-0.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-semibold text-violet-200">
                                          {idx + 1}. {step.title}
                                        </span>
                                        {step.durationMs && (
                                          <span className="text-[9px] text-slate-500">
                                            +{step.durationMs}ms
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-slate-400 leading-snug">
                                        {step.detail}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {isUser &&
                            turn.rawSpokenText &&
                            turn.rawSpokenText !== turn.text && (
                              <div className="mb-2 pb-1.5 border-b border-white/10 flex flex-col gap-0.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                  <Wand2 className="w-3 h-3" />
                                  Pronunciación corregida por contexto
                                </span>
                                <span className="text-[11px] text-slate-400 line-through">
                                  Sonó: &ldquo;{turn.rawSpokenText}&rdquo;
                                </span>
                              </div>
                            )}

                          <p>{turn.text}</p>

                          {turn.corrections && turn.corrections.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {turn.corrections.map((c) => (
                                <span
                                  key={c.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300"
                                >
                                  <span className="line-through opacity-75">
                                    {c.heard}
                                  </span>
                                  <span>→</span>
                                  <strong>{c.intended}</strong>
                                </span>
                              ))}
                            </div>
                          )}

                          {turn.skippedByFloorControl && (
                            <div className="mt-2 px-2.5 py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-[10px] text-sky-200 flex items-center gap-1.5">
                              <EyeOff className="w-3 h-3 text-sky-400 shrink-0" />
                              <span>
                                {currentPersona.name.split(" ")[0]} escuchó y anotó en silencio sin interrumpir
                              </span>
                            </div>
                          )}

                          {turn.wasInterrupted && (
                            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-amber-400 font-medium">
                              <Hand className="w-3 h-3" />
                              <span>Interrumpido naturalmente</span>
                            </div>
                          )}

                          {/* Botón en respuestas de la IA para escuchar en voz alta bajo demanda */}
                          {!isUser && (
                            <div className="mt-2 pt-1.5 border-t border-slate-800/70 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                              <span className="flex items-center gap-1">
                                {turn.spokenAloud ? (
                                  <>
                                    <Volume2 className="w-3 h-3 text-indigo-400" />
                                    <span>Respuesta hablada + texto</span>
                                  </>
                                ) : (
                                  <>
                                    <VolumeX className="w-3 h-3 text-slate-500" />
                                    <span>Solo texto (voz silenciada)</span>
                                  </>
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => speakText(turn.text)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 transition-colors cursor-pointer"
                                title="Reproducir esta respuesta con voz"
                              >
                                <Volume2 className="w-3 h-3" />
                                <span>Escuchar</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <span className="mt-1 px-1 text-[10px] text-slate-500">
                          {isUser
                            ? turn.speakerName || "Interlocutor"
                            : currentPersona.name.split(" ")[0]}
                          {turn.latencyMs ? ` · ${turn.latencyMs}ms` : ""}
                        </span>
                      </div>
                    );
                  })
                )}

                {/* Indicador de razonamiento en vivo mientras la IA está pensando */}
                {state === "thinking" && (
                  <div className="flex flex-col items-start animate-fade-in">
                    <div className="w-full max-w-[92%] rounded-2xl px-4 py-3 bg-slate-900/95 border border-violet-500/40 text-xs space-y-2.5 shadow-lg shadow-violet-950/30">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-violet-300 font-semibold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                          <span>
                            {currentPersona.name.split(" ")[0]} está razonando (
                            {
                              REASONING_LEVELS.find(
                                (r) => r.id === settings.reasoningEffort
                              )?.label
                            }
                            )...
                          </span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-200 border border-violet-500/30">
                          Chain-of-Thought
                        </span>
                      </div>

                      {liveReasoningSteps.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-800">
                          {liveReasoningSteps.map((step, idx) => (
                            <div
                              key={step.id || idx}
                              className="pl-2.5 border-l-2 border-violet-400/60 text-[11px] space-y-0.5 animate-fade-in"
                            >
                              <div className="font-medium text-violet-200">
                                {idx + 1}. {step.title}
                              </div>
                              <div className="text-slate-400">
                                {step.detail}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div ref={transcriptEndRef} />
              </>
            )}

            {activeSideTab === "phonetics" && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Corrección Fonética Contextual Activa
                  </div>
                  <p className="text-emerald-200/80 text-[11px]">
                    Deduce palabras aproximadas o términos en spanglish según el tema de la charla.
                  </p>
                </div>

                {corrections.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    Aún no se han registrado correcciones fonéticas en esta sesión.
                  </div>
                ) : (
                  corrections.map((corr) => (
                    <div
                      key={corr.id}
                      className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs">
                          {corr.speakerName && (
                            <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium text-[10px]">
                              {corr.speakerName}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 line-through">
                            &ldquo;{corr.heard}&rdquo;
                          </span>
                          <span className="text-slate-500">→</span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold">
                            {corr.intended}
                          </span>
                        </div>
                      </div>
                      {corr.explanation && (
                        <p className="text-[11px] text-slate-400">
                          {corr.explanation}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeSideTab === "context" && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-violet-500/10 border border-violet-500/25 text-xs text-violet-200 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-violet-400" />
                    Memoria Contextual Activa
                  </div>
                  <p className="text-violet-200/80 text-[11px]">
                    Registra nombres, posturas y acuerdos reconocidos durante la conversación.
                  </p>
                </div>

                <form onSubmit={handleAddFact} className="flex gap-2">
                  <input
                    type="text"
                    value={newFactText}
                    onChange={(e) => setNewFactText(e.target.value)}
                    placeholder="Añadir nota a la memoria..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Guardar
                  </button>
                </form>

                <div className="space-y-2">
                  {facts.map((fact) => (
                    <div
                      key={fact.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-violet-400">
                            {fact.category}
                          </span>
                          {fact.speakerName && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                              {fact.speakerName}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-200">{fact.summary}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFact(fact.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barra integrada de Razonamiento, Controles de Voz y Entrada de Texto */}
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/60 space-y-2.5 shrink-0">
            {/* Selector de Nivel de Razonamiento + Controles rápidos de Voz */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800/80">
                <span
                  className="flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-violet-300"
                  title="Nivel de razonamiento (Chain-of-Thought) antes de responder"
                >
                  <Cpu className="w-3 h-3 text-violet-400" />
                  <span className="hidden sm:inline">Razonamiento:</span>
                </span>
                {REASONING_LEVELS.map((lvl) => {
                  const active = settings.reasoningEffort === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          reasoningEffort: lvl.id,
                        }))
                      }
                      title={`${lvl.label}: ${lvl.description}`}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
                        active
                          ? "bg-violet-600 text-white shadow-sm shadow-violet-600/40"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}
                    >
                      {lvl.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Controles de Voz integrados en el chat */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      speakChatResponses: !prev.speakChatResponses,
                    }))
                  }
                  title={
                    settings.speakChatResponses
                      ? "Voz de respuesta activa: la IA leerá en voz alta sus respuestas"
                      : "Modo silencioso: la IA solo responderá por escrito en el chat"
                  }
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                    settings.speakChatResponses
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {settings.speakChatResponses ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Voz IA On</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                      <span>Solo Texto</span>
                    </>
                  )}
                </button>

                {!isConnected ? (
                  <button
                    type="button"
                    onClick={connect}
                    title="Activar micrófono e iniciar sesión de voz en vivo"
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-600/20 text-emerald-200 hover:bg-emerald-600/30 text-[10px] font-semibold transition-all cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Activar Voz</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={toggleMute}
                      title={
                        isMuted
                          ? "Reactivar micrófono (quitar mute)"
                          : "Silenciar micrófono (mutear audio y DSP)"
                      }
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-semibold transition-all cursor-pointer ${
                        isMuted
                          ? "bg-rose-500/20 border-rose-500/40 text-rose-200 hover:bg-rose-500/30"
                          : "bg-emerald-500/20 border-emerald-500/50 text-emerald-200 hover:bg-emerald-500/30 animate-pulse"
                      }`}
                    >
                      {isMuted ? (
                        <>
                          <MicOff className="w-3.5 h-3.5 text-rose-400" />
                          <span>Mic Off</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Mic Activo</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={disconnect}
                      title="Finalizar sesión de voz y desconectar llamada"
                      className="flex items-center gap-1 px-2 py-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 text-[10px] font-semibold transition-all cursor-pointer"
                    >
                      <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden sm:inline">Desconectar</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Formulario de envío de mensaje con soporte de razonamiento */}
            <form
              onSubmit={handleManualSubmit}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder={`Escribe tu mensaje (${
                  REASONING_LEVELS.find((r) => r.id === settings.reasoningEffort)
                    ?.label || "Balanceado"
                })...`}
                className="flex-1 px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
              />
              <button
                type="submit"
                disabled={state === "thinking" || !manualInput.trim()}
                className="p-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-40 text-white transition-all cursor-pointer shrink-0"
                title="Enviar mensaje y ejecutar razonamiento"
              >
                {state === "thinking" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
          </div>
        </section>
      )}
    </main>

      <VoiceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        hasServerKey={hasServerKey}
      />
    </div>
  );
}
