
"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { CardData } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { User, Tag, BookOpen } from 'lucide-react';


type GameCardProps = {
  card: CardData | null;
  revealed?: boolean;
  className?: string;
  isPlayer?: boolean;
};

// Simplified component for in-game card representation
export function GameCard({ card, revealed = false, className, isPlayer = false }: GameCardProps) {
  const cardBack = (
    <div
      className={cn(
        'relative flex h-28 w-20 items-center justify-center rounded-lg border-4 border-gray-500 bg-gray-400 text-3xl font-bold text-white shadow-md md:h-32 md:w-24 overflow-hidden',
        className
      )}
    >
      <Image
        src="https://firebasestorage.googleapis.com/v0/b/cardverse-oajwb.appspot.com/o/system-use%2Fcard-back.png?alt=media&token=7c3d2c8a-7a64-4d82-9a30-2a9103554367"
        alt="Card back"
        layout="fill"
        objectFit="cover"
        unoptimized
      />
    </div>
  );

  if (!revealed || !card) {
    return cardBack;
  }

  const cardFace = (
     <div
      className={cn(
        'relative h-28 w-20 overflow-hidden rounded-lg border-4 border-gray-300 bg-white text-black shadow-md md:h-32 md:w-24',
        className
      )}
    >
      <Image
        src={card.frontImageUrl}
        alt={card.title || 'Card Image'}
        fill
        style={{ objectFit: 'cover' }}
        data-ai-hint="poker card illustration"
        unoptimized
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-center font-bold text-white backdrop-blur-sm">
        <span className="text-lg md:text-xl">{card.rank === 0 ? 'Joker' : card.rank}</span>
      </div>
    </div>
  );

  return cardFace;
}
