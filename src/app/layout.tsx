// 🚫 NÃO coloque "use client" aqui
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FluxoGenius",
  description: "Feito pelo Luiz Eduardo da Fatec Itapetininga. Gere seus diagramas de pseudocódigo, além de ele gera um código, te explicar e gerar uma possível problemática.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
