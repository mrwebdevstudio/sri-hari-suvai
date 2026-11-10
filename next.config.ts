import type { NextConfig } from "next";

const serverKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith("NEXT_PUBLIC_") && value && (value.includes("sb_secret_") || (serverKey && value.includes(serverKey)))) {
    throw new Error("A public environment variable contains a server credential. Remove it before starting or building.");
  }
}

function configuredOrigin(value: string | undefined): string | null {
  try { return value ? new URL(value).origin : null; } catch { return null; }
}

const supabaseOrigin = configuredOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
const developmentScriptSource = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js bootstrapping and Razorpay Checkout require narrowly scoped inline scripts/styles.
  `script-src 'self' 'unsafe-inline'${developmentScriptSource} https://checkout.razorpay.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")}` : ""} https://api.razorpay.com`,
  "frame-src https://api.razorpay.com https://*.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://api.razorpay.com\")" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
