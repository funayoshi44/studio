
"use client";

import { useState } from "react";
import { useForm, SubmitHandler, Controller } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { addCard } from "@/lib/firestore";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GameType } from "@/lib/types";

type Inputs = {
  name: string;
  artist: string;
  suit: string;
  number: number;
  value: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  gameType: GameType | 'common';
  tags: string; // Comma-separated
  image: FileList;
};

export default function AddCardPage() {
  const { register, handleSubmit, formState: { errors }, reset, control } = useForm<Inputs>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsLoading(true);
    try {
      const { image, tags, ...cardData } = data;
      const imageFile = image[0];
      const tagsArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);

      if (!imageFile) {
        throw new Error("Image file is required.");
      }

      await addCard({ ...cardData, tags: tagsArray }, imageFile);

      toast({
        title: "Success!",
        description: `Card "${data.name}" has been added to the database.`,
      });
      reset(); // Reset form fields
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add card.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Add New Card</CardTitle>
          <CardDescription>
            Fill out the form to add a new card to the database and upload its image.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Name */}
                <div className="space-y-2">
                <Label htmlFor="name">Card Name</Label>
                <Input id="name" {...register("name", { required: "Name is required" })} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>

                {/* Artist Name */}
                <div className="space-y-2">
                <Label htmlFor="artist">Artist</Label>
                <Input id="artist" {...register("artist", { required: "Artist is required" })} />
                {errors.artist && <p className="text-xs text-destructive">{errors.artist.message}</p>}
                </div>

                {/* Suit */}
                <div className="space-y-2">
                <Label htmlFor="suit">Suit</Label>
                <Input id="suit" {...register("suit", { required: "Suit is required" })} />
                {errors.suit && <p className="text-xs text-destructive">{errors.suit.message}</p>}
                </div>

                {/* Rarity */}
                <div className="space-y-2">
                    <Label htmlFor="rarity">Rarity</Label>
                     <Controller
                        name="rarity"
                        control={control}
                        rules={{ required: "Rarity is required" }}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select rarity" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="common">Common</SelectItem>
                                    <SelectItem value="uncommon">Uncommon</SelectItem>
                                    <SelectItem value="rare">Rare</SelectItem>
                                    <SelectItem value="legendary">Legendary</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.rarity && <p className="text-xs text-destructive">{errors.rarity.message}</p>}
                </div>

                {/* Number */}
                <div className="space-y-2">
                <Label htmlFor="number">Number</Label>
                <Input id="number" type="number" {...register("number", { required: "Number is required", valueAsNumber: true })} />
                {errors.number && <p className="text-xs text-destructive">{errors.number.message}</p>}
                </div>

                {/* Value */}
                <div className="space-y-2">
                <Label htmlFor="value">Value</Label>
                <Input id="value" type="number" {...register("value", { required: "Value is required", valueAsNumber: true })} />
                {errors.value && <p className="text-xs text-destructive">{errors.value.message}</p>}
                </div>

                {/* Game Type */}
                <div className="space-y-2">
                    <Label htmlFor="gameType">Game Type</Label>
                     <Controller
                        name="gameType"
                        control={control}
                        rules={{ required: "Game type is required" }}
                        render={({ field }) => (
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select game type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="common">Common</SelectItem>
                                    <SelectItem value="duel">Duel</SelectItem>
                                    <SelectItem value="poker">Poker</SelectItem>
                                    <SelectItem value="janken">Janken</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.gameType && <p className="text-xs text-destructive">{errors.gameType.message}</p>}
                </div>

                 {/* Tags */}
                <div className="space-y-2">
                    <Label htmlFor="tags">Tags (comma-separated)</Label>
                    <Input id="tags" {...register("tags")} placeholder="e.g. dragon, fire, sky" />
                </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image">Card Image</Label>
              <Input id="image" type="file" accept="image/*" {...register("image", { required: "Image is required" })} className="pt-2 text-sm" />
              {errors.image && <p className="text-xs text-destructive">{errors.image.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Add Card"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
