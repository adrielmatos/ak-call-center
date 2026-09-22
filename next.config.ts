import type {NextConfig} from "next";

const securityHeaders=[
 {key:"X-Frame-Options",value:"DENY"},
 {key:"X-Content-Type-Options",value:"nosniff"},
 {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},
 {key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
 {key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains; preload"},
 {key:"Content-Security-Policy",value:"default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' https://*.supabase.co; worker-src 'self' blob:;"}
];

const nextConfig:NextConfig={
 reactStrictMode:true,
 compress:true,
 productionBrowserSourceMaps:false,
 headers:async()=>[{source:"/(.*)",headers:securityHeaders}]
};

export default nextConfig;
