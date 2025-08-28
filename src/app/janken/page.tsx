
"use client";

import { useState, useContext, useEffect, useMemo } from 'react';
import { GameContext } from '@/contexts/game-context';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/hooks/use-translation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAIMove } from '../actions';
import type { AdjustDifficultyInput } from '@/ai/flows/ai-opponent-difficulty-adjustment';
import Link from 'next/link';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Lightbulb, Loader2 } from 'lucide-react';
import { getJankenActions, type JankenAction } from '@/lib/firestore';
import Image from 'next/image';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useVictorySound } from '@/hooks/use-victory-sound';
import { VictoryAnimation } from '@/components/victory-animation';


type Move = 'rock' | 'paper' | 'scissors';
const moves: Move[] = ['rock', 'paper', 'scissors'];

type JankenState = {
  round: number;
  playerScore: number;
  cpuScore: number;
  phase: 'initial' | 'final' | 'result';
  playerFirstMove: Move | null;
  cpuFirstMove: Move | null;
  playerFinalMove: Move | null;
  cpuFinalMove: Move | null;
  resultText: string;
  aiRationale: string | null;
  isVictory: boolean;
};

const initialJankenState: JankenState = {
  round: 1,
  playerScore: 0,
  cpuScore: 0,
  phase: 'initial',
  playerFirstMove: null,
  cpuFirstMove: null,
  playerFinalMove: null,
  cpuFinalMove: null,
  resultText: '',
  aiRationale: null,
  isVictory: false,
};

const JankenMoveButton = ({ action, move, onSelect, disabled }: { action?: JankenAction, move: Move, onSelect: (move: Move) => void, disabled: boolean }) => {
    const getJankenEmoji = (move: Move) => {
        if (!move) return '?';
        const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
        return emojiMap[move];
    };
    
    const content = action ? (
        <div className="relative w-full h-full">
            <Image src={action.imageUrl} alt={action.title} layout="fill" objectFit="cover" className="rounded-md" />
        </div>
    ) : (
        <span className="text-4xl">{getJankenEmoji(move)}</span>
    );
    
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button onClick={() => onSelect(move)} size="lg" className="w-24 h-24 p-0" disabled={disabled}>
                        {content}
                    </Button>
                </TooltipTrigger>
                {action && (
                    <TooltipContent>
                        <p className="font-bold">{action.title}</p>
                        <p className="text-sm text-muted-foreground">{action.comment}</p>
                    </TooltipContent>
                )}
            </Tooltip>
        </TooltipProvider>
    )
}

const JankenMoveSelector = ({ onSelect, disabled, jankenActions, isLoading }: { onSelect: (move: Move) => void; disabled: boolean, jankenActions: { [key in Move]?: JankenAction }, isLoading: boolean }) => {
    if (isLoading) {
        return <Loader2 className="w-8 h-8 animate-spin mx-auto" />
    }
    
    return (
        <div className="flex justify-center space-x-4">
        {moves.map(move => (
            <JankenMoveButton 
                key={move}
                move={move}
                action={jankenActions[move]}
                onSelect={onSelect}
                disabled={disabled}
            />
        ))}
        </div>
    )
}

export default function JankenPage() {
  const { difficulty, recordGameResult } = useContext(GameContext);
  const { user } = useAuth();
  const { t } = useTranslation();
  const [state, setState] = useState<JankenState>(initialJankenState);
  const [loading, setLoading] = useState(false);
  const [jankenActions, setJankenActions] = useState<{ [key in Move]?: JankenAction }>({});
  const [loadingActions, setLoadingActions] = useState(true);
  const playVictorySound = useVictorySound();

  useEffect(() => {
    const loadJankenActions = async () => {
        if (!user) {
            setLoadingActions(false);
            return;
        };
        setLoadingActions(true);
        const actions = await getJankenActions(user.uid);
        setJankenActions(actions);
        setLoadingActions(false);
    }
    loadJankenActions();
  }, [user]);

  const selectInitialMove = async (move: Move) => {
    setLoading(true);
    
    const aiInput: AdjustDifficultyInput = {
      gameType: 'janken',
      difficulty: difficulty,
      gameState: { phase: 'initial' },
      availableMoves: moves,
    };
    const aiResponse = await getAIMove(aiInput);
    let cpuMove = aiResponse.move as Move;
     if (!moves.includes(cpuMove)) {
        cpuMove = moves[Math.floor(Math.random() * moves.length)];
    }

    setState(prev => ({
      ...prev,
      playerFirstMove: move,
      cpuFirstMove: cpuMove,
      phase: 'final',
      aiRationale: null, // Clear rationale for the next stage
    }));
    setLoading(false);
  };

  const selectFinalMove = async (move: Move) => {
    setLoading(true);

    const aiInput: AdjustDifficultyInput = {
      gameType: 'janken',
      difficulty: difficulty,
      gameState: { 
        phase: 'final',
        playerFirstMove: state.playerFirstMove,
        cpuFirstMove: state.cpuFirstMove,
      },
      availableMoves: moves,
      playerPreviousMove: state.playerFirstMove as string,
    };
    const aiResponse = await getAIMove(aiInput);
    let cpuFinalMove = aiResponse.move as Move;
    if (!moves.includes(cpuFinalMove)) {
        cpuFinalMove = moves[Math.floor(Math.random() * moves.length)];
    }

    setState(prev => ({ ...prev, aiRationale: aiResponse.rationale }));
    evaluateRound(move, cpuFinalMove);
    setLoading(false);
  };

  const checkWin = (move1: Move, move2: Move) => {
    return (
      (move1 === 'rock' && move2 === 'scissors') ||
      (move1 === 'paper' && move2 === 'rock') ||
      (move1 === 'scissors' && move2 === 'paper')
    );
  };

  const evaluateRound = (playerFinalMove: Move, cpuFinalMove: Move) => {
    const playerChanged = state.playerFirstMove !== playerFinalMove;
    const cpuChanged = state.cpuFirstMove !== cpuFinalMove;
    
    let result = '';
    let winner: 'player' | 'cpu' | 'draw' = 'draw';

    if (playerChanged && !checkWin(playerFinalMove, cpuFinalMove) && playerFinalMove !== cpuFinalMove) {
        result = t('penaltyLoss');
        winner = 'cpu';
    } else if (cpuChanged && !checkWin(cpuFinalMove, playerFinalMove) && playerFinalMove !== cpuFinalMove) {
        result = t('penaltyWin');
        winner = 'player';
    } else if (checkWin(playerFinalMove, cpuFinalMove)) {
        result = t('youWin');
        winner = 'player';
    } else if (checkWin(cpuFinalMove, playerFinalMove)) {
        result = t('cpuWins');
        winner = 'cpu';
    } else {
        result = t('draw');
        winner = 'draw';
    }
    
    let isVictory = false;
    if(winner === 'player') {
      recordGameResult('janken', 'win');
      playVictorySound();
      isVictory = true;
    }
    if(winner === 'cpu') {
      recordGameResult('janken', 'loss');
    }

    setState(prev => ({
        ...prev,
        playerFinalMove,
        cpuFinalMove,
        resultText: result,
        phase: 'result',
        playerScore: prev.playerScore + (winner === 'player' ? 1 : 0),
        cpuScore: prev.cpuScore + (winner === 'cpu' ? 1 : 0),
        isVictory: isVictory,
    }));
  };

  const nextRound = () => {
    setState(prev => ({
      ...initialJankenState,
      round: prev.round + 1,
      playerScore: prev.playerScore,
      cpuScore: prev.cpuScore,
    }));
  };
  
  const ScoreDisplay = () => (
    <div className="flex justify-center space-x-4 md:space-x-8 text-lg mb-4">
        <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-lg font-bold">{t('you')}: {state.playerScore} {t('wins')}</div>
        <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-lg font-bold">{t('cpu')}: {state.cpuScore} {t('wins')}</div>
    </div>
  );
  
  const MoveDisplay = ({ move, owner }: { move: Move | null, owner: 'player' | 'cpu' }) => {
    const getJankenEmoji = (move: Move) => {
        if (!move) return '?';
        const emojiMap = { rock: '✊', paper: '✋', scissors: '✌️' };
        return emojiMap[move];
    };
      
    if (!move) {
      return (
        <div className="w-24 h-32 flex items-center justify-center text-4xl bg-gray-200 dark:bg-gray-700 rounded-lg">?</div>
      )
    }

    const action = owner === 'player' ? jankenActions[move] : undefined;

    if (action) {
      return (
          <div className="relative w-24 h-32">
              <Image src={action.imageUrl} alt={action.title} layout="fill" objectFit="cover" className="rounded-lg" />
          </div>
      );
    }
    return (
        <div className="w-24 h-32 flex items-center justify-center text-6xl bg-gray-200 dark:bg-gray-700 rounded-lg">
            {getJankenEmoji(move)}
        </div>
    );
  };


  return (
    <div className="text-center">
      {state.isVictory && <VictoryAnimation />}
      <h2 className="text-3xl font-bold mb-2">{t('jankenTitle')}</h2>
      <div className="mb-4 text-muted-foreground">
        <span>{t('round')} {state.round}</span>
        <span className="mx-2">|</span>
        <span>{t('cpu')}: <span className="font-semibold capitalize">{t(difficulty)}</span></span>
      </div>
      <ScoreDisplay />

      {state.phase === 'initial' && (
        <Card className="max-w-md mx-auto my-8">
          <CardHeader><CardTitle>{t('jankenPhase1Title')}</CardTitle></CardHeader>
          <CardContent>
            <JankenMoveSelector onSelect={selectInitialMove} disabled={loading} jankenActions={jankenActions} isLoading={loadingActions} />
          </CardContent>
        </Card>
      )}

      {state.phase === 'final' && (
        <div className="my-8">
            <h3 className="text-xl font-bold mb-4">{t('firstMoves')}</h3>
            <div className="flex justify-center space-x-8 text-4xl mb-8">
                <div>
                    <p className="text-lg">{t('you')}</p>
                    <MoveDisplay move={state.playerFirstMove} owner='player' />
                </div>
                <div>
                    <p className="text-lg">{t('cpu')}</p>
                    <MoveDisplay move={state.cpuFirstMove} owner='cpu' />
                </div>
            </div>
            <Card className="max-w-md mx-auto">
                <CardHeader><CardTitle>{t('jankenPhase2Title')}</CardTitle></CardHeader>
                <CardContent>
                   <JankenMoveSelector onSelect={selectFinalMove} disabled={loading} jankenActions={jankenActions} isLoading={loadingActions}/>
                </CardContent>
            </Card>
        </div>
      )}

      {state.phase === 'result' && (
        <div className="my-8">
          <h3 className="text-xl font-bold mb-4">{t('finalResult')}</h3>
          <div className="flex justify-center space-x-8 text-4xl mb-4">
            <div>
              <p className="text-lg">{t('you')}</p>
              <MoveDisplay move={state.playerFinalMove} owner='player' />
              <p className="text-sm">{state.playerFirstMove !== state.playerFinalMove ? t('changed') : t('noChange')}</p>
            </div>
            <div>
              <p className="text-lg">{t('cpu')}</p>
              <MoveDisplay move={state.cpuFinalMove} owner='cpu' />
              <p className="text-sm">{state.cpuFirstMove !== state.cpuFinalMove ? t('changed') : t('noChange')}</p>
            </div>
          </div>
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
          <Button onClick={nextRound} size="lg">{t('nextRound')}</Button>
        </div>
      )}
      
      <div className="flex justify-center mt-8">
          <Link href="/" passHref>
              <Button variant="secondary">{t('backToMenu')}</Button>
          </Link>
      </div>

      <Card className="max-w-4xl mx-auto mt-12 text-left bg-card/50">
        <CardHeader><CardTitle>📖 {t('jankenTitle')} Rules</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. First, both players choose a move simultaneously.</p>
          <p>2. Then, you can choose to change your move or stick with it.</p>
          <p>3. <strong>Chicken Rule:</strong> If you change your move and it doesn't beat the opponent's final move, you automatically lose (a draw becomes a loss). This applies to the CPU too!</p>
        </CardContent>
      </Card>
    </div>
  );
}
