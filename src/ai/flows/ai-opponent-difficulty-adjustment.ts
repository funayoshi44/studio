'use server';
/**
 * @fileOverview An AI opponent difficulty adjustment agent.
 *
 * - adjustDifficulty - A function that adjusts the difficulty of the AI opponent.
 * - AdjustDifficultyInput - The input type for the adjustDifficulty function.
 * - AdjustDifficultyOutput - The return type for the adjustDifficulty function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AdjustDifficultyInputSchema = z.object({
  gameType: z
    .string()
    .describe("The type of game being played (e.g., 'duel', 'janken', 'poker')."),
  difficulty: z
    .string()
    .describe("The difficulty level selected by the user (e.g., 'easy', 'normal', 'hard')."),
  gameState: z.any().describe('The current state of the game.'),
  availableMoves: z.array(z.string()).optional().describe('The list of available moves for AI'),
  playerPreviousMove: z.string().optional().describe('The previous move made by the player, if any.'),
  cpuPreviousMove: z.string().optional().describe('The previous move made by the CPU, if any.'),
});
export type AdjustDifficultyInput = z.infer<typeof AdjustDifficultyInputSchema>;

const AdjustDifficultyOutputSchema = z.object({
  move: z.string().describe('The AI opponent’s adjusted move based on the difficulty level.'),
  rationale: z
    .string()
    .describe('The reasoning behind the AI opponent’s move selection.'),
});
export type AdjustDifficultyOutput = z.infer<typeof AdjustDifficultyOutputSchema>;

export async function adjustDifficulty(input: AdjustDifficultyInput): Promise<AdjustDifficultyOutput> {
  return adjustDifficultyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adjustDifficultyPrompt',
  input: {schema: AdjustDifficultyInputSchema},
  output: {schema: AdjustDifficultyOutputSchema},
  prompt: `You are an AI game strategist. Your role is to determine the best move for the CPU opponent in a card game, taking into account the game type, difficulty level, current game state, available moves, the player's previous move, and the CPU's previous move.

Game Type: {{{gameType}}}
Difficulty Level: {{{difficulty}}}
Current Game State: {{{gameState}}}
Available Moves: {{#if availableMoves}}{{#each availableMoves}}{{{this}}} {{/each}}{{else}}None{{/if}}
Player's Previous Move: {{playerPreviousMove}}
CPU's Previous Move: {{cpuPreviousMove}}

Based on the information above, select the best move for the CPU opponent and explain your rationale. The move must be one of availableMoves if provided.

Output:
Move: [The AI opponent's selected move]
Rationale: [Explanation of why this move was chosen]`,
});

const adjustDifficultyFlow = ai.defineFlow(
  {
    name: 'adjustDifficultyFlow',
    inputSchema: AdjustDifficultyInputSchema,
    outputSchema: AdjustDifficultyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
