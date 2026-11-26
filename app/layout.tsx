import type { Metadata } from "next";
export const metadata: Metadata = { title: "Signal Desk · Monk Mantra", description: "Client analytics and health monitoring for Monk Mantra." };
export default function RootLayout({children}: {children: React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
