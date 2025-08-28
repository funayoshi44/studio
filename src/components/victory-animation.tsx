
"use client";

import { useEffect, useState } from 'react';

// A component that renders a confetti-like animation on mount.
// It creates a specified number of confetti elements and removes them after the animation ends.
export const VictoryAnimation = ({ numConfetti = 50 }: { numConfetti?: number }) => {
    const [confetti, setConfetti] = useState<{ id: number, style: React.CSSProperties }[]>([]);

    useEffect(() => {
        const createConfetti = () => {
            const newConfetti = Array.from({ length: numConfetti }).map((_, i) => ({
                id: i,
                style: {
                    left: `${Math.random() * 100}vw`,
                    animationDelay: `${Math.random() * 2}s`,
                    backgroundColor: `hsl(${Math.random() * 360}, 100%, 50%)`,
                    transform: `scale(${Math.random() * 0.5 + 0.5})`
                }
            }));
            setConfetti(newConfetti);
        };

        createConfetti();

        // Clean up the confetti elements from the DOM after animation
        const timer = setTimeout(() => {
            setConfetti([]);
        }, 5000); // 3s animation + 2s delay buffer

        return () => clearTimeout(timer);
    }, [numConfetti]);

    return (
        <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-50 overflow-hidden">
            {confetti.map(c => (
                <div key={c.id} className="confetti" style={c.style} />
            ))}
        </div>
    );
};
