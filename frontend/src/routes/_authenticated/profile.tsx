import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, User, Shield } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold mb-2">Authentication Error</h2>
        <p className="text-muted-foreground mb-4">Unable to load user profile</p>
        <Button asChild>
          <a href="/api/login">Login Again</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
            <CardDescription>Your personal information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                {user.picture ? (
                  <AvatarImage src={user.picture} alt={user.given_name || 'User'} />
                ) : (
                  <AvatarFallback className="text-lg">
                    {user.given_name ? user.given_name[0] : 'U'}
                  </AvatarFallback>
                )}
              </Avatar>
              <div>
                <h3 className="text-xl font-semibold">
                  {user.given_name} {user.family_name}
                </h3>
                {user.email && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">User ID</p>
                  <p className="text-sm text-muted-foreground break-all">{user.id}</p>
                </div>
              </div>

              {user.roles && user.roles.length > 0 && (
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Roles</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.roles.map(role => (
                        <span
                          key={role}
                          className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button
              onClick={logout}
              className="w-full"
            >
              Logout
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
            <CardDescription>Manage your account preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your account is managed through Kinde authentication service.
            </p>
            <Button asChild variant="outline" className="w-full">
              <a href="/api/login" target="_blank" rel="noopener noreferrer">
                Manage Account Settings
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
