
"use client";

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useParams, useRouter } from 'next/navigation';
import { subscribeToMessages, sendMessage, getOrCreateChatRoom, getUserProfile, type ChatMessage, type MockUser } from '@/lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function ChatRoomPage() {
    const { user, loading: authLoading } = useAuth();
    const params = useParams();
    const router = useRouter();
    const chatId = params.chatId as string;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [otherUser, setOtherUser] = useState<MockUser | null>(null);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // chatId is composed of two user IDs sorted alphabetically.
    // We can find the other user's ID by removing the current user's ID.
    const otherUserId = user ? chatId.replace(user.uid, '').replace('-', '') : null;

    useEffect(() => {
        if (!user || !chatId || !otherUserId) return;

        const fetchOtherUser = async () => {
            const userProfile = await getUserProfile(otherUserId);
            if (userProfile) {
                setOtherUser(userProfile);
            } else {
                router.push('/chat'); // Redirect if other user not found
            }
        };

        fetchOtherUser();

        const unsubscribe = subscribeToMessages(chatId, (msgs) => {
            setMessages(msgs);
            setLoading(false);
        });

        return () => unsubscribe();

    }, [user, chatId, otherUserId, router]);

    useEffect(() => {
        // Scroll to the bottom of the message list
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const handleSendMessage = async (e: FormEvent) => {
        e.preventDefault();
        if (!user || !newMessage.trim()) return;

        try {
            await sendMessage(chatId, user.uid, newMessage, {
                displayName: user.displayName,
                photoURL: user.photoURL,
            });
            setNewMessage('');
        } catch (error) {
            console.error("Failed to send message:", error);
            // Optionally show a toast notification for the error
        }
    };

    if (loading || authLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto border rounded-lg">
            {/* Header */}
            <div className="flex items-center p-4 border-b">
                <Button variant="ghost" size="icon" className="mr-4" onClick={() => router.push('/chat')}>
                    <ArrowLeft />
                </Button>
                {otherUser && (
                    <Link href={`/profile/${otherUser.uid}`} className="flex items-center gap-3">
                        <Avatar>
                            <AvatarImage src={otherUser.photoURL ?? undefined} />
                            <AvatarFallback>{otherUser.displayName?.[0]}</AvatarFallback>
                        </Avatar>
                        <h2 className="text-xl font-bold">{otherUser.displayName}</h2>
                    </Link>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map(msg => (
                    <div key={msg.id} className={cn('flex items-end gap-2', msg.senderId === user.uid ? 'justify-end' : 'justify-start')}>
                        {msg.senderId !== user.uid && (
                             <Link href={`/profile/${msg.senderId}`}>
                                <Avatar className="w-8 h-8">
                                    <AvatarImage src={otherUser?.photoURL ?? undefined} />
                                    <AvatarFallback>{otherUser?.displayName?.[0]}</AvatarFallback>
                                </Avatar>
                            </Link>
                        )}
                        <div className={cn('max-w-xs md:max-w-md p-3 rounded-lg', msg.senderId === user.uid ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                            <p className="whitespace-pre-wrap">{msg.text}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <div className="p-4 border-t">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        autoComplete="off"
                    />
                    <Button type="submit" disabled={!newMessage.trim()}>
                        <Send />
                    </Button>
                </form>
            </div>
        </div>
    );
}
