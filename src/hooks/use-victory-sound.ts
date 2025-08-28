
"use client";

import { useCallback } from 'react';

// This hook creates a function to play a simple victory sound.
// It uses the Web Audio API to avoid needing an external audio file.
export const useVictorySound = () => {
    const playSound = useCallback(() => {
        if (typeof window !== 'undefined' && window.AudioContext) {
            const audioContext = new window.AudioContext();
            
            // Create an oscillator node for the sound wave
            const oscillator = audioContext.createOscillator();
            // Create a gain node to control the volume
            const gainNode = audioContext.createGain();

            // Connect oscillator to gain node, and gain node to output
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Sound properties
            oscillator.type = 'sine'; // A smooth, clean tone
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);

            // A series of ascending notes for a "victory" feel
            const now = audioContext.currentTime;
            oscillator.frequency.setValueAtTime(523.25, now); // C5
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);

            oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
            oscillator.frequency.setValueAtTime(783.99, now + 0.2); // G5
            oscillator.frequency.setValueAtTime(1046.50, now + 0.3); // C6

            // Start the sound
            oscillator.start(now);
            
            // Fade out and stop the sound
            gainNode.gain.exponentialRampToValueAtTime(0.00001, now + 0.5);
            oscillator.stop(now + 0.5);

            // Clean up the context after a short delay
            setTimeout(() => {
                if (audioContext.state !== 'closed') {
                    audioContext.close();
                }
            }, 1000);
        }
    }, []);

    return playSound;
};
