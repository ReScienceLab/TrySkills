import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { ConvexErrorBoundary } from "@/components/convex-error-boundary";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  title: "tryskills.sh — Instantly try any agent skill",
  description:
    "Add 'try' before skills.sh and get a live agent session with any skill loaded. Zero install, zero config, runs on your own API keys.",
  openGraph: {
    title: "tryskills.sh",
    description: "One URL prefix to instantly try any agent skill.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1440,
        height: 950,
        alt: "TrySkills.sh — Add try to any skills.sh link and instantly try the skill",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "tryskills.sh",
    description: "One URL prefix to instantly try any agent skill.",
    images: ["/og.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>
          <ConvexErrorBoundary>
            <TooltipProvider>{children}</TooltipProvider>
          </ConvexErrorBoundary>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
