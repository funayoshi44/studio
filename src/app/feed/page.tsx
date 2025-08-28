
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { subscribeToPosts, createPost, togglePostLike, deletePost, subscribeToReplies, type Post } from '@/lib/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Heart, MessageSquare, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import Link from 'next/link';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const PostCard = ({ post, onReplySubmit }: { post: Post; onReplySubmit: (content: string, parentId: string) => void; }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [replies, setReplies] = useState<Post[]>([]);
    const [isRepliesOpen, setIsRepliesOpen] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    useEffect(() => {
        if (post.replyCount > 0) {
            const unsubscribe = subscribeToReplies(post.id, (fetchedReplies) => {
                setReplies(fetchedReplies);
            });
            return () => unsubscribe();
        }
    }, [post.id, post.replyCount]);

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
        if (window.confirm("Are you sure you want to delete this post? This will also delete all replies.")) {
            try {
                await deletePost(postId);
                toast({ title: "Post deleted" });
            } catch (error) {
                toast({ title: "Error deleting post", variant: "destructive" });
            }
        }
    };

    const handleReplySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyContent.trim()) return;
        setIsSubmittingReply(true);
        try {
            await onReplySubmit(replyContent, post.id);
            setReplyContent('');
            setIsRepliesOpen(true); // Show replies after submitting
        } finally {
            setIsSubmittingReply(false);
        }
    }

    return (
         <Collapsible open={isRepliesOpen} onOpenChange={setIsRepliesOpen} asChild>
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
                        <CollapsibleTrigger asChild>
                            <button className="flex items-center gap-1 hover:text-primary">
                                <MessageSquare className="w-4 h-4" />
                                {post.replyCount}
                            </button>
                        </CollapsibleTrigger>
                    </div>
                    {user?.uid === post.author.uid && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                    )}
                </CardFooter>
                
                <CollapsibleContent>
                    <div className="border-t">
                        {/* Reply Input */}
                        <div className="p-4">
                            <form onSubmit={handleReplySubmit} className="flex items-start gap-2">
                                <Avatar className="w-8 h-8 mt-1">
                                    <AvatarImage src={user?.photoURL ?? undefined} />
                                    <AvatarFallback>{user?.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <Textarea 
                                        value={replyContent}
                                        onChange={(e) => setReplyContent(e.target.value)}
                                        placeholder="Reply to this post..."
                                        rows={2}
                                    />
                                    <div className="flex justify-end mt-2">
                                        <Button size="sm" disabled={isSubmittingReply || !replyContent.trim()}>
                                            {isSubmittingReply && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                            Reply
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Display Replies */}
                        <div className="pl-8 pr-4 pb-4 space-y-4">
                        {replies.map(reply => (
                            <div key={reply.id} className="flex gap-3">
                                <Link href={`/profile/${reply.author.uid}`}>
                                    <Avatar className="w-8 h-8">
                                        <AvatarImage src={reply.author.photoURL ?? undefined} />
                                        <AvatarFallback>{reply.author.displayName?.[0]}</AvatarFallback>
                                    </Avatar>
                                </Link>
                                <div className="flex-1 bg-muted p-3 rounded-lg">
                                    <div className="flex items-center gap-2">
                                            <Link href={`/profile/${reply.author.uid}`} className="font-bold text-sm hover:underline">{reply.author.displayName}</Link>
                                            <p className="text-xs text-muted-foreground">
                                                {reply.createdAt ? formatDistanceToNow(reply.createdAt.toDate(), { addSuffix: true, locale: ja }) : '...'}
                                            </p>
                                    </div>
                                    <p className="text-sm mt-1">{reply.content}</p>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                </CollapsibleContent>
            </Card>
        </Collapsible>
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
        const unsubscribe = subscribeToPosts((allPosts) => {
            setPosts(allPosts);
            setIsLoadingPosts(false);
        });
        return () => unsubscribe();
    }, []);

    const handleCreatePost = async (content: string, parentId: string | null = null) => {
        if (!user || !content.trim()) return;
        
        try {
            await createPost(user, content, parentId);
            if (!parentId) {
                setNewPostContent(''); // Clear main input only if it's a top-level post
                toast({ title: "Post created!" });
            } else {
                 toast({ title: "Reply sent!" });
            }
        } catch (error) {
            toast({ title: "Error creating post", variant: 'destructive' });
        }
    };

    const handleTopLevelSubmit = async () => {
        setIsSubmitting(true);
        await handleCreatePost(newPostContent);
        setIsSubmitting(false);
    }


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
                    <Button onClick={handleTopLevelSubmit} disabled={isSubmitting || !newPostContent.trim()}>
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Post
                    </Button>
                </CardFooter>
            </Card>

            <div className="space-y-4">
                {isLoadingPosts ? (
                    <p>Loading posts...</p>
                ) : posts.length > 0 ? (
                    posts.map(post => (
                        <PostCard key={post.id} post={post} onReplySubmit={handleCreatePost}/>
                    ))
                ) : (
                    <p className="text-center text-muted-foreground">No posts yet. Be the first to share something!</p>
                )}
            </div>
        </div>
    );
}
