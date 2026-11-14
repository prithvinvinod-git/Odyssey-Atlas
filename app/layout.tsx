import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Odyssey Atlas — Lunar Landing Site Navigator",
  description: "Compare Artemis candidate landing sites. Real Sun/Earth visibility over true lunar terrain horizons.",
  openGraph: {
    title: "Odyssey Atlas",
    description: "NASA Space Apps — Lunar Landing Site Navigator",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#05070D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}