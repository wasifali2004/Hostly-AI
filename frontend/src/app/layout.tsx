import type { Metadata, Viewport } from "next";
import "@/app/globals.css";
import { AuthProvider } from "@/providers/auth-provider";
import { ToastProvider } from "@/components/ui/toast";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Hostly AI — Event operations, unified",
    template: "%s · Hostly AI"
  },
  description:
    "Plan, publish, register, and check in attendees from one secure event operations platform.",
  applicationName: "Hostly AI",
  openGraph: {
    type: "website",
    siteName: "Hostly AI",
    title: "Hostly AI — Event operations, unified",
    description:
      "A multi-tenant event orchestration platform for teams who care about the guest experience."
  },
  twitter: { card: "summary_large_image" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf6"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,400;0,500;0,600;0,700;0,800;1,600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
