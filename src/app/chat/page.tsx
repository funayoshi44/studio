
"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { subscribeToChatRooms, type ChatRoom } from '@/lib/firestore';
import { useTranslation } from '@/hooks/use-translation';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

export default function ChatInboxPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const t = useTranslation();
    const { language } = t;

    const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
            return;
        }

        const unsubscribe = subscribeToChatRooms(user.uid, (rooms) => {
            setChatRooms(rooms);
            setLoading(false);
        });

        return () => unsubscribe();

    }, [user, authLoading, router]);

    if (loading || authLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">{t('chat')}</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Conversations</CardTitle>
                    <CardDescription>Your recent conversations.</CardDescription>
                </CardHeader>
                <CardContent>
                    {chatRooms.length > 0 ? (
                        <div className="space-y-4">
                            {chatRooms.map(room => {
                                const otherParticipant = room.participantsInfo[Object.keys(room.participantsInfo).find(uid => uid !== user?.uid)!];
                                return (
                                    <Link href={`/chat/${room.id}`} key={room.id} className="block hover:bg-muted/50 p-4 rounded-lg transition-colors border">
                                        <div className="flex items-center gap-4">
                                            <Avatar>
                                                <AvatarImage src={otherParticipant.photoURL ?? undefined} />
                                                <AvatarFallback>{otherParticipant.displayName?.[0]}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex justify-between">
                                                    <p className="font-bold">{otherParticipant.displayName}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {room.updatedAt && formatDistanceToNow(room.updatedAt.toDate(), { addSuffix: true, locale: language === 'ja' ? ja : undefined })}
                                                    </p>
                                                </div>
                                                <p className="text-sm text-muted-foreground truncate">{room.lastMessage}</p>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">You have no active conversations.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
