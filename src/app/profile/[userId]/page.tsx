
"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { getUserProfile, subscribeToUserPosts, deletePost, togglePostLike, type Post, type MockUser, getOrCreateChatRoom, getCards, type CardData, getJankenActions, JankenAction } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Heart, Trash2, Send, Award, Scissors } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PokerCard } from '@/components/ui/poker-card';
import Image from 'next/image';

export default function UserProfilePage() {
    const params = useParams();
    const userId = params.userId as string;
    const { user: currentUser } = useAuth(); // The currently logged-in user
    const { toast } = useToast();
    const router = useRouter();

    const [profileUser, setProfileUser] = useState<MockUser | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [myCards, setMyCards] = useState<CardData[]>([]);
    const [jankenActions, setJankenActions] = useState<{[key: string]: JankenAction}>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const fetchAllData = async () => {
            setLoading(true);
            try {
                const userProfile = await getUserProfile(userId);
                if (userProfile) {
                    setProfileUser(userProfile);
                    if (userProfile.myCards && userProfile.myCards.length > 0) {
                        const allCards = await getCards();
                        const userMyCards = allCards.filter(card => userProfile.myCards!.includes(card.id));
                        setMyCards(userMyCards);
                    }
                    const userJankenActions = await getJankenActions(userId);
                    setJankenActions(userJankenActions);
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

        fetchAllData();

        const unsubscribePosts = subscribeToUserPosts(userId, (userPosts) => {
            // Sort posts by creation date client-side
            const sortedPosts = userPosts.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
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
    
    const handleStartChat = async () => {
        if (!currentUser || !profileUser || currentUser.uid === profileUser.uid) return;
        try {
            const chatRoomId = await getOrCreateChatRoom(currentUser.uid, profileUser.uid);
            router.push(`/chat/${chatRoomId}`);
        } catch (error) {
            console.error("Failed to start chat:", error);
            toast({ title: "Could not start chat", variant: "destructive" });
        }
    };

    const JankenHandDisplay = ({ action }: { action: JankenAction }) => (
        <div className="flex flex-col items-center gap-2">
            <div className="relative w-40 h-40 rounded-lg overflow-hidden border">
                <Image src={action.imageUrl} alt={action.title} layout="fill" objectFit="cover" />
            </div>
            <div className="text-center">
                <p className="font-bold">{action.title}</p>
                <p className="text-sm text-muted-foreground">{action.comment}</p>
            </div>
        </div>
    );


    if (loading) {
        return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
    }
    
    if (!profileUser) {
        return <div className="text-center py-10">User profile not found.</div>;
    }

    const hasJankenActions = Object.keys(jankenActions).length > 0;

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="mb-8">
                <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <Avatar className="w-32 h-32 border-4 border-primary">
                            <AvatarImage src={profileUser.photoURL ?? undefined} alt={profileUser.displayName ?? ""} />
                            <AvatarFallback className="text-4xl">{profileUser.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-4xl font-bold">{profileUser.displayName}</h1>
                            {profileUser.bio && <p className="mt-2 text-lg text-muted-foreground">{profileUser.bio}</p>}
                             <div className="flex items-center justify-center md:justify-start gap-2 mt-3 text-lg font-semibold text-amber-500">
                                <Award />
                                <span>{profileUser.points ?? 0} Points</span>
                            </div>
                            {currentUser?.uid === userId ? (
                                <Link href="/settings" passHref>
                                    <Button variant="outline" className="mt-4">Edit Profile</Button>
                                </Link>
                            ) : currentUser && (
                                <Button onClick={handleStartChat} className="mt-4">
                                    <Send className="mr-2 h-4 w-4" /> Message
                                </Button>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {myCards.length > 0 && (
                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>My Cards</CardTitle>
                        <CardDescription>{profileUser.displayName}'s favorite cards.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-center md:justify-start gap-4 flex-wrap">
                            {myCards.map(card => (
                                <PokerCard key={card.id} card={card} revealed={true} />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {hasJankenActions && (
                 <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>My Hands</CardTitle>
                        <CardDescription>{profileUser.displayName}'s custom Janken actions.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex justify-around md:justify-start gap-4 flex-wrap">
                             {jankenActions.rock && <JankenHandDisplay action={jankenActions.rock} />}
                             {jankenActions.paper && <JankenHandDisplay action={jankenActions.paper} />}
                             {jankenActions.scissors && <JankenHandDisplay action={jankenActions.scissors} />}
                        </div>
                    </CardContent>
                </Card>
            )}

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
