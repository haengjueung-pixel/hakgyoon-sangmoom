import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@/lib/site-config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
const naverVerification = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: { default: "상문마스터 | 상문고등학교 학교생활", template: "%s | 상문마스터" },
  description: siteConfig.seoDescription,
  applicationName: "상문마스터",
  alternates: siteUrl ? { canonical: "/" } : undefined,
  robots: { index: true, follow: true },
  openGraph: { title: "상문마스터", description: "상문고등학교 학교생활 정보를 한곳에서 확인하세요.", type: "website", locale: "ko_KR", ...(siteUrl ? { url: siteUrl } : {}) },
  verification: naverVerification ? { other: { "naver-site-verification": naverVerification } } : undefined,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
