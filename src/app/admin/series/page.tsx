
"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { useAuth } from "@/contexts/auth-context";
import { addSeries, getSeries, deleteSeries, type CardSeries } from "@/lib/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Trash2, PlusCircle, Library } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";

type Inputs = {
  name: string;
};

export default function SeriesManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors }, reset } = useForm<Inputs>();
  
  const [series, setSeries] = useState<CardSeries[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchSeries = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const seriesData = await getSeries(force); // Force refresh
      setSeries(seriesData);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to fetch series.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSeries(false);
  }, [fetchSeries]);

  const onSubmit: SubmitHandler<Inputs> = async (data) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await addSeries(data.name);
      toast({ title: "Success", description: `Series "${data.name}" has been created.` });
      reset();
      await fetchSeries(true); // Refresh the list
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to create series.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(id);
    try {
      await deleteSeries(id);
      toast({ title: "Success", description: "Series has been deleted." });
      await fetchSeries(true); // Refresh the list
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete series.", variant: "destructive" });
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="container mx-auto py-10 grid md:grid-cols-3 gap-8">
      <div className="md:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><PlusCircle /> Add New Series</CardTitle>
            <CardDescription>Create a new series to categorize cards.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Series Name</Label>
                <Input id="name" {...register("name", { required: "Series name is required" })} />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Create Series"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Library /> Existing Series</CardTitle>
            <CardDescription>View and manage all card series.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {series.length > 0 ? (
                    series.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{format(item.createdAt.toDate(), 'PPP')}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="icon" disabled={isDeleting === item.id}>
                                {isDeleting === item.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the series "{item.name}".
                                  Cards in this series will not be deleted but will need to be re-assigned.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id)}>
                                  Yes, delete it
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">No series found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
