import { Montserrat, Rajdhani } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap"
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
  display: "swap"
});

export const metadata = {
  title: "Recycla REP OS",
  description: "Operational REP Intelligence"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${montserrat.variable} ${rajdhani.variable}`}>
      <body>{children}</body>
    </html>
  );
}
