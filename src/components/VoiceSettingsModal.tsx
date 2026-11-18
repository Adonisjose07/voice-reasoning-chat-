"use client";

import React, { useState } from "react";
import {
  CustomDictionaryEntry,
  NoiseSuppressionLevel,
  OpenAIVoice,
  VadEagerness,
  VadMode,
  VoiceSettings,
} from "@/types/voice";
import { VOICE_PERSONAS } from "@/lib/voicePrompts";
import {
  KeyRound,
  Plus,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react";

interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onUpdateSettings: (next: VoiceSettings) => void;
  hasServerKey: boolean;
}

const AVAILABLE_VOICES: Array<{
  id: OpenAIVoice;
  label: string;
  desc: string;
}> = [
  { id: "coral", label: "Coral", desc: "Cálida, expresiva y muy humana" },
  { id: "ash", label: "Ash", desc: "Conversacional, clara y cercana" },
  { id: "sage", label: "Sage", desc: "Serena, empática y reflexiva" },
  { id: "verse", label: "Verse", desc: "Dinámica, con inflexión natural" },
  { id: "ballad", label: "Ballad", desc: "Suave, melódica y pausada" },
  { id: "alloy", label: "Alloy", desc: "Equilibrada y versátil" },
  { id: "echo", label: "Echo", desc: "Firme y articulada" },
  { id: "shimmer", label: "Shimmer", desc: "Brillante y energética" },
];

export function VoiceSettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  hasServerKey,
}: VoiceSettingsModalProps) {
  const [newMispronounced, setNewMispronounced] = useState("");
  const [newCanonical, setNewCanonical] = useState("");
  const [newHint, setNewHint] = useState("");

  if (!isOpen) return null;

  const handleAddDictionaryEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMispronounced.trim() || !newCanonical.trim()) return;

    const entry: CustomDictionaryEntry = {
      id: `dict-user-${Date.now()}`,
      mispronounced: newMispronounced.trim(),
      canonical: newCanonical.trim(),
      contextHint: newHint.trim() || undefined,
    };

    onUpdateSettings({
      ...settings,
      customDictionary: [entry, ...settings.customDictionary],
    });
    setNewMispronounced("");
    setNewCanonical("");
    setNewHint("");
  };

  const handleRemoveDictionaryEntry = (id: string) => {
    onUpdateSettings({
      ...settings,
      customDictionary: settings.customDictionary.filter((d) => d.id !== id),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl text-slate-100 p-6 sm:p-8 space-y-6">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Ajustes de Voz & Sensibilidad Acústica
              </h2>
              <p className="text-xs text-slate-400">
                Filtro DSP Anti-Ruido · Inferencia de Interlocutores · OpenAI Realtime GA
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sección Crítica: Filtrado de Ruido y Sensibilidad del Micrófono */}
        <div className="space-y-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-semibold text-white">
                Cadena DSP Anti-Ruido de Fondo & Compuerta Vocal
              </h3>
              <p className="text-xs text-slate-400">
                Evita que ventiladores, tráfico o ruidos ambientales activen el micrófono
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1">
                Modo de Supresión de Ruido
              </label>
              <select
                value={settings.noiseSuppression}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    noiseSuppression: e.target.value as NoiseSuppressionLevel,
                  })
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white"
              >
                <option value="aggressive_far_field">
                  Far-Field Agresivo (Recomendado para micrófono con ruido de fondo)
                </option>
                <option value="balanced">
                  Equilibrado (Habitación con ruido moderado)
                </option>
                <option value="studio_sensitive">
                  Estudio (Ambiente silencioso)
                </option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 font-medium mb-1">
                <span>Sensibilidad de la Compuerta Vocal (Noise Gate)</span>
                <span className="text-indigo-400">
                  {Math.round(settings.noiseGateThreshold * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.04}
                max={0.28}
                step={0.02}
                value={settings.noiseGateThreshold}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    noiseGateThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-indigo-500 cursor-pointer"
              />
              <span className="text-[10px] text-slate-400">
                Valores altos (15-25%) bloquean más ruido; valores bajos son más sensibles a susurros.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/60">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Umbral de Detección VAD</span>
                <span className="text-indigo-400">{settings.vadThreshold}</span>
              </div>
              <input
                type="range"
                min={0.4}
                max={0.85}
                step={0.02}
                value={settings.vadThreshold}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    vadThreshold: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Silencio de fin de frase</span>
                <span className="text-indigo-400">
                  {settings.silenceDurationMs} ms
                </span>
              </div>
              <input
                type="range"
                min={300}
                max={1000}
                step={50}
                value={settings.silenceDurationMs}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    silenceDurationMs: parseInt(e.target.value, 10),
                  })
                }
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Motor y API Key */}
        <div className="space-y-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 p-4">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Zap className="w-4 h-4 text-amber-400" />
              Motor de Voz Activo
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    engineMode: "openai-realtime",
                  })
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  settings.engineMode === "openai-realtime"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                OpenAI Realtime (WebRTC)
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    engineMode: "browser-native",
                  })
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  settings.engineMode === "browser-native"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                Modo Navegador Híbrido
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                OpenAI API Key (para WebRTC voz-a-voz nativo)
              </span>
              {hasServerKey && (
                <span className="text-emerald-400 font-medium">
                  ✓ Configurada en servidor (.env)
                </span>
              )}
            </label>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) =>
                onUpdateSettings({ ...settings, apiKey: e.target.value })
              }
              placeholder={
                hasServerKey
                  ? "Usando OPENAI_API_KEY del servidor (o ingresa otra aquí)..."
                  : "sk-proj-... (Opcional: funciona en Modo Híbrido mientras consigues tu Key)"
              }
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Personalidad y Timbre */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Personalidad Conversacional
            </label>
            <div className="space-y-2">
              {VOICE_PERSONAS.map((persona) => {
                const active = settings.personaId === persona.id;
                return (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        personaId: persona.id,
                        voice: persona.voice,
                      })
                    }
                    className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer ${
                      active
                        ? "bg-indigo-500/15 border-indigo-500/50 text-white"
                        : "bg-slate-950/50 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{persona.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        Voz: {persona.voice}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {persona.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
              Timbre de Voz Neural
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_VOICES.map((v) => {
                const active = settings.voice === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, voice: v.id })
                    }
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      active
                        ? "bg-violet-500/20 border-violet-500/60 text-white"
                        : "bg-slate-950/50 border-slate-800/80 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-semibold">{v.label}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-1">
                      {v.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Diccionario Fonético */}
        <div className="space-y-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="text-sm font-medium text-white">
                  Diccionario Fonético Personalizado
                </h3>
                <p className="text-xs text-slate-400">
                  Términos técnicos o nombres que suelan pronunciarse de forma aproximada
                </p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.phoneticCorrectionEnabled}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    phoneticCorrectionEnabled: e.target.checked,
                  })
                }
                className="rounded border-slate-700 bg-slate-900 text-indigo-500"
              />
              <span className="text-xs text-slate-300">Autocorrección activa</span>
            </label>
          </div>

          <form
            onSubmit={handleAddDictionaryEntry}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2"
          >
            <input
              type="text"
              value={newMispronounced}
              onChange={(e) => setNewMispronounced(e.target.value)}
              placeholder="Cómo suena (ej. fastapay / fas api)"
              className="sm:col-span-4 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500"
            />
            <input
              type="text"
              value={newCanonical}
              onChange={(e) => setNewCanonical(e.target.value)}
              placeholder="Palabra real (ej. FastAPI)"
              className="sm:col-span-4 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500"
            />
            <input
              type="text"
              value={newHint}
              onChange={(e) => setNewHint(e.target.value)}
              placeholder="Contexto (ej. Python)"
              className="sm:col-span-3 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500"
            />
            <button
              type="submit"
              className="sm:col-span-1 flex items-center justify-center p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors cursor-pointer"
              title="Agregar regla fonética"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
            {settings.customDictionary.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-rose-300/90 line-through">
                    &ldquo;{item.mispronounced}&rdquo;
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="font-semibold text-emerald-400">
                    {item.canonical}
                  </span>
                  {item.contextHint && (
                    <span className="text-[11px] text-slate-500">
                      ({item.contextHint})
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveDictionaryEntry(item.id)}
                  className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            Guardar y volver
          </button>
        </div>
      </div>
    </div>
  );
}
