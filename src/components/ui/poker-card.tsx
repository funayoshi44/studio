
"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { PokerCard } from '@/lib/game-logic/poker';

type PokerCardProps = {
  card: PokerCard | null;
  revealed?: boolean;
  className?: string;
};

export function PokerCard({ card, revealed = false, className }: PokerCardProps) {
  const cardValue = card ? `${card.rank}${card.suit}` : '?';
  const imageUrl = card ? `https://picsum.photos/seed/card-${card.suit}-${card.rank}/200/300` : '';

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
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={`Card ${cardValue}`}
          fill
          style={{ objectFit: 'cover' }}
          data-ai-hint="poker card illustration"
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-center font-bold text-white backdrop-blur-sm">
        <span className="text-lg md:text-xl">{card.rank}{card.suit}</span>
      </div>
    </div>
  );
}
