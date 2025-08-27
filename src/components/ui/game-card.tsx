
"use client";

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { useEffect, useState } from 'react';

type GameCardProps = {
  number: number | null;
  revealed?: boolean;
  className?: string;
};

export function GameCard({ number, revealed = false, className }: GameCardProps) {
  const cardValue = number ?? '?';
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (revealed && number) {
      const fetchImageUrl = async () => {
        setLoading(true);
        try {
          const storage = getStorage();
          // Updated path to reflect the new storage structure
          const imageRef = ref(storage, `cards/duel/${number}.png`);
          const url = await getDownloadURL(imageRef);
          setImageUrl(url);
        } catch (error) {
          console.error(`Failed to fetch image for duel card ${number}:`, error);
          // Fallback to picsum if storage image not found
          setImageUrl(`https://picsum.photos/seed/card-${number}/200/300`);
        } finally {
          setLoading(false);
        }
      };
      fetchImageUrl();
    } else {
      setLoading(false);
    }
  }, [revealed, number]);

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
      {loading ? (
         <div className="flex items-center justify-center h-full w-full bg-gray-200 animate-pulse" />
      ) : imageUrl && (
        <Image
          src={imageUrl}
          alt={`Card ${cardValue}`}
          fill
          style={{ objectFit: 'cover' }}
          data-ai-hint="card illustration"
          unoptimized // Using unoptimized because Firebase Storage URLs can have variable tokens
        />
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-center font-bold text-white backdrop-blur-sm">
        <span className="text-lg md:text-xl">{cardValue}</span>
      </div>
    </div>
  );
}
