import { Toaster } from "@/components/ui/toaster";
import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "NotebookLM Clone",
  description: "NotebookLM Clone app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
