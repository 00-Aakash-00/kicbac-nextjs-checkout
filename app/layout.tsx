import type { Metadata } from "next";
import "@kicbac/react/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kicbac Subscription Checkout",
  description: "Tokenized subscription checkout demo using Kicbac React and Next.js helpers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
