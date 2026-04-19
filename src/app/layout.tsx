import type { Metadata } from "next";
import { Geist, Geist_Mono, Bilbo } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bilbo = Bilbo({
  variable: "--font-bilbo",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "tryskills.sh — Instantly try any agent skill",
  description:
    "Add 'try' before skills.sh and get a live agent session with any skill loaded. Zero install, zero config, runs on your own API keys.",
  openGraph: {
    title: "tryskills.sh",
    description: "One URL prefix to instantly try any agent skill.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bilbo.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
