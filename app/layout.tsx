import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Danjos Deck',
  description: 'Configure your custom ESP32-S3 Danjos Deck',
  icons: {
    icon: 'https://i.imgur.com/700dwV5.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />
      </head>
      <body className={`${inter.className} bg-[#1e1e1e] text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
