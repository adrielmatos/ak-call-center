import type { Metadata } from "next"; import "./globals.css";
export const metadata: Metadata={title:"AK Call Center",description:"Central A&K Soluções Financeiras"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}