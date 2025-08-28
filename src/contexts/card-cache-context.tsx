
"use client";

import { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { getCards, type CardData } from '@/lib/firestore';

interface CardCacheContextType {
    cards: CardData[];
    loading: boolean;
    error: Error | null;
    forceRefresh: () => Promise<void>;
}

const CardCacheContext = createContext<CardCacheContextType>({
    cards: [],
    loading: true,
    error: null,
    forceRefresh: async () => {},
});

export const useCardCache = () => useContext(CardCacheContext);

export const CardCacheProvider = ({ children }: { children: ReactNode }) => {
    const [cards, setCards] = useState<CardData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    const fetchCards = useCallback(async (refresh = false) => {
        setLoading(true);
        setError(null);
        try {
            const fetchedCards = await getCards(refresh);
            setCards(fetchedCards);
        } catch (e: any) {
            setError(e);
            console.error("Failed to fetch cards:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Initial fetch without forcing refresh to use localStorage if available
        fetchCards(false);
    }, [fetchCards]);

    const forceRefresh = useCallback(async () => {
        await fetchCards(true);
    }, [fetchCards]);

    const value = {
        cards,
        loading,
        error,
        forceRefresh,
    };

    return (
        <CardCacheContext.Provider value={value}>
            {children}
        </CardCacheContext.Provider>
    );
};
