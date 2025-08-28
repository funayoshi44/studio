
"use client";

import { useState, useEffect } from "react";
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
import { addCard, getSeries } from "@/lib/firestore";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { Textarea } from "@/components/ui/textarea";
import type { CardSeries } from "@/lib/types";

type Inputs = {
  title: string;
  caption: string;
  seriesName: string;
  suit: string;
  rank: string;
  hashtags: string; // Comma-separated
  image: FileList;
  backImage?: FileList;
  authorName: string;
  detailPageUrl?: string;
};

export default function AddCardPage() {
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors }, reset, control } = useForm<Inputs>();
  const [isLoading, setIsLoading] = useState(false);
  const [series, setSeries] = useState<CardSeries[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const fetchSeries = async () => {
        try {
            const seriesData = await getSeries();
            setSeries(seriesData);
        } catch (error) {
            console.error("Failed to fetch series:", error);
            toast({ title: "Error", description: "Could not fetch series list.", variant: "destructive" });
        }
    };
    fetchSeries();
  }, [toast]);

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    if (!user) {
        toast({ title: "Error", description: "You must be logged in to add a card.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
      const { image, backImage, hashtags, rank, ...cardDetails } = data;
      const imageFile = image[0];
      const backImageFile = backImage?.[0];
      const hashtagsArray = hashtags.split(',').map(tag => tag.trim()).filter(Boolean);
      
      const rankNumberOrString = rank === 'Joker' ? 'Joker' : parseInt(rank, 10);
      if (typeof rankNumberOrString === 'number' && isNaN(rankNumberOrString)) {
          throw new Error("Invalid rank provided.");
      }

      if (!imageFile) {
        throw new Error("Image file is required.");
      }
      
      const newCardData = {
          ...cardDetails,
          rank: rankNumberOrString,
          hashtags: hashtagsArray,
      }

      await addCard(newCardData, imageFile, user, backImageFile);

      toast({
        title: "Success!",
        description: `Card "${data.title}" has been added to the database.`,
      });
      router.push('/admin/cards/list'); // Redirect to the list page
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
                {/* Card Title */}
                <div className="space-y-2">
                <Label htmlFor="title">Card Title</Label>
                <Input id="title" {...register("title", { required: "Title is required" })} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
                </div>

                {/* Author Name */}
                <div className="space-y-2">
                    <Label htmlFor="authorName">Author Name</Label>
                    <Input id="authorName" {...register("authorName")} placeholder="e.g. John Doe" />
                </div>

                {/* Series Name */}
                <div className="space-y-2">
                    <Label htmlFor="seriesName">Series Name</Label>
                     <Controller
                        name="seriesName"
                        control={control}
                        rules={{ required: "Series is required" }}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a series" />
                                </SelectTrigger>
                                <SelectContent>
                                    {series.map(s => (
                                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.seriesName && <p className="text-xs text-destructive">{errors.seriesName.message}</p>}
                </div>


                {/* Suit */}
                <div className="space-y-2">
                    <Label htmlFor="suit">Suit</Label>
                    <Controller
                        name="suit"
                        control={control}
                        rules={{ required: "Suit is required" }}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select suit" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="spade">Spade ♠️</SelectItem>
                                    <SelectItem value="heart">Heart ♥️</SelectItem>
                                    <SelectItem value="diamond">Diamond ♦️</SelectItem>
                                    <SelectItem value="club">Club ♣️</SelectItem>
                                    <SelectItem value="star">Star ⭐</SelectItem>
                                    <SelectItem value="joker">Joker</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.suit && <p className="text-xs text-destructive">{errors.suit.message}</p>}
                </div>
                
                {/* Rank */}
                <div className="space-y-2">
                    <Label htmlFor="rank">Rank</Label>
                    <Controller
                        name="rank"
                        control={control}
                        rules={{ required: "Rank is required" }}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select rank" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 13 }, (_, i) => i + 1).map(n => (
                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                    ))}
                                    <SelectItem value="Joker">Joker</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.rank && <p className="text-xs text-destructive">{errors.rank.message}</p>}
                </div>

                {/* Detail Page URL */}
                <div className="space-y-2">
                    <Label htmlFor="detailPageUrl">Detail Page URL</Label>
                    <Input id="detailPageUrl" type="url" {...register("detailPageUrl")} placeholder="https://example.com/card/1" />
                </div>


                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="caption">Caption</Label>
                    <Textarea
                        id="caption"
                        rows={3}
                        {...register("caption", { required: "Caption is required" })}
                    />
                    {errors.caption && <p className="text-xs text-destructive">{errors.caption.message}</p>}
                </div>
                
                 {/* Hashtags */}
                <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="hashtags">Hashtags (comma-separated)</Label>
                    <Input id="hashtags" {...register("hashtags")} placeholder="e.g. dragon, fire, sky" />
                </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image">Card Image (Front)</Label>
                <Input id="image" type="file" accept="image/*" {...register("image", { required: "Image is required" })} className="pt-2 text-sm" />
                {errors.image && <p className="text-xs text-destructive">{errors.image.message}</p>}
              </div>
               <div className="space-y-2">
                <Label htmlFor="backImage">Card Image (Back) (Optional)</Label>
                <Input id="backImage" type="file" accept="image/*" {...register("backImage")} className="pt-2 text-sm" />
              </div>
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
