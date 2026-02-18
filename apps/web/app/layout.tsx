import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "CCS Operations",
  description: "CCS Technologies Internal Operations Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface-0">
        <Providers>
          <Sidebar />
          <main className="ml-56 min-h-screen">
            <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
