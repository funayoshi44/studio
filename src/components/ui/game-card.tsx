"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';

type GameCardProps = {
  number: number | null;
  revealed?: boolean;
  className?: string;
};

export function GameCard({ number, revealed = false, className }: GameCardProps) {
  const cardValue = number ?? '?';
  const imageUrl = number ? `https://picsum.photos/seed/card-${number}/200/300` : '';

  if (!revealed) {
    return (
      <div
        className={cn(
          'relative flex h-28 w-20 items-center justify-center rounded-lg border-4 border-gray-500 bg-gray-400 text-3xl font-bold text-white md:h-32 md:w-24',
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
          data-ai-hint="card illustration"
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-center font-bold text-white backdrop-blur-sm">
        <span className="text-lg md:text-xl">{cardValue}</span>
      </div>
    </div>
  );
}
