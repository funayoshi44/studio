"use client";

import { useContext } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageToggle } from '@/components/language-toggle';
import { BarChart3, Gamepad2, User, LogOut } from 'lucide-react';
import { AuthContext } from '@/contexts/auth-context';

export function Header() {
  const t = useTranslation();
  const { user, logOut } = useContext(AuthContext);

  const handleLogout = async () => {
    try {
      await logOut();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Gamepad2 className="h-6 w-6 text-primary" />
            <span className="font-bold">{t('appName')}</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
            <Link href="/history" passHref>
              <Button variant="ghost">
                <BarChart3 className="h-4 w-4 mr-2"/>
                {t('playHistory')}
              </Button>
            </Link>
            <LanguageToggle />
            {user ? (
              <Button onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2"/>
                Logout
              </Button>
            ) : (
              <Link href="/login" passHref>
                <Button>
                  <User className="h-4 w-4 mr-2"/>
                  {t('login')}
                </Button>
              </Link>
            )}
        </div>
      </div>
    </header>
  );
}
