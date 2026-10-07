import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Button, Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle, Avatar, EmptyState, PageHeader, Chip, LoadingState, Page, DetailRow, DetailEmpty, Row, Stack } from '@/components/ui';
import { User, Shield, Key, LogOut, SlidersHorizontal, Pencil, Eye, AlertCircle } from 'lucide-react';
import { ProviderTile } from "@/components/ProviderTile";
import { useState, useEffect } from "react";
import { type AiCredential, getCredentials } from "@/lib/aiCredentials";
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
      <LoadingState size="page" label="Loading profile..." />
    );
  }

  if (!user) {
    return (
      <Page width="narrow">
        <EmptyState
          icon={AlertCircle}
          tone="muted"
          title="Your profile could not be loaded"
          description="Your session may have ended. Sign in again to continue."
          action={<Button asChild variant="primary" size="lg"><Link to="/login">Sign in again</Link></Button>}
        />
      </Page>
    );
  }

  return (
    <Page>
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
          <Button variant="secondary" size="md" onClick={logout} loading={isNavigating}>
            {!isNavigating && <><LogOut className="h-3.5 w-3.5" /> Sign out</>}
          </Button>
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
                  {user.bio || <DetailEmpty>No bio yet — add one from Edit profile.</DetailEmpty>}
                </p>
              </div>
            </div>

            <DetailRow label="Email">{user.email || <DetailEmpty>Not set</DetailEmpty>}</DetailRow>

            <DetailRow label="Username">
              {user.username
                ? <span className="person-handle">@{user.username}</span>
                : <DetailEmpty>Not set — required to publish</DetailEmpty>}
            </DetailRow>

            {user.roles && user.roles.length > 0 && (
              <DetailRow label="Roles">
                <Row wrap gap={1.5} as="span">
                  {user.roles.map(role => (
                    <Chip key={role} tone="accent">
                      <Shield className="h-2.5 w-2.5" />{role}
                    </Chip>
                  ))}
                </Row>
              </DetailRow>
            )}

            {/* Editing is its own screen — this page is for viewing. */}
            <Row wrap align="center" gap={2.5} className="pt-1.5">
              <Button asChild variant="secondary" size="md">
                <Link to="/profile/edit">
                  <Pencil className="h-3.5 w-3.5" /> Edit profile
                </Link>
              </Button>
              {user.username && (
                <Button asChild variant="ghost" size="md">
                  <Link to="/u/$username" params={{ username: user.username }}>
                    <Eye className="h-3.5 w-3.5" /> View public profile
                  </Link>
                </Button>
              )}
            </Row>
          </CardContent>
          <CardFooter className="text-2xs text-[var(--ink-ghost)]">
            <Row inline align="center" gap={1.5} as="span">
              <User className="h-3 w-3" /> {user.id}
            </Row>
          </CardFooter>
        </Card>

        {/* AI Provider Settings */}
        <Stack gap={6}>
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
              <Stack gap={2}>
                {credentials.map(cred => <ProviderTile key={cred.id} credential={cred} />)}
              </Stack>
            )}

            {/* Managing keys is its own task with its own screen. */}
            <Button asChild variant="secondary" size="md" width="full">
              <Link to="/providers">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {credentials.length ? "Manage providers" : "Connect a provider"}
              </Link>
            </Button>
          </CardContent>
        </Card>

          <ChangePasswordCard />
        </Stack>
      </div>
    </Page>
  );
}
