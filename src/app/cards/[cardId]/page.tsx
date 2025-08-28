
"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getCardById, type CardData } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, User, Tag, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function CardDetailPage() {
    const params = useParams();
    const cardId = params.cardId as string;
    const { toast } = useToast();

    const [card, setCard] = useState<CardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!cardId) return;

        const fetchCard = async () => {
            setLoading(true);
            try {
                const cardData = await getCardById(cardId);
                if (cardData) {
                    setCard(cardData);
                } else {
                    toast({ title: "Card not found", variant: "destructive" });
                }
            } catch (error) {
                console.error("Error fetching card:", error);
                toast({ title: "Error fetching card", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        fetchCard();
    }, [cardId, toast]);


    if (loading) {
        return <div className="text-center py-20"><Loader2 className="w-12 h-12 animate-spin mx-auto" /></div>;
    }

    if (!card) {
        return (
            <div className="text-center py-20">
                <h2 className="text-2xl font-bold">Card Not Found</h2>
                <p className="text-muted-foreground">The card you are looking for does not exist.</p>
                <Link href="/" passHref>
                    <Button variant="link" className="mt-4">Back to Home</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4">
            <Card>
                <CardContent className="grid md:grid-cols-2 gap-8 p-6">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border">
                            <Image src={card.frontImageUrl} alt={card.title} layout="fill" objectFit="cover" unoptimized/>
                        </div>
                        {card.backImageUrl && (
                            <div className="relative w-1/2 aspect-[2/3] rounded-lg overflow-hidden border">
                                <Image src={card.backImageUrl} alt={`${card.title} back`} layout="fill" objectFit="cover" unoptimized/>
                            </div>
                        )}
                    </div>
                    <div className="space-y-6">
                        <div>
                            <p className="text-sm text-muted-foreground">{card.seriesName}</p>
                            <h1 className="text-4xl font-bold">{card.title}</h1>
                            <p className="text-lg text-muted-foreground">Rank: {card.rank} {card.suit}</p>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <User className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Author</p>
                                    <p className="font-semibold">{card.authorName}</p>
                                </div>
                            </div>

                             <div className="flex items-center gap-3">
                                <BookOpen className="w-5 h-5 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Series</p>
                                    <p className="font-semibold">{card.seriesName}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="font-bold mb-2">Caption</h3>
                            <p className="text-muted-foreground whitespace-pre-wrap">{card.caption}</p>
                        </div>

                         {card.hashtags && card.hashtags.length > 0 && (
                            <div>
                                <h3 className="font-bold mb-2">Tags</h3>
                                <div className="flex flex-wrap gap-2">
                                    {card.hashtags.map(tag => (
                                        <Badge key={tag} variant="secondary">{tag}</Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {card.detailPageUrl && (
                             <Button asChild>
                                <a href={card.detailPageUrl} target="_blank" rel="noopener noreferrer">
                                    View Original Page
                                </a>
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
