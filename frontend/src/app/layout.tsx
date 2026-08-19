import type { Metadata } from "next";

import { Providers } from "./providers";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "IntentFlow — natural language DeFi on BOT Chain",
  description:
    "Type what you want in plain English. IntentFlow parses the intent, ranks whitelisted strategies, simulates the outcome and executes on BOT Chain only after you approve.",
  metadataBase: new URL("https://intentflow.app"),
  openGraph: {
    title: "IntentFlow",
    description: "Natural language DeFi executor on BOT Chain.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
