"use client";

import Link from "next/link"
import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export type EmailPasswordForm = z.infer<typeof formSchema>;


export default function LoginPage() {
  const { googleSignIn, emailSignIn, user } = useContext(AuthContext);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<EmailPasswordForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
    } catch (error) {
      console.error("Google Sign In failed", error);
      toast({ title: "Login Failed", description: "Could not sign in with Google.", variant: "destructive" });
    }
  };
  
  const handleEmailSignIn = async (values: EmailPasswordForm) => {
    try {
      await emailSignIn(values);
    } catch (error: any) {
       let description = "An unexpected error occurred.";
       if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
           description = "Invalid email or password.";
       }
       toast({ title: "Login Failed", description, variant: "destructive" });
    }
  }

  if (user) {
    router.push('/');
    return null;
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEmailSignIn)} className="grid gap-4">
               <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="m@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </form>
          </Form>
          <Separator className="my-4"/>
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            Login with Google
          </Button>
          <div className="mt-4 text-center text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}