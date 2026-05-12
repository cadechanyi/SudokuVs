import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MultiplayerProvider } from "@/context/MultiplayerContext";
import { getPublicAppUrl } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicAppUrl()),
  title: "SudokuVs",
  description: "Single-player Sudoku and realtime WebSocket multiplayer races",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <MultiplayerProvider>{children}</MultiplayerProvider>
      </body>
    </html>
  );
}
