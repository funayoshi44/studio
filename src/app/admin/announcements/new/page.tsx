
"use client";

import { useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { createAnnouncement } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type Inputs = {
  title: string;
  content: string;
};

export default function NewAnnouncementPage() {
  const { user } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<Inputs>();
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    if (!user) {
        toast({ title: "Error", description: "You must be logged in to create an announcement.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      await createAnnouncement(user, data.title, data.content);
      toast({
        title: "Success!",
        description: "Your announcement has been published.",
      });
      router.push("/admin/announcements");
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create announcement.",
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
          <CardTitle>New Announcement</CardTitle>
          <CardDescription>
            Fill out the form to create a new announcement for all users.
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
                    Publish
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
