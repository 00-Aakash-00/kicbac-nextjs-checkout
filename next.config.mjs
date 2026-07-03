/** @type {import("next").NextConfig} */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js emits inline runtime scripts; production deployments should move to nonces.
      "script-src 'self' 'unsafe-inline' https://kicbac.transactiongateway.com",
      "frame-src https://kicbac.transactiongateway.com",
      "connect-src 'self' https://kicbac.transactiongateway.com",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
