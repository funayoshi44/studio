
"use client";

import { useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { updateAnnouncement, } from "@/lib/firestore";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import type { Announcement } from "@/lib/types";

type Inputs = {
  title: string;
  content: string;
};

export default function EditAnnouncementPage() {
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors }, setValue, reset } = useForm<Inputs>();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  useEffect(() => {
    if (!id) return;
    const fetchAnnouncement = async () => {
        setIsFetching(true);
        try {
            const docRef = doc(db, "announcements", id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Announcement;
                setValue("title", data.title);
                setValue("content", data.content);
            } else {
                toast({ title: "Error", description: "Announcement not found.", variant: "destructive" });
                router.push("/admin/announcements");
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Error", description: "Failed to fetch announcement details.", variant: "destructive" });
        } finally {
            setIsFetching(false);
        }
    };
    fetchAnnouncement();
  }, [id, router, setValue, toast]);

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    if (!user) {
        toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      await updateAnnouncement(id, data.title, data.content);
      toast({
        title: "Success!",
        description: "The announcement has been updated.",
      });
      router.push("/admin/announcements");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update announcement.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin" />
          </div>
      )
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Edit Announcement</CardTitle>
          <CardDescription>
            Update the title and content of the announcement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" {...register("title", { required: "Title is required" })} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                rows={10}
                {...register("content", { required: "Content is required" })}
              />
              {errors.content && <p className="text-xs text-destructive">{errors.content.message}</p>}
            </div>

            <div className="flex justify-end gap-4">
                <Link href="/admin/announcements" passHref>
                    <Button variant="outline" type="button">Cancel</Button>
                </Link>
                <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
