import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Key, Plus, Star, Trash2, Loader2, ExternalLink, Check,
  ArrowLeft, ShieldCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/utils";
import { PageHeader, Surface, EmptyState } from "@/components/ui/primitives";
import {
  type AiCredential, type AiProvider, PROVIDER_PRESETS,
  getCredentials, saveCredential, deleteCredential, setDefaultCredential, presetFor,
} from "@/lib/aiCredentials";

export const Route = createFileRoute("/_authenticated/providers")({
  component: ProvidersPage,
});

const CUSTOM = "__custom__";

function ProvidersPage() {
  const [credentials, setCredentials] = useState<AiCredential[]>([]);
  useEffect(() => { setCredentials(getCredentials()); }, []);

  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [model, setModel] = useState(presetFor("gemini").models[0]);
  const [customModel, setCustomModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const preset = presetFor(provider);
  const resolvedModel = model === CUSTOM ? customModel.trim() : model;

  const pickProvider = (p: AiProvider) => {
    setProvider(p);
    setModel(presetFor(p).models[0]);
    setCustomModel("");
  };

  const handleAdd = async () => {
    if (!resolvedModel) { toast.error("Choose or enter a model"); return; }
    const key = apiKey.trim();
    if (!key) { toast.error("Paste your API key"); return; }

    setIsVerifying(true);
    try {
      // Verify before saving, so a bad key fails here rather than midway
      // through generating a document.
      const res = await fetch("/api/ai/search-topics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-AI-Provider": provider,
          "X-AI-Model": resolvedModel,
          "X-AI-Api-Key": key,
        },
        body: JSON.stringify({ query: "test" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "That key or model was rejected.");
      }
      setCredentials(saveCredential({
        provider,
        label: preset.name,
        apiKey: key,
        model: resolvedModel,
        isDefault: false,
      }));
      setApiKey("");
      toast.success(`${preset.name} connected and verified`);
    } catch (err) {
      toast.error(errorMessage(err, "Could not verify that key"));
    } finally { setIsVerifying(false); }
  };

  return (
    <div className="w-full mx-auto py-10" style={{ maxWidth: "60rem", paddingInline: "var(--gutter)" }}>
      <Link to="/profile"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-faint)] hover:text-[var(--ink-2)] transition-colors mb-6">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to profile
      </Link>

      <PageHeader
        className="mb-8"
        title="AI Providers"
        subtitle="Topical generates with the model you choose. Connect at least one provider to start."
      />

      <div className="grid gap-6 md:grid-cols-[1fr_320px] items-start">

        {/* ── Add a provider ── */}
        <Surface size="lg" padding="lg">
          <h2 className="section-title mb-6" style={{ fontSize: "var(--text-lg)" }}>Connect a provider</h2>

          {/* Step 1 — provider */}
          <div className="setup-step" data-done={true}>
            <div className="setup-rail">
              <span className="setup-num">1</span>
              <span className="setup-line" />
            </div>
            <div className="setup-body">
              <div className="setup-label">Choose a provider</div>
              <p className="setup-hint">You pay the provider directly — Topical adds no markup.</p>
              <div className="brand-grid">
                {PROVIDER_PRESETS.map(p => (
                  <button key={p.provider}
                    className="brand-card"
                    data-selected={provider === p.provider}
                    style={{ ["--brand" as string]: p.color }}
                    onClick={() => pickProvider(p.provider)}
                  >
                    {provider === p.provider && (
                      <span className="brand-card-check"><Check className="h-2.5 w-2.5" strokeWidth={3.5} /></span>
                    )}
                    <span className="brand-card-mark">{p.name[0]}</span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-[var(--ink)] truncate">{p.name}</span>
                      <span className="block text-[10.5px] text-[var(--ink-ghost)]">
                        {p.models.length} model{p.models.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 2 — model */}
          <div className="setup-step" data-done={!!resolvedModel}>
            <div className="setup-rail">
              <span className="setup-num">2</span>
              <span className="setup-line" />
            </div>
            <div className="setup-body">
              <div className="setup-label">Pick a model</div>
              <p className="setup-hint">Not sure? The first one is a good default.</p>
              <div className="model-list">
                {preset.models.map(m => (
                  <button key={m} className="model-option" data-selected={model === m} onClick={() => setModel(m)}>
                    <span className="model-radio" />
                    <span className="model-name flex-1">{m}</span>
                    {preset.models[0] === m && (
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: "var(--accent-soft)", color: "var(--accent-500)" }}>
                        RECOMMENDED
                      </span>
                    )}
                  </button>
                ))}
                <button className="model-option" data-selected={model === CUSTOM} onClick={() => setModel(CUSTOM)}>
                  <span className="model-radio" />
                  <span className="flex-1">Custom model…</span>
                </button>
                {model === CUSTOM && (
                  <Input
                    autoFocus
                    value={customModel}
                    onChange={e => setCustomModel(e.target.value)}
                    placeholder="Exact model id, e.g. gpt-5.2-mini"
                    className="bg-[var(--surface)] border-[var(--line)] font-mono text-xs mt-1"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Step 3 — key */}
          <div className="setup-step" data-done={!!apiKey.trim()}>
            <div className="setup-rail">
              <span className="setup-num">3</span>
            </div>
            <div className="setup-body" style={{ paddingBottom: 0 }}>
              <div className="setup-label">Paste your API key</div>
              <p className="setup-hint">We verify it before saving, so mistakes surface now.</p>

              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
                placeholder={preset.keyPlaceholder}
                className="bg-[var(--surface)] border-[var(--line)] font-mono text-xs mb-3"
              />

              <div className="key-note mb-4">
                <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--status-success)" }} />
                <span>
                  Your key is stored in this browser only and sent straight to {preset.name} with each
                  request. It never reaches Topical's database.
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={handleAdd} disabled={isVerifying} className="accent-btn h-10 px-6 rounded-full text-sm">
                  {isVerifying
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verifying…</>
                    : <><Plus className="h-4 w-4 mr-1.5" /> Connect {preset.name}</>}
                </Button>
                <a href={preset.getKeyUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-[var(--ink-faint)] hover:text-[var(--ink-2)] flex items-center gap-1.5 transition-colors">
                  <ExternalLink className="h-3 w-3" /> Get a {preset.name} key
                </a>
              </div>
            </div>
          </div>
        </Surface>

        {/* ── Connected ── */}
        <Surface size="lg" padding="md">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title" style={{ fontSize: "1rem" }}>Connected</h2>
            <span className="topic-count">{credentials.length}</span>
          </div>

          {credentials.length === 0 ? (
            <EmptyState icon={Key} title="Nothing connected"
              description="Generation stays disabled until you add a key." />
          ) : (
            <>
              <div className="space-y-2">
                {credentials.map(cred => {
                  const p = presetFor(cred.provider);
                  return (
                    <div key={cred.id} className="provider-tile" data-default={cred.isDefault}
                      style={{ ["--brand" as string]: p.color }}>
                      <span className="provider-mark">{p.name[0]}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-[var(--ink)]">{p.name}</span>
                          {cred.isDefault && <span className="provider-default-chip">DEFAULT</span>}
                        </div>
                        <p className="provider-model truncate">{cred.model}</p>
                      </div>
                      {!cred.isDefault && (
                        <button className="icon-btn"
                          onClick={() => setCredentials(setDefaultCredential(cred.id))}
                          title="Use by default" aria-label={`Make ${p.name} default`}>
                          <Star className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button className="icon-btn icon-btn--danger"
                        onClick={() => { setCredentials(deleteCredential(cred.id)); toast.success("Key removed"); }}
                        title="Remove" aria-label={`Remove ${p.name} key`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-[var(--ink-ghost)] mt-3.5 leading-relaxed">
                The <span style={{ color: "var(--accent-500)" }}>default</span> provider is used for every
                generation. Star another to switch.
              </p>

              <Link to="/projects"
                className="mt-4 w-full h-9 rounded-full text-xs font-semibold flex items-center justify-center gap-2 accent-btn"
                style={{ textDecoration: "none" }}>
                <Sparkles className="h-3.5 w-3.5" /> Start writing
              </Link>
            </>
          )}
        </Surface>
      </div>
    </div>
  );
}
