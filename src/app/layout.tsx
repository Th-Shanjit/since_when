import type { Metadata } from "next";
import {
  Bebas_Neue,
  DM_Serif_Display,
  Inter,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";
import { DonateButton } from "@/ui/DonateButton";
import { startAlertsWorker } from "@/jobs/alertsWorker";

// The web process also emits onCounterChange (via POST /api/manual-event
// and admin approvals), so the alerts worker is started here too. The
// module is a no-op if already started by src/worker.ts in the same
// process, so double-starting is safe.
startAlertsWorker();

const bebas = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Since When - India's honest streak counters",
  description:
    "Days since the last AQI crisis, fuel-price change, internet shutdown, and other India-specific streaks that should not exist. Updated on a schedule. Never reset on a rumour.",
  openGraph: {
    title: "Since When",
    description:
      "Days since the last AQI crisis, fuel hike, exam leak, and other India-specific streaks.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${dmSerif.variable} ${inter.variable} ${jetMono.variable}`}
    >
      <body className="grain antialiased">
        {children}
        <DonateButton />
      </body>
    </html>
  );
}
