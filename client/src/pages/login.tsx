import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { login } from "@/lib/auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().min(1, { message: "Email or username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "demo@chill.com.au",
      password: "demo123",
    },
  });

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true);
    try {
      await login(values.email, values.password);
      setLocation("/dashboard");
    } catch (error) {
      console.error("Login failed:", error);
      toast({
        title: "Login Failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-neutral-100">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="pt-8 pb-6 px-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary">ChillTrack</h1>
            <p className="text-neutral-500 mt-2">Transport Tracking System</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-neutral-700">Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="your@email.com" 
                        {...field} 
                        className="border-neutral-300 focus:border-primary"
                      />
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
                    <FormLabel className="text-neutral-700">Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        {...field} 
                        className="border-neutral-300 focus:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-dark text-white" 
                disabled={isLoading}
              >
                {isLoading ? "Signing In..." : "Sign In"}
              </Button>

              <div className="text-center text-sm text-neutral-500 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", "demo@chill.com.au");
                      form.setValue("password", "demo123");
                    }}
                    className="text-xs"
                  >
                    Demo User
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", "admin");
                      form.setValue("password", "admin123");
                    }}
                    className="text-xs"
                  >
                    Admin
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", "manager");
                      form.setValue("password", "manager123");
                    }}
                    className="text-xs"
                  >
                    Manager
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", "supervisor");
                      form.setValue("password", "super123");
                    }}
                    className="text-xs"
                  >
                    Supervisor
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", "driver");
                      form.setValue("password", "driver123");
                    }}
                    className="text-xs"
                  >
                    Driver
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", "shipper");
                      form.setValue("password", "shipper123");
                    }}
                    className="text-xs"
                  >
                    Shipper
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.setValue("email", "viewer");
                      form.setValue("password", "viewer123");
                    }}
                    className="text-xs"
                  >
                    Viewer
                  </Button>
                </div>
                
                <div className="text-xs text-neutral-400 text-left">
                  <div className="space-y-1">
                    <div><strong>Admin:</strong> Full system control, user management</div>
                    <div><strong>Manager:</strong> All analytics, driver management</div>
                    <div><strong>Supervisor:</strong> Department analytics only</div>
                    <div><strong>Driver:</strong> Own deliveries only</div>
                    <div><strong>Viewer:</strong> Read-only analytics access</div>
                  </div>
                </div>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
