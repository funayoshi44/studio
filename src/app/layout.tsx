import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { GameProvider } from '@/contexts/game-context';
import { AuthProvider } from '@/contexts/auth-context';
import { Header } from '@/components/header';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CardVerse',
  description: 'A collection of exciting card games.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-body antialiased`}>
        <AuthProvider>
          <GameProvider>
            <div className="relative flex min-h-screen w-full flex-col">
              <Header />
              <main className="flex-1 container mx-auto px-4 py-8">
                {children}
              </main>
            </div>
            <Toaster />
          </GameProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
