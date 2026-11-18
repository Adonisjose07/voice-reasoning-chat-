import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aura Voice Live · Chat en Modo Voz Nativo con IA",
  description:
    "Conversación de voz en tiempo real con latencia ultra baja (OpenAI Realtime WebRTC), interrupción natural (barge-in), memoria contextual y corrección fonética inteligente.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
