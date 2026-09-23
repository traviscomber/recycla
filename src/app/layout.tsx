import "./globals.css";

export const metadata = {
  title: "Recycla REP OS",
  description: "Operational REP Intelligence"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
