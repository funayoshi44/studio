
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { getCards, deleteCard, type CardData } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import Link from "next/link";

export default function CardListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cards, setCards] = useState<CardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const allCards = await getCards(true); // Force refresh
      setCards(allCards.sort((a, b) => {
        if (a.seriesName && b.seriesName) {
            const seriesCompare = a.seriesName.localeCompare(b.seriesName);
            if (seriesCompare !== 0) return seriesCompare;
        }
        // Fallback or rank sorting
        return (typeof a.rank === 'number' && typeof b.rank === 'number') 
            ? a.rank - b.rank 
            : String(a.rank).localeCompare(String(b.rank));
      }));
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to fetch cards.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  const handleDelete = async (card: CardData) => {
    setIsDeleting(card.id);
    try {
      await deleteCard(card);
      toast({
        title: "Success",
        description: `Card "${card.title}" has been deleted.`,
      });
      // Refetch cards to update the list
      await fetchCards();
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete card.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin" />
        <p className="ml-2">Loading cards...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
                <CardTitle>Manage Cards</CardTitle>
                <CardDescription>View, edit, or delete registered cards.</CardDescription>
            </div>
            <Link href="/admin/cards">
                <Button>Add New Card</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Series</TableHead>
                <TableHead>Suit</TableHead>
                <TableHead>Rank</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cards.length > 0 ? (
                cards.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell>
                      <Image
                        src={card.frontImageUrl}
                        alt={card.title}
                        width={40}
                        height={60}
                        className="rounded-sm object-cover"
                        unoptimized
                      />
                    </TableCell>
                    <TableCell className="font-medium">{card.title}</TableCell>
                    <TableCell>{card.seriesName}</TableCell>
                    <TableCell>{card.suit}</TableCell>
                    <TableCell>{card.rank === 0 ? 'Joker' : card.rank}</TableCell>
                    <TableCell className="text-right">
                       <AlertDialog>
                          <AlertDialogTrigger asChild>
                             <Button variant="destructive" size="icon" disabled={isDeleting === card.id}>
                                {isDeleting === card.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the card
                                "{card.title}" and its image from the servers.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(card)}>
                                Yes, delete it
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">
                    No cards found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
