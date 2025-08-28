
"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { CardData } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { User, Tag, BookOpen } from 'lucide-react';
import { useState, useRef } from 'react';

type PokerCardProps = {
  card: CardData | null;
  revealed?: boolean;
  className?: string;
};


export function PokerCard({ card, revealed = false, className }: PokerCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const longPressTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };
  
  const handleTouchStart = () => {
    longPressTimeout.current = setTimeout(() => {
      setIsOpen(true);
    }, 500); // 500ms for a long press
  };

  const handleTouchEnd = () => {
    if (longPressTimeout.current) {
      clearTimeout(longPressTimeout.current);
    }
  };


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
      {card.frontImageUrl ? (
        <Image
          src={card.frontImageUrl}
          alt={card.title || 'Card Image'}
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
        <span className="text-lg md:text-xl">{card.rank === 0 ? 'Joker' : card.rank}{card.suit}</span>
      </div>
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger 
            asChild
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={(e) => e.preventDefault()}
        >
            {cardFace}
        </PopoverTrigger>
        <PopoverContent side="right" align="start" sideOffset={15} className="w-auto p-0 border-none bg-transparent shadow-none z-50">
            <div className="flex items-start">
                <div className="bg-card text-card-foreground p-4 rounded-lg shadow-lg max-w-xs ml-2">
                    <div className="space-y-3">
                        <h3 className="text-lg font-bold">{card.title}</h3>
                        {card.caption && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{card.caption}</p>}
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <BookOpen className="h-4 w-4 shrink-0" />
                            <span>{card.seriesName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4 shrink-0" />
                            <span>{card.authorName}</span>
                        </div>
                        {card.hashtags && card.hashtags.length > 0 && (
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                <Tag className="h-4 w-4 shrink-0 mt-1" />
                                <div className="flex flex-wrap gap-1">
                                    {card.hashtags.map(tag => (
                                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
             {card.backImageUrl && (
                <div className="relative h-28 w-20 overflow-hidden rounded-lg border-4 border-gray-300 bg-white text-black shadow-lg md:h-32 md:w-24 mt-[-60px] ml-[150px] -z-10">
                     <Image
                        src={card.backImageUrl}
                        alt={`${card.title} - Back`}
                        fill
                        style={{ objectFit: 'cover' }}
                        data-ai-hint="card back design"
                        unoptimized
                    />
                </div>
            )}
        </PopoverContent>
    </Popover>
  );
}
