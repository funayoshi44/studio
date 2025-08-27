
"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { PokerCard as PokerCardType } from '@/lib/game-logic/poker';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { useEffect, useState } from 'react';

type PokerCardProps = {
  card: PokerCardType | null;
  revealed?: boolean;
  className?: string;
};

const suitToFolderName = (suit: string) => {
    switch (suit) {
        case '♠️': return 'spade';
        case '♥️': return 'heart';
        case '♦️': return 'diamond';
        case '♣️': return 'club';
        case '⭐': return 'star';
        default: return 'unknown';
    }
}

export function PokerCard({ card, revealed = false, className }: PokerCardProps) {
  const cardValue = card ? `${card.rank}${card.suit}` : '?';
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (revealed && card) {
      const fetchImageUrl = async () => {
        setLoading(true);
        try {
          const storage = getStorage();
          const suitFolder = suitToFolderName(card.suit);
          // Updated path to reflect the new storage structure
          const imageRef = ref(storage, `cards/poker/${suitFolder}_${card.rank}.png`);
          const url = await getDownloadURL(imageRef);
          setImageUrl(url);
        } catch (error) {
          console.error(`Failed to fetch image for poker card ${cardValue}:`, error);
          // Fallback to picsum if storage image not found
          setImageUrl(`https://picsum.photos/seed/card-${card.suit}-${card.rank}/200/300`);
        } finally {
          setLoading(false);
        }
      };
      fetchImageUrl();
    } else {
        setLoading(false);
    }
  }, [revealed, card, cardValue]);

  if (!revealed || !card) {
    return (
      <div
        className={cn(
          'relative flex h-28 w-20 items-center justify-center rounded-lg border-4 border-gray-500 bg-gray-400 text-3xl font-bold text-white shadow-md md:h-32 md:w-24',
          className
        )}
      >
        ?
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative h-28 w-20 overflow-hidden rounded-lg border-4 border-gray-300 bg-white text-black shadow-md md:h-32 md:w-24',
        className
      )}
    >
      {loading ? (
        <div className="flex items-center justify-center h-full w-full bg-gray-200 animate-pulse" />
      ) : imageUrl ? (
        <Image
          src={imageUrl}
          alt={`Card ${cardValue}`}
          fill
          style={{ objectFit: 'cover' }}
          data-ai-hint="poker card illustration"
          unoptimized // Using unoptimized because Firebase Storage URLs can have variable tokens
        />
      ) : null}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-center font-bold text-white backdrop-blur-sm">
        <span className="text-lg md:text-xl">{card.rank}{card.suit}</span>
      </div>
    </div>
  );
}
