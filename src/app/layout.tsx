import "./globals.css";

export const metadata = {
  title: "CAISY BRAIN",
  description: "Your private Second Brain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-50">
        {children}
      </body>
    </html>
  );
}
