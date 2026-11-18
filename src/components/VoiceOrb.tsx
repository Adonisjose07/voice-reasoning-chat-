"use client";

import React, { useEffect, useRef } from "react";
import { ConversationState } from "@/types/voice";

interface VoiceOrbProps {
  state: ConversationState;
  userVolume: number;
  assistantVolume: number;
  onOrbClick: () => void;
  activeSpeakerName?: string;
  isExpanded?: boolean;
}

export function VoiceOrb({
  state,
  userVolume,
  assistantVolume,
  onOrbClick,
  activeSpeakerName,
  isExpanded = false,
}: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);
  const smoothVolRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.27;

      const targetVol =
        state === "assistant_speaking"
          ? assistantVolume * 1.35
          : state === "user_speaking"
          ? userVolume * 1.45
          : state === "thinking"
          ? 0.32
          : state === "passive_listening"
          ? 0.12
          : state === "listening"
          ? Math.max(0.08, userVolume * 0.6)
          : 0.04;

      smoothVolRef.current += (targetVol - smoothVolRef.current) * 0.16;
      const vol = smoothVolRef.current;

      const speed =
        state === "assistant_speaking"
          ? 0.055 + vol * 0.06
          : state === "user_speaking"
          ? 0.06 + vol * 0.07
          : state === "thinking"
          ? 0.085
          : state === "passive_listening"
          ? 0.032
          : state === "interrupted"
          ? 0.14
          : 0.022;

      phaseRef.current += speed;
      const t = phaseRef.current;

      let primaryColor = "rgba(99, 102, 241, 0.85)"; // Indigo
      let secondaryColor = "rgba(56, 189, 248, 0.65)"; // Sky
      let glowColor = "rgba(99, 102, 241, 0.28)";

      if (state === "user_speaking") {
        primaryColor = "rgba(16, 185, 129, 0.92)"; // Emerald
        secondaryColor = "rgba(45, 212, 191, 0.72)"; // Teal
        glowColor = "rgba(16, 185, 129, 0.35)";
      } else if (state === "assistant_speaking") {
        primaryColor = "rgba(139, 92, 246, 0.94)"; // Violet
        secondaryColor = "rgba(56, 189, 248, 0.82)"; // Cyan
        glowColor = "rgba(139, 92, 246, 0.42)";
      } else if (state === "passive_listening") {
        primaryColor = "rgba(14, 165, 233, 0.85)"; // Sky / Cyan (escucha discreta entre humanos)
        secondaryColor = "rgba(99, 102, 241, 0.65)";
        glowColor = "rgba(14, 165, 233, 0.28)";
      } else if (state === "thinking") {
        primaryColor = "rgba(245, 158, 11, 0.9)"; // Amber
        secondaryColor = "rgba(168, 85, 247, 0.78)"; // Purple
        glowColor = "rgba(245, 158, 11, 0.3)";
      } else if (state === "interrupted") {
        primaryColor = "rgba(244, 63, 94, 0.95)"; // Rose
        secondaryColor = "rgba(251, 146, 60, 0.8)"; // Orange
        glowColor = "rgba(244, 63, 94, 0.45)";
      } else if (state === "idle") {
        primaryColor = "rgba(100, 116, 139, 0.65)";
        secondaryColor = "rgba(71, 85, 105, 0.45)";
        glowColor = "rgba(100, 116, 139, 0.15)";
      }

      const outerGlowRadius = baseRadius * (1.55 + vol * 0.65);
      const outerGrad = ctx.createRadialGradient(
        cx,
        cy,
        baseRadius * 0.2,
        cx,
        cy,
        outerGlowRadius
      );
      outerGrad.addColorStop(0, glowColor);
      outerGrad.addColorStop(0.6, glowColor.replace(/[\d.]+\)$/, "0.1)"));
      outerGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, outerGlowRadius, 0, Math.PI * 2);
      ctx.fill();

      const drawOrganicLayer = (
        radiusScale: number,
        amplitude: number,
        freq1: number,
        freq2: number,
        phaseShift: number,
        fillStyle: CanvasGradient | string
      ) => {
        ctx.beginPath();
        const points = 96;
        for (let i = 0; i <= points; i++) {
          const angle = (i / points) * Math.PI * 2;
          const wave =
            Math.sin(angle * freq1 + t + phaseShift) * amplitude +
            Math.cos(angle * freq2 - t * 1.3 + phaseShift) * (amplitude * 0.65);
          const r = baseRadius * radiusScale + wave;
          const x = cx + Math.cos(angle) * r;
          const y = cy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
      };

      const amp = baseRadius * (0.045 + vol * 0.28);

      drawOrganicLayer(
        1.08 + vol * 0.18,
        amp * 1.25,
        3,
        5,
        1.4,
        secondaryColor.replace(/[\d.]+\)$/, "0.28)")
      );

      drawOrganicLayer(
        1.02 + vol * 0.1,
        amp * 0.95,
        4,
        6,
        0.6,
        primaryColor.replace(/[\d.]+\)$/, "0.42)")
      );

      const coreGrad = ctx.createRadialGradient(
        cx - baseRadius * 0.25 * Math.cos(t * 0.5),
        cy - baseRadius * 0.25 * Math.sin(t * 0.5),
        baseRadius * 0.08,
        cx,
        cy,
        baseRadius * (1.1 + vol * 0.15)
      );
      coreGrad.addColorStop(0, "rgba(255, 255, 255, 0.92)");
      coreGrad.addColorStop(0.28, secondaryColor);
      coreGrad.addColorStop(0.75, primaryColor);
      coreGrad.addColorStop(1, "rgba(15, 23, 42, 0.9)");

      drawOrganicLayer(0.95 + vol * 0.08, amp * 0.65, 3, 4, 0, coreGrad);

      if (state !== "idle") {
        ctx.strokeStyle = secondaryColor.replace(/[\d.]+\)$/, "0.38)");
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        const ringRadius =
          baseRadius *
          (1.22 + ((Math.sin(t * 0.8) + 1) / 2) * 0.15 + vol * 0.2);
        ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [state, userVolume, assistantVolume]);

  const statusLabel: Record<ConversationState, string> = {
    idle: "Toca el orbe para iniciar la mesa de voz",
    connecting: "Conectando canal de voz de baja latencia...",
    listening: "Escuchando a la mesa... hablen con naturalidad",
    user_speaking: activeSpeakerName
      ? `Escuchando a ${activeSpeakerName} en vivo...`
      : "Te escucho en vivo...",
    thinking: "Conectando ideas de la mesa...",
    assistant_speaking:
      "Hablando · Cualquiera puede interrumpirme hablando o tocando aquí",
    passive_listening:
      "Escucha pasiva: cediendo el turno mientras ustedes conversan entre sí",
    interrupted: "¡Los escucho! Dime...",
    error: "Reintentar conexión de voz",
  };

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <button
        type="button"
        onClick={onOrbClick}
        aria-label={statusLabel[state]}
        className={`group relative flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 transition-all duration-300 active:scale-95 cursor-pointer ${
          isExpanded
            ? "w-72 h-72 sm:w-88 sm:h-88 md:w-[380px] md:h-[380px]"
            : "w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="w-full h-full pointer-events-none"
        />
        <span className="sr-only">{statusLabel[state]}</span>
      </button>

      <div className="mt-1.5 flex flex-col items-center gap-1.5 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/90 backdrop-blur-md shadow-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              state === "user_speaking"
                ? "bg-emerald-400 animate-ping"
                : state === "assistant_speaking"
                ? "bg-violet-400 animate-pulse"
                : state === "passive_listening"
                ? "bg-sky-400 animate-pulse"
                : state === "listening"
                ? "bg-sky-400"
                : state === "thinking"
                ? "bg-amber-400 animate-bounce"
                : state === "interrupted"
                ? "bg-rose-400 animate-ping"
                : "bg-slate-500"
            }`}
          />
          <span className="text-xs sm:text-sm font-medium text-slate-200 tracking-wide">
            {statusLabel[state]}
          </span>
        </div>
      </div>
    </div>
  );
}
