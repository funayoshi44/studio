
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
import { Loader2, Heart, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { subscribeToUserPosts, deletePost, togglePostLike, type Post } from "@/lib/firestore";
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function SettingsPage() {
  const { user, updateUser, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(user?.photoURL || null);
  const [isLoading, setIsLoading] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
        setDisplayName(user.displayName);
        setBio(user.bio || "");
        setPreview(user.photoURL);

        const unsubscribe = subscribeToUserPosts(user.uid, (userPosts) => {
            const sortedPosts = [...userPosts].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setPosts(sortedPosts);
        });
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


  if (authLoading || !user) {
    return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  }

  return (
    <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
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
                                        {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true, locale: ja }) : '...'}
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
