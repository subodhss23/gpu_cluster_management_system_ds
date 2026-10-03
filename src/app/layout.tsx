import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SimProvider } from "@/lib/store";
import { PrefsProvider } from "@/lib/prefs";
import { AppShell } from "@/components/layout/AppShell";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";

export const metadata: Metadata = {
  title: "AetherGrid · AI Factory Control Plane",
  description:
    "Interactive simulator for multi-region GPU and GPU-cluster management: provisioning, scheduling, observability, quotas and chargeback.",
};

export const viewport: Viewport = {
  themeColor: "#05070a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-ink-950 font-sans antialiased">
        <AnalyticsProvider>
          <PrefsProvider>
            <SimProvider>
              <AppShell>{children}</AppShell>
            </SimProvider>
          </PrefsProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
