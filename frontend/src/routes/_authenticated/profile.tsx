import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, User, Shield, Key, LogOut, SlidersHorizontal, Pencil, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { type AiCredential, getCredentials, presetFor } from "@/lib/aiCredentials";
import { IdentityBanner, EmptyState } from "@/components/ui/primitives";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const { user, isLoading, isNavigating, loginUrl, logout, loginAction } = useAuth();

  // AI provider credentials
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  useEffect(() => { setCredentials(getCredentials()); }, []);


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
        <Button asChild><a href={loginUrl} onClick={loginAction}>Login Again</a></Button>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto py-10" style={{ maxWidth: '68rem', paddingInline: 'var(--gutter)' }}>
      {/* ── Identity banner ── */}
      <IdentityBanner
        className="mb-6"
        seed={user.id}
        name={[user.given_name, user.family_name].filter(Boolean).join(' ') || 'Your Profile'}
        handle={user.username}
        bio={user.bio}
        bioFallback="No bio yet — add one from Edit profile."
        avatarUrl={user.avatarUrl || user.picture}
        meta={<>
          {user.email && (
            <span className="inline-flex items-center gap-1.5"><Mail className="h-3 w-3" />{user.email}</span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Key className="h-3 w-3" />
            {credentials.length
              ? `${credentials.length} provider${credentials.length === 1 ? '' : 's'} connected`
              : 'No AI provider yet'}
          </span>
        </>}
        actions={
          <Button onClick={logout} disabled={isNavigating} variant="ghost" size="sm"
            className="text-white/35 hover:text-white/80 hover:bg-white/[0.05]">
            {isNavigating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out</>}
          </Button>
        }
      />

      {/* The identity form carries more fields, so it gets the wider column.
          An even 50/50 split at max-w-3xl left both sides cramped. */}
      <div className="grid gap-6 md:grid-cols-[1.15fr_1fr] items-start">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>What other members see on your public profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-white/25 mb-1">Username</div>
              {user.username
                ? <span className="person-handle">@{user.username}</span>
                : <span className="text-[13px] text-white/30 italic">Not set — required to publish</span>}
            </div>

            <div>
              <div className="text-[10.5px] uppercase tracking-wider text-white/25 mb-1">Bio</div>
              <p className="text-[13px] text-white/55 leading-relaxed">
                {user.bio || <span className="text-white/25 italic">No bio yet</span>}
              </p>
            </div>

            {user.roles && user.roles.length > 0 && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-white/25 mb-1.5">Roles</div>
                <div className="flex flex-wrap gap-1.5">
                  {user.roles.map(role => (
                    <span key={role} className="text-[10.5px] px-2 py-0.5 rounded-full"
                      style={{ background: "var(--accent-soft)", color: "var(--accent-300)", border: "1px solid var(--accent-line)" }}>
                      <Shield className="h-2.5 w-2.5 inline mr-1" />{role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Editing is its own screen — this page is for viewing. */}
            <div className="flex items-center gap-2.5 pt-1">
              <Link to="/profile/edit"
                className="btn-subtle h-9 px-4">
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Link>
              {user.username && (
                <Link to="/u/$username" params={{ username: user.username }}
                  className="h-9 px-4 rounded-lg text-xs font-medium flex items-center gap-2 text-white/40 hover:text-white/75 transition-colors"
                  style={{ textDecoration: "none" }}>
                  <Eye className="h-3.5 w-3.5" /> View public profile
                </Link>
              )}
            </div>
          </CardContent>
          <CardFooter className="text-[11px] text-white/20">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3 w-3" /> {user.id}
            </span>
          </CardFooter>
        </Card>

        {/* AI Provider Settings */}
        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              AI Providers
            </CardTitle>
            <CardDescription>The models Topical generates with.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {credentials.length === 0 ? (
              <EmptyState icon={Key} title="No providers connected"
                description="Generation is disabled until you add one." />
            ) : (
              <div className="space-y-2">
                {credentials.map((cred) => {
                  const preset = presetFor(cred.provider);
                  return (
                    <div key={cred.id} className="provider-tile" data-default={cred.isDefault}
                      style={{ ['--brand' as string]: preset.color }}>
                      <span className="provider-mark">{preset.name[0]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-white/85">{preset.name}</span>
                          {cred.isDefault && <span className="provider-default-chip">DEFAULT</span>}
                        </div>
                        <p className="provider-model truncate">{cred.model}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Managing keys is its own task with its own screen. */}
            <Link to="/providers"
              className="btn-subtle w-full h-9">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {credentials.length ? "Manage providers" : "Connect a provider"}
            </Link>
          </CardContent>
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
                <a href={loginUrl} target="_blank" rel="noopener noreferrer">
                  Manage Account Settings
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
