import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth-context';
import {
  Loader2,
  Share2,
  Code,
  Search,
  Layers,
  FileText,
  Globe,
  ArrowRight,
  ChevronRight,
  BookOpen,
  PenLine,
  Sparkles,
  Save,
  Lightbulb
} from 'lucide-react';

export const Route = createFileRoute('/')({
  beforeLoad: () => ({}),
  component: Home,
});

function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin mb-4" style={{ color: 'var(--iridescent-1)' }} />
        <p className="text-white/40 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen w-full">
      {/* Hero Section */}
      <section className="relative py-28 px-4 overflow-hidden">
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="flex flex-col space-y-8 animate-fade-in">
              <div>
                <div
                  className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs mb-6"
                  style={{
                    background: 'rgba(96, 165, 250, 0.06)',
                    border: '1px solid rgba(96, 165, 250, 0.15)',
                    color: 'var(--iridescent-1)',
                  }}
                >
                  <Sparkles className="h-3 w-3 mr-1.5" />
                  AI-Powered Lesson Planning
                </div>
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 gradient-text leading-tight">
                  Topical
                </h1>
                <p className="text-2xl font-medium mb-4 text-white/85">
                  Create, Organize, and Share Knowledge
                </p>
                <p className="text-lg text-white/40 max-w-xl leading-relaxed">
                  An intelligent platform for building structured lesson plans with rich MDX content — powered by AI and real-time web crawling.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 animate-fade-in-delay-1">
                {isAuthenticated ? (
                  <>
                    <a
                      href="/dashboard"
                      className="inline-flex items-center justify-center h-12 px-8 rounded-xl text-base font-medium text-white transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        background: 'linear-gradient(135deg, var(--iridescent-1), var(--iridescent-2))',
                        boxShadow: '0 4px 24px rgba(96, 165, 250, 0.2)',
                      }}
                    >
                      Go to Dashboard
                    </a>
                    <a
                      href="/lesson-plan"
                      className="glass-btn inline-flex items-center justify-center h-12 px-8 text-base font-medium"
                    >
                      Create Lesson Plan
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href="/api/register"
                      className="inline-flex items-center justify-center h-12 px-8 rounded-xl text-base font-medium text-white transition-all duration-300 hover:scale-[1.02]"
                      style={{
                        background: 'linear-gradient(135deg, var(--iridescent-1), var(--iridescent-2))',
                        boxShadow: '0 4px 24px rgba(96, 165, 250, 0.2)',
                      }}
                    >
                      Get Started
                    </a>
                    <a
                      href="/api/login"
                      className="glass-btn inline-flex items-center justify-center h-12 px-8 text-base font-medium"
                    >
                      Sign In
                    </a>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3 mt-1 animate-fade-in-delay-2">
                {["AI-powered generation", "Real-time web crawling", "Community sharing", "Free to use"].map((label) => (
                  <div
                    key={label}
                    className="inline-flex items-center px-3 py-1.5 rounded-full text-xs text-white/40"
                    style={{
                      background: 'var(--glass-bg)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <div className="h-1.5 w-1.5 rounded-full mr-2" style={{ background: 'var(--iridescent-1)' }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden lg:block animate-fade-in-delay-3">
              <div
                className="absolute -inset-2 rounded-2xl opacity-20 blur-2xl"
                style={{ background: 'linear-gradient(135deg, var(--iridescent-1), var(--iridescent-2), var(--iridescent-3))' }}
              />
              <div className="relative glass-card overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center space-x-2">
                      <div className="h-3 w-3 rounded-full bg-red-500/60"></div>
                      <div className="h-3 w-3 rounded-full bg-yellow-500/60"></div>
                      <div className="h-3 w-3 rounded-full bg-green-500/60"></div>
                    </div>
                    <div className="text-xs text-white/30 font-mono">Topical Editor</div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-7 rounded w-3/4 liquid-shimmer" style={{ background: 'rgba(96, 165, 250, 0.08)' }}></div>
                    <div className="h-4 bg-white/[0.03] rounded w-full"></div>
                    <div className="h-4 bg-white/[0.03] rounded w-5/6"></div>
                    <div className="h-4 bg-white/[0.03] rounded w-4/5"></div>
                    <div className="h-24 rounded-lg w-full p-3 mt-2" style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                      <div className="h-3 rounded w-1/2 mb-2" style={{ background: 'rgba(167, 139, 250, 0.1)' }}></div>
                      <div className="h-3 rounded w-3/4 mb-2" style={{ background: 'rgba(96, 165, 250, 0.08)' }}></div>
                      <div className="h-3 rounded w-2/3" style={{ background: 'rgba(52, 211, 153, 0.06)' }}></div>
                    </div>
                    <div className="h-4 bg-white/[0.03] rounded w-5/6"></div>
                    <div className="h-4 bg-white/[0.03] rounded w-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white/90">Powerful Features</h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Everything you need to create, organize, and share knowledge effectively
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Layers, title: "Hierarchical Lesson Plans", desc: "Create structured lesson plans with topics and subtopics organized in a clear hierarchy", color: 'var(--iridescent-1)' },
              { icon: FileText, title: "Rich MDX Content", desc: "Beautiful content with Markdown, JSX, code blocks, and more using the built-in MDX editor", color: 'var(--iridescent-2)' },
              { icon: Code, title: "Smart Web Crawling", desc: "Generate up-to-date content by intelligently crawling and processing relevant web sources", color: 'var(--iridescent-3)' },
              { icon: Search, title: "Content Refinement", desc: "Refine your content with AI-powered suggestions and improvements", color: 'var(--iridescent-1)' },
              { icon: Share2, title: "Share Your Knowledge", desc: "Publish your lesson plans to share with the community or keep them private", color: 'var(--iridescent-2)' },
              { icon: Globe, title: "Community Learning", desc: "Browse and learn from lesson plans shared by other community members", color: 'var(--iridescent-3)' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="glass-card liquid-glow p-6 group">
                <div
                  className="h-11 w-11 rounded-xl flex items-center justify-center mb-4 transition-all duration-300"
                  style={{ background: `${color}10`, border: `1px solid ${color}15` }}
                >
                  <Icon className="h-5 w-5" style={{ color }} />
                </div>
                <h3 className="text-base font-semibold mb-2 text-white/85">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white/90">How It Works</h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Create comprehensive lesson plans in just a few steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Create a Topic Hierarchy", desc: "Search for a main topic and build a structured hierarchy of subtopics", color: 'var(--iridescent-1)' },
              { step: "2", title: "Generate MDX Content", desc: "Use web crawling, URLs, or LLM-only modes to generate rich content for each topic", color: 'var(--iridescent-2)' },
              { step: "3", title: "Save and Share", desc: "Save your lesson plan and optionally publish it for others to learn from", color: 'var(--iridescent-3)' },
            ].map(({ step, title, desc, color }) => (
              <div key={step} className="flex flex-col items-center text-center">
                <div
                  className="h-16 w-16 rounded-2xl flex items-center justify-center mb-6 relative animate-float"
                  style={{
                    animationDelay: `${parseInt(step) * 0.5}s`,
                    background: `${color}08`,
                    border: `1px solid ${color}20`,
                  }}
                >
                  <span className="text-2xl font-bold" style={{ color }}>{step}</span>
                </div>
                <h3 className="text-lg font-semibold mb-2 text-white/85">{title}</h3>
                <p className="text-white/40 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Use Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white/90">How to Use Topical</h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              A step-by-step guide to get the most out of the platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { icon: BookOpen, title: "1. Create a New Lesson Plan", desc: "After signing in, navigate to the Lesson Plan page from your dashboard or navigation menu." },
              { icon: Search, title: "2. Search for a Topic", desc: "Use the search bar to find a main topic. The system generates a structured hierarchy of subtopics you can customize." },
              { icon: Sparkles, title: "3. Generate Content with AI", desc: "Select a topic and choose from web crawling, URL-based, or LLM-only content generation methods." },
              { icon: PenLine, title: "4. Edit and Refine", desc: "Use the MDX editor with code, preview, or split view modes. Select text and refine specific sections." },
              { icon: Save, title: "5. Save Your Lesson Plan", desc: "Save content per topic, then save the entire lesson plan when ready." },
              { icon: Share2, title: "6. Share Your Knowledge", desc: "Toggle the Public option to share your lesson plan with the community." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass-card p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(96, 165, 250, 0.06)', border: '1px solid rgba(96, 165, 250, 0.1)' }}
                  >
                    <Icon className="h-4.5 w-4.5" style={{ color: 'var(--iridescent-1)' }} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold mb-1 text-white/85">{title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 glass-card p-6">
            <div className="flex items-start gap-4">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(52, 211, 153, 0.06)', border: '1px solid rgba(52, 211, 153, 0.1)' }}
              >
                <Lightbulb className="h-5 w-5" style={{ color: 'var(--iridescent-3)' }} />
              </div>
              <div>
                <h3 className="text-base font-semibold mb-2 text-white/85">Pro Tips</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <div>
                    <h4 className="font-medium mb-1 text-sm text-white/70">Content Generation</h4>
                    <p className="text-white/35 text-xs leading-relaxed">
                      The system combines real-time web crawling with LLM capabilities for up-to-date, accurate information. For current content, use web crawling or URL-based methods.
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1 text-sm text-white/70">Collaborative Learning</h4>
                    <p className="text-white/35 text-xs leading-relaxed">
                      Browse public lessons for inspiration. Use the "View Combined" option to see all topics in a single document.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="glass-card liquid-glow p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 gradient-text">
              {isAuthenticated
                ? "Continue Your Learning Journey"
                : "Ready to Create Your First Lesson Plan?"}
            </h2>
            <p className="text-base text-white/40 mb-8 max-w-2xl mx-auto">
              {isAuthenticated
                ? "Create new lesson plans or explore content shared by the community."
                : "Join Topical today and start creating structured, high-quality lesson plans with AI."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {isAuthenticated ? (
                <>
                  <a
                    href="/lesson-plan"
                    className="inline-flex items-center justify-center h-12 px-8 rounded-xl text-base font-medium text-white transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, var(--iridescent-1), var(--iridescent-2))',
                      boxShadow: '0 4px 24px rgba(96, 165, 250, 0.2)',
                    }}
                  >
                    Create New Lesson Plan
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                  <a
                    href="/public-lessons"
                    className="glass-btn inline-flex items-center justify-center h-12 px-8 text-base font-medium"
                  >
                    Browse Public Lessons
                    <ChevronRight className="ml-1 h-5 w-5" />
                  </a>
                </>
              ) : (
                <>
                  <a
                    href="/api/register"
                    className="inline-flex items-center justify-center h-12 px-8 rounded-xl text-base font-medium text-white transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: 'linear-gradient(135deg, var(--iridescent-1), var(--iridescent-2))',
                      boxShadow: '0 4px 24px rgba(96, 165, 250, 0.2)',
                    }}
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                  <a
                    href="/public-lessons"
                    className="glass-btn inline-flex items-center justify-center h-12 px-8 text-base font-medium"
                  >
                    Explore Public Lessons
                    <ChevronRight className="ml-1 h-5 w-5" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4" style={{ borderTop: '1px solid var(--glass-border)' }}>
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-lg font-bold gradient-text">Topical</p>
              <p className="text-xs text-white/30">Create, organize, and share knowledge</p>
            </div>
            <div className="flex gap-6 items-center">
              <a href="/about" className="text-xs text-white/30 hover:text-white/60 transition-colors">About</a>
              <a href="/public-lessons" className="text-xs text-white/30 hover:text-white/60 transition-colors">Public Lessons</a>
              <div className="text-xs text-white/20">© {new Date().getFullYear()} Topical</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
