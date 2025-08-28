
"use client";

import { useState, useContext, useEffect, ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { AuthContext } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Heart, Trash2, Scissors, ImageUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { subscribeToUserPosts, deletePost, togglePostLike, type Post, type CardData, updateMyCards, getJankenActions, setJankenAction, type JankenAction } from "@/lib/firestore";
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { PokerCard } from "@/components/ui/poker-card";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useCardCache } from "@/contexts/card-cache-context";

type JankenMoveType = 'rock' | 'paper' | 'scissors';

const JankenActionEditor = ({ 
    type,
    action,
    onSave
} : {
    type: JankenMoveType,
    action: Partial<JankenAction> | null,
    onSave: (data: { title: string, comment: string }, file: File | null) => Promise<void>
}) => {
    const [title, setTitle] = useState(action?.title || "");
    const [comment, setComment] = useState(action?.comment || "");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(action?.imageUrl || null);
    const [isSaving, setIsSaving] = useState(false);

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        await onSave({ title, comment }, imageFile);
        setIsSaving(false);
    }

    return (
        <Card className="bg-background/50">
            <CardHeader>
                <CardTitle className="capitalize flex items-center gap-2">
                    <Scissors className="w-5 h-5"/> {type}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex justify-center items-center h-40 w-full bg-muted rounded-md overflow-hidden relative">
                    {preview ? (
                        <Image src={preview} alt={`${type} preview`} layout="fill" objectFit="cover" />
                    ) : (
                        <span className="text-muted-foreground text-sm">No Image</span>
                    )}
                 </div>
                 <div className="space-y-1">
                    <Label htmlFor={`${type}-image`}>Image</Label>
                    <Input id={`${type}-image`} type="file" accept="image/*" onChange={handleImageChange} />
                 </div>
                 <div className="space-y-1">
                    <Label htmlFor={`${type}-title`}>Title</Label>
                    <Input id={`${type}-title`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Unstoppable Fist" />
                 </div>
                 <div className="space-y-1">
                    <Label htmlFor={`${type}-comment`}>Comment</Label>
                    <Textarea id={`${type}-comment`} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="A short comment about your move." rows={2}/>
                 </div>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSave} disabled={isSaving} className="w-full">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin"/> : `Save ${type}`}
                 </Button>
            </CardFooter>
        </Card>
    );
};


export default function SettingsPage() {
  const { user, updateUser, loading: authLoading } = useContext(AuthContext);
  const { cards: allCards, loading: cardsLoading } = useCardCache();
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(user?.photoURL || null);
  const [isLoading, setIsLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  // For My Cards
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>(user?.myCards || []);
  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  
  // For Janken Actions
  const [jankenActions, setJankenActions] = useState<{ [key: string]: Partial<JankenAction> }>({});

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
        setDisplayName(user.displayName);
        setBio(user.bio || "");
        setPreview(user.photoURL);
        setSelectedCardIds(user.myCards || []);

        const unsubscribe = subscribeToUserPosts(user.uid, (userPosts) => {
            setPosts(userPosts);
        });

        const fetchInitialData = async () => {
          const actions = await getJankenActions(user.uid);
          setJankenActions(actions);
        }
        fetchInitialData();

        return () => unsubscribe();
    }
  }, [user, authLoading, router]);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProfileImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    try {
      await updateUser({
        displayName,
        bio,
        profileImage,
      });
      toast({
        title: "Success",
        description: "Your profile has been updated.",
      });
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: "Error",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm("Are you sure you want to delete this post?")) {
        try {
            await deletePost(postId);
            toast({ title: "Post deleted" });
        } catch (error) {
            toast({ title: "Error deleting post", variant: "destructive" });
        }
    }
  }

  const handleLikePost = async (postId: string) => {
      if (!user) return;
      try {
        await togglePostLike(postId, user.uid);
      } catch (error) {
          console.error(error)
        toast({ title: "Error liking post", variant: "destructive"})
      }
  }

  const handleCardSelect = (cardId: string) => {
    setSelectedCardIds(prev => {
        if (prev.includes(cardId)) {
            return prev.filter(id => id !== cardId);
        }
        if (prev.length < 3) {
            return [...prev, cardId];
        }
        toast({ title: "You can only select up to 3 cards.", variant: "destructive" });
        return prev;
    });
  }

  const handleSaveMyCards = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
        await updateMyCards(user.uid, selectedCardIds);
        toast({ title: "Success", description: "Your favorite cards have been updated." });
        setIsCardDialogOpen(false);
         // Manually update context user state
        user.myCards = selectedCardIds;
    } catch (error) {
        toast({ title: "Error", description: "Failed to update your cards.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }
  
  const handleSaveJankenAction = async (
      type: JankenMoveType,
      data: { title: string, comment: string },
      file: File | null
  ) => {
      if (!user) return;
      try {
          await setJankenAction(user.uid, type, data, file);
          const newActions = await getJankenActions(user.uid);
          setJankenActions(newActions);
          toast({ title: "Success", description: `Your ${type} action has been updated.` });
      } catch (error) {
          console.error(error);
          toast({ title: "Error", description: `Failed to save ${type} action.`, variant: "destructive" });
      }
  }


  if (authLoading || !user || cardsLoading) {
    return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-8">
            <Card>
                <CardHeader>
                <CardTitle>Profile Settings</CardTitle>
                <CardDescription>Update your profile information here.</CardDescription>
                </CardHeader>
                <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                    <Label htmlFor="displayName">Username</Label>
                    <Input
                        id="displayName"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        required
                    />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                            id="bio"
                            placeholder="Tell us a little about yourself"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                    <Label htmlFor="profile-image">Profile Picture</Label>
                    <div className="flex items-center gap-4">
                        <Link href={`/profile/${user.uid}`}>
                            <Avatar className="w-20 h-20">
                                <AvatarImage src={preview ?? undefined}/>
                                <AvatarFallback>{displayName?.[0]}</AvatarFallback>
                            </Avatar>
                        </Link>
                        <Input
                        id="profile-image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        />
                    </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                    </Button>
                </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>My Cards</CardTitle>
                    <CardDescription>Select up to 3 favorite cards to show on your profile.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full" variant="outline">Select My Cards</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl h-[90vh]">
                            <DialogHeader>
                                <DialogTitle>Select Your Favorite Cards</DialogTitle>
                                <DialogDescription>Choose up to 3 cards. Click a card to select or deselect it.</DialogDescription>
                            </DialogHeader>
                            <div className="overflow-y-auto pr-4 -mr-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 py-4">
                                    {allCards.map(card => (
                                        <div 
                                            key={card.id} 
                                            onClick={() => handleCardSelect(card.id)}
                                            className={cn("cursor-pointer rounded-lg transition-all", selectedCardIds.includes(card.id) && "ring-4 ring-primary ring-offset-2 ring-offset-background")}
                                        >
                                            <PokerCard card={card} revealed={true} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <DialogFooter>
                               <DialogClose asChild>
                                    <Button variant="ghost">Cancel</Button>
                                </DialogClose>
                                <Button onClick={handleSaveMyCards} disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save ({selectedCardIds.length}/3)
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Janken Actions</CardTitle>
                    <CardDescription>Set a custom image, title, and comment for each Janken move.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {(['rock', 'paper', 'scissors'] as JankenMoveType[]).map(move => (
                        <JankenActionEditor
                            key={move}
                            type={move}
                            action={jankenActions[move] || null}
                            onSave={(data, file) => handleSaveJankenAction(move, data, file)}
                         />
                    ))}
                </CardContent>
            </Card>

        </div>

        <div className="md:col-span-2">
            <h2 className="text-2xl font-bold mb-4">Your Posts</h2>
            <div className="space-y-4">
                {posts.length > 0 ? (
                    posts.map(post => (
                        <Card key={post.id}>
                            <CardContent className="p-4">
                                <p className="whitespace-pre-wrap">{post.content}</p>
                            </CardContent>
                            <CardFooter className="flex justify-between items-center p-4 border-t">
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <button onClick={() => handleLikePost(post.id)} className="flex items-center gap-1 hover:text-red-500">
                                        <Heart className={`w-4 h-4 ${post.likes.includes(user.uid) ? 'fill-current text-red-500' : ''}`} /> 
                                        {post.likeCount}
                                    </button>
                                    <span>
                                        {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { locale: ja }) : '...'}
                                    </span>
                                </div>
                                {post.author.uid === user.uid && (
                                    <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    <p className="text-muted-foreground">You haven't posted anything yet.</p>
                )}
            </div>
        </div>
    </div>
  );
}
