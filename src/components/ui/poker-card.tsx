
"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { CardData } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { User, Tag, Crown } from 'lucide-react';

type PokerCardProps = {
  card: CardData | null;
  revealed?: boolean;
  className?: string;
};


export function PokerCard({ card, revealed = false, className }: PokerCardProps) {
  const cardValue = card ? `${card.number}${card.suit}` : '?';

  const cardBack = (
    <div
      className={cn(
        'relative flex h-28 w-20 items-center justify-center rounded-lg border-4 border-gray-500 bg-gray-400 text-3xl font-bold text-white shadow-md md:h-32 md:w-24',
        className
      )}
    >
      ?
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
      {card.imageUrl ? (
        <Image
          src={card.imageUrl}
          alt={card.name || `Card ${cardValue}`}
          fill
          style={{ objectFit: 'cover' }}
          data-ai-hint="poker card illustration"
          unoptimized // Using unoptimized because Firebase Storage URLs can have variable tokens
        />
      ) : (
         <div className="flex items-center justify-center h-full w-full bg-gray-200">
            <span className="text-xs text-center p-1">No Image</span>
         </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-center font-bold text-white backdrop-blur-sm">
        <span className="text-lg md:text-xl">{card.number === 0 ? 'Joker' : card.number}{card.suit}</span>
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={300}>
        <Tooltip>
            <TooltipTrigger asChild>{cardFace}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={10} className="max-w-xs break-words">
                <div className="space-y-3 p-2">
                    <h3 className="text-lg font-bold">{card.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4 shrink-0" />
                        <span>{card.artist}</span>
                    </div>
                     <div className="flex items-center gap-2 text-sm text-muted-foreground capitalize">
                        <Crown className="h-4 w-4 shrink-0" />
                        <span>{card.rarity}</span>
                    </div>
                    {card.tags && card.tags.length > 0 && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <Tag className="h-4 w-4 shrink-0 mt-1" />
                            <div className="flex flex-wrap gap-1">
                                {card.tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
  );
}
