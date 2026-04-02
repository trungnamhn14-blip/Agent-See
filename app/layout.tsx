import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI / AI Agent — Chat",
  description: "Chatbot giải đáp về AI và AI Agent",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
