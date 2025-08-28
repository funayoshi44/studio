
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { subscribeToPosts, createPost, togglePostLike, deletePost, type Post } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Heart, MessageSquare, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';

const PostCard = ({ post }: { post: Post; }) => {
    const { user } = useAuth();
    const { toast } = useToast();

    const handleLikePost = async (postId: string) => {
        if (!user) return;
        try {
            await togglePostLike(postId, user.uid);
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

    return (
        <Card>
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
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <button onClick={() => handleLikePost(post.id)} className="flex items-center gap-1 hover:text-red-500">
                        <Heart className={`w-4 h-4 ${user && post.likes.includes(user.uid) ? 'fill-current text-red-500' : ''}`} /> 
                        {post.likeCount}
                    </button>
                    {/* Reply functionality is commented out for now
                    <button className="flex items-center gap-1 hover:text-primary">
                        <MessageSquare className="w-4 h-4" />
                        {post.replyCount}
                    </button>
                    */}
                </div>
                {user?.uid === post.author.uid && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
};


export default function FeedPage() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();

    const [posts, setPosts] = useState<Post[]>([]);
    const [newPostContent, setNewPostContent] = useState('');
    const [isLoadingPosts, setIsLoadingPosts] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setIsLoadingPosts(true);
        const unsubscribe = subscribeToPosts((allPosts) => {
            setPosts(allPosts);
            setIsLoadingPosts(false);
        });
        return () => unsubscribe();
    }, []);

    const handleCreatePost = async (content: string) => {
        if (!user || !content.trim()) return;
        setIsSubmitting(true);
        try {
            await createPost(user, content);
            setNewPostContent(''); 
            toast({ title: "Post created!" });
        } catch (error) {
            toast({ title: "Error creating post", variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };


    if (authLoading) {
        return <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
    }

    if (!user) {
        return <div className="text-center py-10">Please log in to see the feed.</div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Feed</h1>
            
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Link href={`/profile/${user.uid}`}>
                            <Avatar>
                                <AvatarImage src={user.photoURL ?? undefined} />
                                <AvatarFallback>{user.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                        </Link>
                        <h2 className="text-xl font-semibold">What's on your mind?</h2>
                    </div>
                </CardHeader>
                <CardContent>
                    <Textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder="Share your thoughts with the community..."
                        rows={4}
                    />
                </CardContent>
                <CardFooter className="flex justify-end">
                    <Button onClick={() => handleCreatePost(newPostContent)} disabled={isSubmitting || !newPostContent.trim()}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Post
                    </Button>
                </CardFooter>
            </Card>

            <div className="space-y-4">
                {isLoadingPosts ? (
                    <div className="text-center text-muted-foreground py-8">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p>Loading posts...</p>
                    </div>
                ) : posts.length > 0 ? (
                    posts.map(post => (
                        <PostCard key={post.id} post={post}/>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground py-8">No posts yet. Be the first to share something!</p>
                )}
            </div>
        </div>
    );
}
