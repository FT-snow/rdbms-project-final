import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Hospital Appointment System",
  description: "Appointments, prescriptions, billing and reports — on MySQL.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={newsreader.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
