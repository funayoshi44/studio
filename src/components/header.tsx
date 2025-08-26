"use client";

import { useContext } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageToggle } from '@/components/language-toggle';
import { BarChart3, Gamepad2, User, LogOut, Users, Settings } from 'lucide-react';
import { AuthContext } from '@/contexts/auth-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';


export function Header() {
  const t = useTranslation();
  const { user, logOut } = useContext(AuthContext);

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
            <Link href="/online" passHref>
              <Button variant="ghost">
                <Users className="h-4 w-4 mr-2"/>
                {t('onlinePlay')}
              </Button>
            </Link>
            <Link href="/history" passHref>
              <Button variant="ghost">
                <BarChart3 className="h-4 w-4 mr-2"/>
                {t('playHistory')}
              </Button>
            </Link>
            <LanguageToggle />
            {user ? (
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
                      <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
