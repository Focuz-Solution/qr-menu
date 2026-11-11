import { Google_Sans, Inter } from "next/font/google";

const googleSans = Google_Sans({ variable: "--font-google-sans", subsets: ["khmer", "latin"], axes: ["opsz"], adjustFontFallback: false });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], preload: false });

export const fontVariables = `${googleSans.variable} ${inter.variable}`;
