import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, Shield, Key, LogOut, SlidersHorizontal, Pencil, Eye } from "lucide-react";
import { useState, useEffect } from "react";
import { type AiCredential, getCredentials, presetFor } from "@/lib/aiCredentials";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ChangePasswordCard } from "@/components/auth/ChangePasswordCard";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

function Profile() {
  const { user, isLoading, isNavigating, logout } = useAuth();

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
        <Button asChild><Link to="/login">Sign in again</Link></Button>
      </div>
    );
  }

  return (
    <div className="page-shell">
      {/* ── The header ──
          This page opened with a full-bleed `IdentityBanner`: a tinted slab
          with an 88px avatar in it, where every other screen in the product
          opens with a left-aligned line of text. Nothing else in the app has
          that shape, so arriving here read as landing in a different
          application — which is what "the profile looks weird" was.

          The banner is right for `/u/:username`, which is a page *about* a
          person. This one is your own settings, so it gets the same header as
          Projects and Community, and the identity moves into the card below
          where the rest of your details already are. */}
      <PageHeader
        kicker={[user.given_name, user.family_name].filter(Boolean).join(' ') || user.email}
        title="Your account"
        subtitle="Your name, handle and bio are public. Everything else on this page is yours alone."
        actions={
          /* `.btn-subtle`, the product's secondary tier — this was a shadcn
             ghost `Button` with four Tailwind colour overrides, the only page
             action in the app that was not one of the three control tiers
             `buttons.css` owns. */
          <button className="btn-subtle h-9 px-4" onClick={logout} disabled={isNavigating}>
            {isNavigating
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <><LogOut className="h-3.5 w-3.5" /> Sign out</>}
          </button>
        }
      />

      {/* The identity form carries more fields, so it gets the wider column.
          An even 50/50 split at max-w-3xl left both sides cramped. */}
      <div className="grid gap-6 md:grid-cols-[1.15fr_1fr] items-start">
        {/* ── What the banner does not already say ──
            This card used to open with Username and Bio, both of which the
            banner two hundred pixels above prints in full — the same three
            facts twice on one screen, the second time smaller and greyer.
            What is left is the part of the account that is *not* public: the
            address it is reachable at, what it is allowed to do, and the two
            ways to change how it looks to everyone else. */}
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Only you see this page. Your name, handle and bio are public.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {/* The avatar keeps its seeded hue and is the one place on this
                page a colour changes per account. */}
            <div className="account-identity">
              <Avatar seed={user.id} src={user.avatarUrl || user.picture} name={user.given_name || user.email || 'You'} size="lg" />
              <div className="min-w-0">
                <div className="account-identity-name">
                  {[user.given_name, user.family_name].filter(Boolean).join(' ') || 'Unnamed'}
                </div>
                <p className="account-identity-bio">
                  {user.bio || <span className="detail-empty">No bio yet — add one from Edit profile.</span>}
                </p>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">Email</span>
              <span className="detail-value">{user.email || <span className="detail-empty">Not set</span>}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Username</span>
              <span className="detail-value">
                {user.username
                  ? <span className="person-handle">@{user.username}</span>
                  : <span className="detail-empty">Not set — required to publish</span>}
              </span>
            </div>

            {user.roles && user.roles.length > 0 && (
              <div className="detail-row">
                <span className="detail-label">Roles</span>
                <span className="detail-value flex flex-wrap gap-1.5">
                  {user.roles.map(role => (
                    <span key={role} className="chip chip--accent">
                      <Shield className="h-2.5 w-2.5" />{role}
                    </span>
                  ))}
                </span>
              </div>
            )}

            {/* Editing is its own screen — this page is for viewing. */}
            <div className="flex items-center gap-2.5 pt-1.5">
              <Link to="/profile/edit" className="btn-subtle h-9 px-4">
                <Pencil className="h-3.5 w-3.5" /> Edit profile
              </Link>
              {user.username && (
                <Link to="/u/$username" params={{ username: user.username }}
                  className="h-9 px-4 rounded-lg text-xs font-medium flex items-center gap-2 text-[var(--ink-faint)] hover:text-[var(--ink-2)] transition-colors"
                  style={{ textDecoration: "none" }}>
                  <Eye className="h-3.5 w-3.5" /> View public profile
                </Link>
              )}
            </div>
          </CardContent>
          <CardFooter className="text-[11px] text-[var(--ink-ghost)]">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3 w-3" /> {user.id}
            </span>
          </CardFooter>
        </Card>

        {/* AI Provider Settings */}
        <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>AI providers</CardTitle>
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
                          <span className="text-[13px] font-semibold text-[var(--ink)]">{preset.name}</span>
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

          <ChangePasswordCard />
        </div>
      </div>
    </div>
  );
}
