import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "600", "700", "900"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: "Research Room",
  description: "Tres modelos, un documento de investigación.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={archivo.variable}>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
