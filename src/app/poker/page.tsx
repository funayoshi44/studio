
"use client";

import { useState, useContext, useEffect, useCallback } from 'react';
import { GameContext } from '@/contexts/game-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAIMove } from '../actions';
import type { AdjustDifficultyInput } from '@/ai/flows/ai-opponent-difficulty-adjustment';
import Link from 'next/link';
import { evaluatePokerHand, type PokerCard, createPokerDeck } from '@/lib/game-logic/poker';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb } from 'lucide-react';

type PokerState = {
  round: number;
  playerScore: number;
  cpuScore: number;
  phase: 'betting' | 'result';
  playerHand: PokerCard[];
  cpuHand: PokerCard[];
  deck: PokerCard[];
  exchangeCount: number;
  selectedIndices: number[];
  playerHandRank: string | null;
  cpuHandRank: string | null;
  resultText: string;
  aiRationale: string | null;
};

const initialPokerState: PokerState = {
  round: 1,
  playerScore: 0,
  cpuScore: 0,
  phase: 'betting',
  playerHand: [],
  cpuHand: [],
  deck: [],
  exchangeCount: 0,
  selectedIndices: [],
  playerHandRank: null,
  cpuHandRank: null,
  resultText: '',
  aiRationale: null,
};

export default function PokerPage() {
  const { difficulty, recordGameResult } = useContext(GameContext);
  const t = useTranslation();
  const [state, setState] = useState<PokerState>(initialPokerState);
  const [loading, setLoading] = useState(false);

  const dealNewHand = useCallback(() => {
    const deck = createPokerDeck();
    const playerHand = deck.splice(0, 5);
    const cpuHand = deck.splice(0, 5);
    setState(prev => ({
        ...initialPokerState,
        round: prev.round,
        playerScore: prev.playerScore,
        cpuScore: prev.cpuScore,
        deck, playerHand, cpuHand
    }));
  }, []);

  useEffect(() => {
    dealNewHand();
  }, [dealNewHand]);

  const toggleCardSelection = (index: number) => {
    if (state.exchangeCount >= 2 || state.phase === 'result') return;
    setState(prev => {
        const selectedIndices = [...prev.selectedIndices];
        const cardIndex = selectedIndices.indexOf(index);
        if (cardIndex > -1) {
            selectedIndices.splice(cardIndex, 1);
        } else {
            selectedIndices.push(index);
        }
        return { ...prev, selectedIndices };
    });
  };

  const handleExchange = () => {
    if (state.selectedIndices.length === 0 || state.exchangeCount >= 2) return;
    setState(prev => {
        const newPlayerHand = [...prev.playerHand];
        const newDeck = [...prev.deck];
        prev.selectedIndices.forEach(index => {
            if (newDeck.length > 0) {
              newPlayerHand[index] = newDeck.pop()!;
            }
        });
        return {
            ...prev,
            playerHand: newPlayerHand,
            deck: newDeck,
            exchangeCount: prev.exchangeCount + 1,
            selectedIndices: [],
        };
    });
  };

  const handleShowdown = async () => {
    setLoading(true);
    const playerRank = evaluatePokerHand(state.playerHand);
    const cpuRankBefore = evaluatePokerHand(state.cpuHand);
    
    // AI asks for which cards to exchange
    const aiInput: AdjustDifficultyInput = {
        gameType: 'poker',
        difficulty: difficulty,
        gameState: {
            exchangeCount: state.exchangeCount,
            // Pass hand as simple strings for the AI
            cpuHand: state.cpuHand.map(c => `${c.rank}${c.suit}`),
            cpuHandRank: t(cpuRankBefore.name as any), // Pass the evaluated rank name
        },
        // AI's available moves are the indices of the cards it can discard
        availableMoves: state.cpuHand.map((_, i) => i.toString()),
    };

    const aiResponse = await getAIMove(aiInput);
    const cardsToDiscardIndices = aiResponse.move.split(',').map(i => parseInt(i.trim())).filter(i => !isNaN(i) && i >= 0 && i < 5);
    
    let cpuHand = [...state.cpuHand];
    let deck = [...state.deck];

    if (cardsToDiscardIndices.length > 0) {
        cardsToDiscardIndices.forEach(index => {
            if (deck.length > 0 && index < cpuHand.length) {
                cpuHand[index] = deck.pop()!;
            }
        });
    }

    const cpuRankAfter = evaluatePokerHand(cpuHand);

    let winner: 'player' | 'cpu' | 'draw' = 'draw';
    if (playerRank.value > cpuRankAfter.value) winner = 'player';
    else if (cpuRankAfter.value > playerRank.value) winner = 'cpu';

    if (winner === 'player') recordGameResult('poker', 'win');
    if (winner === 'cpu') recordGameResult('poker', 'loss');

    setState(prev => ({
        ...prev,
        phase: 'result',
        cpuHand: cpuHand,
        playerHandRank: t(playerRank.name as any),
        cpuHandRank: t(cpuRankAfter.name as any),
        resultText: winner === 'player' ? t('youWin') : winner === 'cpu' ? t('cpuWins') : t('draw'),
        playerScore: prev.playerScore + (winner === 'player' ? 1 : 0),
        cpuScore: prev.cpuScore + (winner === 'cpu' ? 1 : 0),
        aiRationale: aiResponse.rationale,
    }));
    setLoading(false);
  };
  
  const nextRound = () => {
    setState(prev => ({ ...prev, round: prev.round + 1}));
    dealNewHand();
  }

  const PokerHand = ({ hand, show, owner }: { hand: PokerCard[], show: boolean, owner: 'player' | 'cpu' }) => (
    <div className="flex justify-center space-x-1 md:space-x-2 mb-4">
      {hand.map((card, index) => {
        const isSelected = owner === 'player' && state.selectedIndices.includes(index);
        return (
          <div
            key={index}
            className={cn(
              "w-14 h-20 md:w-20 md:h-28 rounded-lg flex flex-col items-center justify-center text-sm md:text-lg font-bold border-2 transition-all duration-300",
              show ? "bg-white text-black" : "bg-primary text-primary-foreground",
              owner === 'player' && state.phase === 'betting' && "cursor-pointer",
              isSelected ? 'border-accent bg-amber-100 transform -translate-y-2' : 'border-gray-300'
            )}
            onClick={() => owner === 'player' && toggleCardSelection(index)}
          >
            {show ? (
              <>
                <div className="text-base md:text-lg">{card.rank}</div>
                <div className="text-lg md:text-2xl">{card.suit}</div>
              </>
            ) : (
               <div className="text-2xl">?</div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="text-center">
      <h2 className="text-3xl font-bold mb-2">{t('pokerTitle')}</h2>
      <div className="mb-4 text-muted-foreground">
        <span>{t('round')} {state.round}</span>
        <span className="mx-2">|</span>
        <span>{t('cpu')}: <span className="font-semibold capitalize">{t(difficulty)}</span></span>
         <span className="mx-2">|</span>
        <span>{t('exchanges')}: {state.exchangeCount}/2</span>
      </div>
      <div className="flex justify-center space-x-4 md:space-x-8 text-lg mb-4">
        <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg font-bold">{t('you')}: {state.playerScore} {t('wins')}</div>
        <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-lg font-bold">{t('cpu')}: {state.cpuScore} {t('wins')}</div>
      </div>
      
      <div className="my-6">
        <h3 className="text-xl font-bold mb-2 text-red-500">{t('cpu')}</h3>
        <PokerHand hand={state.cpuHand} show={state.phase === 'result'} owner="cpu" />
        {state.phase === 'result' && <p className="font-bold">{t('cpuHandRank')}: {state.cpuHandRank}</p>}
      </div>

      <div className="my-6">
        <h3 className="text-xl font-bold mb-2 text-blue-500">{t('yourHand')}</h3>
        <PokerHand hand={state.playerHand} show={true} owner="player" />
        {state.phase === 'result' && <p className="font-bold">{t('yourHandRank')}: {state.playerHandRank}</p>}
      </div>

      {state.phase === 'betting' && (
        <div className="space-x-4">
            <Button 
                onClick={handleExchange} 
                disabled={loading || state.selectedIndices.length === 0 || state.exchangeCount >= 2}
                variant="secondary"
                size="lg"
            >
                {t('exchangeSelectedCards')}
            </Button>
            <Button onClick={handleShowdown} disabled={loading} size="lg">{t('showDown')}</Button>
        </div>
      )}

      {state.phase === 'result' && (
          <div className="my-6">
              <p className="text-2xl font-bold mb-4">{state.resultText}</p>
                {state.aiRationale && (
                    <Accordion type="single" collapsible className="w-full max-w-md mx-auto my-4">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>
                        <span className="flex items-center gap-2"><Lightbulb className="w-4 h-4" /> AI's Rationale</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-left text-sm text-muted-foreground bg-background/50 p-4 rounded-md">
                        {state.aiRationale}
                        </AccordionContent>
                    </AccordionItem>
                    </Accordion>
                )}
              <Button onClick={nextRound} size="lg" className="mt-2">{t('nextRound')}</Button>
          </div>
      )}

      <div className="flex justify-center mt-8">
          <Link href="/" passHref>
              <Button variant="secondary">{t('backToMenu')}</Button>
          </Link>
      </div>
      
      <Card className="max-w-4xl mx-auto mt-12 text-left bg-card/50">
        <CardHeader><CardTitle>📖 {t('pokerTitle')} Rules & Hand Rankings</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs md:text-sm text-muted-foreground">
            <p>• Make the best 5-card poker hand.</p>
            <p>• The ⭐️ suit can be used as any of the four standard suits to complete a flush.</p>
            <p>• You can exchange any number of cards up to two times.</p>
            <p className="font-bold mt-4">Hand Rankings (Strongest to Weakest):</p>
            <ol className="list-decimal list-inside space-y-1">
                <li><strong>5-Suit Royal Flush:</strong> A, K, Q, J, 10 in 5 different suits.</li>
                <li><strong>Royal Flush:</strong> A, K, Q, J, 10 in the same suit.</li>
                <li><strong>5-Suit Straight Flush:</strong> Five consecutive cards in 5 different suits.</li>
                <li><strong>Straight Flush:</strong> Five consecutive cards in the same suit.</li>
                <li><strong>Five of a Kind:</strong> Five cards of the same rank (e.g., five 7s).</li>
                <li><strong>Four of a Kind:</strong> Four cards of the same rank.</li>
                <li><strong>Full House:</strong> Three of a kind and a pair.</li>
                <li><strong>Flush:</strong> Five cards of the same suit.</li>
                <li><strong>5-Suit Flush:</strong> Five cards, each of a different suit.</li>
                <li><strong>Straight:</strong> Five consecutive cards of any suit.</li>
                <li><strong>Three of a Kind:</strong> Three cards of the same rank.</li>
                <li><strong>Two Pair:</strong> Two different pairs.</li>
                <li><strong>One Pair:</strong> Two cards of the same rank.</li>
                <li><strong>High Card:</strong> Highest card wins.</li>
            </ol>
        </CardContent>
      </Card>
    </div>
  );
}
