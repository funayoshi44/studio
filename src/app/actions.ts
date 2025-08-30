
"use server";

import {
  adjustDifficulty,
  type AdjustDifficultyInput,
  type AdjustDifficultyOutput,
} from '@/ai/flows/ai-opponent-difficulty-adjustment';

export async function getAIMove(input: AdjustDifficultyInput): Promise<AdjustDifficultyOutput> {
  try {
    const result = await adjustDifficulty(input);
    if (result.move && result.rationale) {
        return result;
    }
    // Handle cases where the AI might return incomplete data
    throw new Error("AI returned incomplete data.");
  } catch (error) {
    console.error("AI move generation failed:", error);
    // Provide a fallback move in case of an error
    let fallbackMove = "rock"; // Default fallback
    if (input.availableMoves && input.availableMoves.length > 0) {
      fallbackMove = input.availableMoves[Math.floor(Math.random() * input.availableMoves.length)];
    }
    
    return {
      move: fallbackMove,
      rationale: 'A fallback move was selected due to an AI generation error. This was a random choice.',
    };
  }
}
