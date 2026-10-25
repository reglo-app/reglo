import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const outfit = Outfit({
    variable: "--font-outfit",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        template: "%s · REGLO",
        default: "REGLO",
    },
    description:
        "REGLO accompagne les entreprises en Qualité, Hygiène-Santé, Sécurité et Environnement.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <html lang="fr" className={`${outfit.variable} h-full antialiased`}>
            <body className="flex min-h-full flex-col">
                {children}
                <Toaster />
            </body>
        </html>
    );
}
