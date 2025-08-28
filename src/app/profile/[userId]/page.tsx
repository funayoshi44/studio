
"use client";

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getUserProfile, subscribeToUserPosts, deletePost, togglePostLike, type Post, type MockUser } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Heart, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function UserProfilePage() {
    const params = useParams();
    const userId = params.userId as string;
    const { user: currentUser } = useAuth(); // The currently logged-in user
    const { toast } = useToast();

    const [profileUser, setProfileUser] = useState<MockUser | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const fetchUser = async () => {
            setLoading(true);
            try {
                const userProfile = await getUserProfile(userId);
                if (userProfile) {
                    setProfileUser(userProfile);
                } else {
                    toast({ title: "User not found", variant: "destructive" });
                }
            } catch (error) {
                console.error("Error fetching user profile:", error);
                toast({ title: "Error fetching profile", variant: "destructive" });
            } finally {
                setLoading(false);
            }
        };

        fetchUser();

        const unsubscribePosts = subscribeToUserPosts(userId, (userPosts) => {
            // Sort posts by creation date (newest first) on the client side
            const sortedPosts = [...userPosts].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
            setPosts(sortedPosts);
        });

        return () => unsubscribePosts();
    }, [userId, toast]);
    
    const handleLikePost = async (postId: string) => {
        if (!currentUser) return;
        try {
            await togglePostLike(postId, currentUser.uid);
        } catch (error) {
            console.error(error);
            toast({ title: "Error liking post", variant: "destructive"});
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
    };


    if (loading) {
        return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
    }
    
    if (!profileUser) {
        return <div className="text-center py-10">User profile not found.</div>;
    }


    return (
        <div className="max-w-4xl mx-auto">
            <Card className="mb-8">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <Avatar className="w-32 h-32 border-4 border-primary">
                            <AvatarImage src={profileUser.photoURL} alt={profileUser.displayName} />
                            <AvatarFallback className="text-4xl">{profileUser.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-4xl font-bold">{profileUser.displayName}</h1>
                            {profileUser.bio && <p className="mt-2 text-lg text-muted-foreground">{profileUser.bio}</p>}
                            {currentUser?.uid === userId && (
                                <Link href="/settings" passHref>
                                    <Button variant="outline" className="mt-4">Edit Profile</Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <h2 className="text-2xl font-bold mb-4">Posts by {profileUser.displayName}</h2>
             <div className="space-y-4">
                {posts.length > 0 ? (
                    posts.map(post => (
                        <Card key={post.id}>
                            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <Link href={`/profile/${post.author.uid}`}>
                                    <Avatar>
                                        <AvatarImage src={post.author.photoURL ?? undefined} />
                                        <AvatarFallback>{post.author.displayName?.[0]}</AvatarFallback>
                                    </Avatar>
                               </Link>
                                <div className="flex-1">
                                    <Link href={`/profile/${post.author.uid}`} className="font-bold hover:underline">{post.author.displayName}</Link>
                                    <p className="text-xs text-muted-foreground">
                                        {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true, locale: ja }) : '...'}
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="whitespace-pre-wrap">{post.content}</p>
                            </CardContent>
                            <CardFooter className="flex justify-between items-center border-t pt-2">
                                <button onClick={() => handleLikePost(post.id)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-red-500" disabled={!currentUser}>
                                    <Heart className={`w-4 h-4 ${currentUser && post.likes.includes(currentUser.uid) ? 'fill-current text-red-500' : ''}`} /> 
                                    {post.likeCount}
                                </button>
                                {currentUser?.uid === post.author.uid && (
                                    <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground py-8">{profileUser.displayName} has not posted anything yet.</p>
                )}
            </div>

        </div>
    );
}
