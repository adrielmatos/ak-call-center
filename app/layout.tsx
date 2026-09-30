import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./accessibility-overrides.css";
import BankBadge from "./components/bank-badge";

const inter = Inter({ subsets: ["latin"], display: "swap", preload: true });

export const metadata: Metadata={title:"A&K Soluções Financeiras",description:"Central A&K Soluções Financeiras"};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="pt-BR"><body className={inter.className}>{children}<BankBadge /></body></html>;
}
