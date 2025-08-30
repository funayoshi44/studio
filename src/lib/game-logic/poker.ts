

import type { CardData } from '@/lib/types';


// Re-exporting CardData as PokerCard for semantic clarity in the Poker game context.
export type PokerCard = CardData;
export type HandRank = { name: string; value: number };

// A fallback function to create a default deck if Firestore is empty
const createDefaultPokerDeck = (): PokerCard[] => {
    const suits = ['spade', 'heart', 'diamond', 'club'];
    const ranks = [
        { name: 'A', value: 14, number: 1 }, { name: '2', value: 2, number: 2 }, { name: '3', value: 3, number: 3 },
        { name: '4', value: 4, number: 4 }, { name: '5', value: 5, number: 5 }, { name: '6', value: 6, number: 6 },
        { name: '7', value: 7, number: 7 }, { name: '8', value: 8, number: 8 }, { name: '9', value: 9, number: 9 },
        { name: '10', value: 10, number: 10 }, { name: 'J', value: 11, number: 11 }, { name: 'Q', value: 12, number: 12 },
        { name: 'K', value: 13, number: 13 }
    ];
    const deck: PokerCard[] = [];
    let idCounter = 0;
    for (const suit of suits) {
        for (const rank of ranks) {
             const suitSymbol = suit === 'spade' ? '♠️' : suit === 'heart' ? '♥️' : suit === 'diamond' ? '♦️' : '♣️';
            deck.push({
                id: `default-poker-${rank.name}${suit}${idCounter++}`, // Ensure unique ID
                frontImageUrl: `https://picsum.photos/seed/card-poker-${rank.name}${suit}/200/300`,
                backImageUrl: null,
                suit: suit,
                rank: rank.number,
                title: `${rank.name} of ${suit}`,
                caption: ``,
                hashtags: [],
                seriesName: 'Poker',
                authorName: 'System',
                authorId: 'system',
                createdAt: new Date() as any,
                updatedAt: new Date() as any,
                gameType: 'poker',
                number: rank.number,
                value: rank.value,
                name: `${rank.name} of ${suit}`,
                artist: 'System',
                imageUrl: `https://picsum.photos/seed/card-poker-${rank.name}${suit}/200/300`,
                rarity: 'common',
                tags: []
            });
        }
    }
    return deck;
}

const shuffleDeck = (deck: PokerCard[]): PokerCard[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

// This function now uses the cards from the cache.
export const createPokerDeck = (allCards: PokerCard[]): PokerCard[] => {
    let pokerCards = allCards.filter(c => c.gameType === 'poker' || c.gameType === 'common');

    if (pokerCards.length < 52) {
        const defaultDeck = createDefaultPokerDeck();
        const needed = 52 - pokerCards.length;
        const existingSignatures = new Set(pokerCards.map(c => `${c.number}-${c.suit}`));
        const uniqueDefaults = defaultDeck.filter(dc => !existingSignatures.has(`${dc.number}-${dc.suit}`));
        pokerCards.push(...uniqueDefaults.slice(0, needed));
    }
    
    return shuffleDeck(pokerCards.slice(0, 52));
};


const checkStraight = (sortedRanks: number[]): boolean => {
    if (sortedRanks.length !== 5) return false;
    // Ace-low straight (A-2-3-4-5) where Ace (14) is treated as 1
    const isAceLow = JSON.stringify(sortedRanks) === JSON.stringify([2, 3, 4, 5, 14]);
    if (isAceLow) return true;
    
    let isStraight = true;
    for (let i = 0; i < sortedRanks.length - 1; i++) {
        if (sortedRanks[i+1] - sortedRanks[i] !== 1) {
            isStraight = false;
            break;
        }
    }
    return isStraight;
}

export const evaluatePokerHand = (hand: PokerCard[]): HandRank => {
    if (!hand || hand.length !== 5) {
        return { name: 'High Card', value: 0 };
    }
    const rankCounts: { [key: number]: number } = {};
    const suitCounts: { [key: string]: number } = {};
    let starSuitCount = 0;
    
    hand.forEach(card => {
        rankCounts[card.value] = (rankCounts[card.value] || 0) + 1;
        if (card.suit === 'star') {
            starSuitCount++;
        } else {
            suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
        }
    });

    const sortedRanks = hand.map(c => c.value).sort((a,b) => a-b);
    
    // effective suit counts for flush checks
    const finalSuitCounts = {...suitCounts};
    if (starSuitCount > 0) {
        if (Object.keys(finalSuitCounts).length > 0) {
            let maxSuit = Object.keys(finalSuitCounts).reduce((a, b) => finalSuitCounts[a] > finalSuitCounts[b] ? a : b);
            finalSuitCounts[maxSuit] += starSuitCount;
        } else {
             finalSuitCounts['star'] = starSuitCount; // all stars
        }
    }

    const isFlush = Object.values(finalSuitCounts).some(count => count >= 5);
    const is5SuitFlush = new Set(hand.map(c => c.suit)).size === 5;
    const isStraight = checkStraight(sortedRanks);
    // A,K,Q,J,10 has values 14,13,12,11,10
    const isRoyal = isStraight && sortedRanks.every(rankValue => [10, 11, 12, 13, 14].includes(rankValue));

    const rankValues = Object.values(rankCounts).sort((a,b) => b-a);
    
    if (isRoyal && is5SuitFlush) return { name: '5-Suit Royal Flush', value: 14 };
    if (isRoyal && isFlush) return { name: 'Royal Flush', value: 13 };
    if (isStraight && is5SuitFlush) return { name: '5-Suit Straight Flush', value: 12 };
    if (isStraight && isFlush) return { name: 'Straight Flush', value: 11 };
    if (rankValues.includes(5)) return { name: 'Five of a Kind', value: 10 };
    if (rankValues.includes(4)) return { name: 'Four of a Kind', value: 9 };
    if (rankValues.includes(3) && rankValues.includes(2)) return { name: 'Full House', value: 8 };
    if (isFlush) return { name: 'Flush', value: 7 };
    if (is5SuitFlush) return { name: '5-Suit Flush', value: 6 };
    if (isStraight) return { name: 'Straight', value: 5 };
    if (rankValues.includes(3)) return { name: 'Three of a Kind', value: 4 };
    if (rankValues[0] === 2 && rankValues[1] === 2) return { name: 'Two Pair', value: 3 };
    if (rankValues.includes(2)) return { name: 'One Pair', value: 2 };
    
    return { name: 'High Card', value: 1 };
};
