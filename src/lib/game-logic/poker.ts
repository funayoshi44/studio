export type Suit = '♠️' | '♥️' | '♦️' | '♣️' | '⭐';
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
export type PokerCard = { suit: Suit; rank: Rank; value: number };
export type HandRank = { name: string; value: number };

const suits: Suit[] = ['♠️', '♥️', '♦️', '♣️', '⭐'];
const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const getRankValue = (rank: Rank): number => {
  if (rank === 'A') return 14;
  if (rank === 'K') return 13;
  if (rank === 'Q') return 12;
  if (rank === 'J') return 11;
  return parseInt(rank);
};

export const createPokerDeck = (): PokerCard[] => {
  let deck: PokerCard[] = [];
  // For a 5-suit poker, we need more cards. A standard 52-card deck is used per suit for simplicity, leading to a large deck.
  // In a real game, card distribution might be different. Here we use 5 full sets.
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank, value: getRankValue(rank) });
    }
  }
  return shuffleDeck(deck);
};

const shuffleDeck = (deck: PokerCard[]): PokerCard[] => {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const checkStraight = (sortedRanks: number[]): boolean => {
    if (sortedRanks.length !== 5) return false;
    // Ace-low straight (A-2-3-4-5)
    if (JSON.stringify(sortedRanks) === JSON.stringify([2,3,4,5,14])) return true;
    
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
    const rankCounts: { [key: number]: number } = {};
    const suitCounts: { [key: string]: number } = {};
    let starSuitCount = 0;
    
    hand.forEach(card => {
        rankCounts[card.value] = (rankCounts[card.value] || 0) + 1;
        if (card.suit === '⭐') {
            starSuitCount++;
        } else {
            suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
        }
    });

    const sortedRanks = hand.map(c => c.value).sort((a,b) => a-b);
    const uniqueRanks = Object.keys(rankCounts).length;
    
    // effective suit counts for flush checks
    const finalSuitCounts = {...suitCounts};
    if (starSuitCount > 0) {
        if (Object.keys(finalSuitCounts).length > 0) {
            let maxSuit = Object.keys(finalSuitCounts).reduce((a, b) => finalSuitCounts[a] > finalSuitCounts[b] ? a : b);
            finalSuitCounts[maxSuit] += starSuitCount;
        } else {
             finalSuitCounts['⭐'] = starSuitCount; // all stars
        }
    }

    const isFlush = Object.values(finalSuitCounts).some(count => count === 5);
    const is5SuitFlush = new Set(hand.map(c => c.suit)).size === 5;
    const isStraight = checkStraight(sortedRanks);
    const isRoyal = isStraight && sortedRanks[0] === 10 && sortedRanks[4] === 14;

    const rankValues = Object.values(rankCounts).sort((a,b) => b-a);
    
    if (isRoyal && is5SuitFlush) return { name: '5-Suit Royal Flush', value: 14 };
    if (isRoyal && isFlush) return { name: 'Royal Straight Flush', value: 13 };
    if (isStraight && is5SuitFlush) return { name: '5-Suit Straight Flush', value: 12 };
    if (isStraight && isFlush) return { name: 'Straight Flush', value: 11 };
    if (rankValues[0] === 5) return { name: 'Five of a Kind', value: 10 };
    if (rankValues[0] === 4) return { name: 'Four of a Kind', value: 9 };
    if (rankValues[0] === 3 && rankValues[1] === 2) return { name: 'Full House', value: 8 };
    if (isFlush) return { name: 'Flush', value: 7 };
    if (is5SuitFlush) return { name: '5-Suit Flush', value: 6 };
    if (isStraight) return { name: 'Straight', value: 5 };
    if (rankValues[0] === 3) return { name: 'Three of a Kind', value: 4 };
    if (rankValues[0] === 2 && rankValues[1] === 2) return { name: 'Two Pair', value: 3 };
    if (rankValues[0] === 2) return { name: 'One Pair', value: 2 };
    
    return { name: 'High Card', value: 1 };
};
