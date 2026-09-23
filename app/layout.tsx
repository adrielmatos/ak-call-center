import type { Metadata } from "next"; import "./globals.css";
export const metadata: Metadata={title:"A&K Soluções Financeiras",description:"Central A&K Soluções Financeiras"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}