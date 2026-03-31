import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1tel - F1 Telemetry Viewer",
  description: "Visualise your F1 2025 race telemetry. Upload a .f1tel file and explore lap times, tyre data, speed traces and more.",
  metadataBase: new URL("https://f1tel.gnuadm.in"),
  openGraph: {
    title: "F1tel - F1 Telemetry Viewer",
    description: "Upload your .f1tel file and explore lap times, sector splits, tyre temperatures, speed traces and more. Everything runs in your browser.",
    url: "https://f1tel.gnuadm.in",
    siteName: "F1tel",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "F1tel - F1 Telemetry Viewer",
    description: "Upload your .f1tel file and explore lap times, sector splits, tyre temperatures, speed traces and more.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
