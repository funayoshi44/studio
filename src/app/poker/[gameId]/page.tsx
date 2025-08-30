
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { type CardData } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Copy, Flag, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { PokerCard as GameCard } from '@/components/ui/poker-card';
import { cn } from '@/lib/utils';
import { useVictorySound } from '@/hooks/use-victory-sound';
import { VictoryAnimation } from '@/components/victory-animation';

// This page is a placeholder and the game logic is not fully implemented for online play yet.
// We are keeping the file to avoid 404 errors but the functionality is limited.

export default function OnlinePokerPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;
  const { toast } = useToast();
  const { t } = useTranslation();
  const playVictorySound = useVictorySound();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);


  if (loading || !user) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin" /> Loading game...</div>;
  }

  // Since online Poker is not implemented, we show a "coming soon" message.
  return (
    <div className="text-center py-10 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">{t('pokerTitle')} - {t('onlinePlay')}</h2>
        <p className="mb-4 text-muted-foreground text-lg">{t('comingSoon')}</p>
        <Card className="my-6">
          <CardHeader><CardTitle>Work in Progress</CardTitle></CardHeader>
          <CardContent>
            <p>Online multiplayer for 5-Suit Poker is still under development. Please check back later!</p>
          </CardContent>
        </Card>
        <Link href="/online" passHref>
            <Button>{t('backToMenu')}</Button>
        </Link>
    </div>
  );
}
