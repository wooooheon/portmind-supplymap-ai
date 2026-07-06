import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "PortMind SupplyMap AI",
  description: "한국 공장과 중국 베타 공장을 비교하는 공급망·수입 리스크 분석 플랫폼"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
