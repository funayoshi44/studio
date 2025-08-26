"use client";

import Link from "next/link"
import { useContext } from "react";
import { AuthContext } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  username: z.string().min(2, { message: "Username must be at least 2 characters." }).max(30, { message: "Username must not exceed 30 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export type RegisterForm = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const { googleSignIn, emailSignUp, user } = useContext(AuthContext);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<RegisterForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
    } catch (error) {
      console.error("Google Sign In failed", error);
      toast({ title: "Sign Up Failed", description: "Could not sign up with Google.", variant: "destructive" });
    }
  };

  const handleEmailSignUp = async (values: RegisterForm) => {
    try {
      await emailSignUp(values);
    } catch (error: any) {
      let description = "An unexpected error occurred.";
      if (error.code === 'auth/email-already-in-use') {
        description = "This email is already registered.";
      }
      toast({ title: "Sign Up Failed", description, variant: "destructive" });
    }
  };

  if (user) {
    router.push('/');
    return null;
  }

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="mx-auto max-w-sm w-full">
        <CardHeader>
          <CardTitle className="text-xl">Sign Up</CardTitle>
          <CardDescription>
            Enter your information to create an account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEmailSignUp)} className="grid gap-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                {form.formState.isSubmitting ? 'Creating Account...' : 'Create an account'}
              </Button>
            </form>
          </Form>
          <Separator className="my-4" />
          <Button variant="outline" className="w-full" onClick={handleGoogleSignIn}>
            Sign up with Google
          </Button>
          <div className="mt-4 text-center text-sm">
            Already have an account?{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}