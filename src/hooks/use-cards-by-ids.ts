// hooks/use-cards-by-ids.ts
import { useEffect, useMemo, useState } from 'react';
import { initializeFirestore, persistentLocalCache, collection, query, where, getDocs, DocumentData } from 'firebase/firestore';
import { app } from '@/lib/firebase';
import type { CardData } from '@/lib/types';

// Initialize with persistent cache if not already done elsewhere
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

export function useCardsByIds(ids: string[]) {
  const [cards, setCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(false);
  const uniqIds = useMemo(() => Array.from(new Set(ids)).filter(Boolean), [ids]);
  const joinedIds = uniqIds.join('|'); // Create a stable dependency

  useEffect(() => {
    if (!uniqIds.length) {
      setCards([]);
      return;
    }

    const fetchCards = async () => {
      setLoading(true);
      const CHUNK_SIZE = 30; // Firestore 'in' query limit
      const colRef = collection(db, 'cards');
      const result: CardData[] = [];
      
      try {
        for (let i = 0; i < uniqIds.length; i += CHUNK_SIZE) {
          const chunkIds = uniqIds.slice(i, i + CHUNK_SIZE);
          const q = query(colRef, where('__name__', 'in', chunkIds));
          const snap = await getDocs(q);
          snap.forEach(d => {
            // A helper to derive compatibility fields could be used here too if needed
            result.push({ id: d.id, ...d.data() } as CardData);
          });
        }
        setCards(result);
      } catch (error) {
        console.error("Failed to fetch cards by IDs:", error);
        // Optionally handle error state
      } finally {
        setLoading(false);
      }
    };

    fetchCards();
  }, [joinedIds]); // Depend on the stable joined string

  const cardsById = useMemo(() => new Map(cards.map(c => [c.id, c])), [cards]);

  return { cards, cardsById, loading };
}
