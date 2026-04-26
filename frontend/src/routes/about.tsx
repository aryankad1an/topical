import { createFileRoute } from '@tanstack/react-router';
import {
  BookOpen,
  Sparkles,
  Globe,
  Layers,
  Code,
  Search,
  PenLine,
  Share2,
  ArrowRight,
  Zap,
  Brain,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export const Route = createFileRoute('/about')({
  component: About,
});

function About() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex flex-col min-h-screen w-full">
      {/* Hero Section */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center">
            <div
              className="inline-flex items-center px-3.5 py-1.5 rounded-full text-xs mb-6"
              style={{
                background: 'rgba(167, 139, 250, 0.06)',
                border: '1px solid rgba(167, 139, 250, 0.15)',
                color: 'var(--iridescent-2)',
              }}
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              About the Platform
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 gradient-text">
              About Topical
            </h1>
            <p className="text-lg text-white/40 max-w-3xl mx-auto leading-relaxed">
              An intelligent platform for building structured lesson plans with rich MDX content — powered by AI and real-time web crawling.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-white/90">Our Mission</h2>
              <div className="space-y-4 text-white/50 leading-relaxed">
                <p>
                  Topical was born from a simple idea: creating high-quality educational content shouldn't be a chore. We built a platform that combines the power of Google Gemini with intuitive content organization tools.
                </p>
                <p>
                  Whether you're an educator building a curriculum, a student organizing your study materials, or a knowledge worker structuring documentation — Topical gives you the tools to create, refine, and share structured content effortlessly.
                </p>
                <p>
                  Our platform generates topic hierarchies, produces rich MDX content, and lets you refine it with AI assistance — all in a single, beautiful interface.
                </p>
              </div>
            </div>
            <div className="relative">
              <div
                className="absolute -inset-2 rounded-2xl opacity-20 blur-2xl"
                style={{ background: 'linear-gradient(135deg, var(--iridescent-1), var(--iridescent-2), var(--iridescent-3))' }}
              />
              <div className="relative glass-card p-8">
                <div className="flex items-center mb-6">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center mr-4"
                    style={{ background: 'rgba(96, 165, 250, 0.08)', border: '1px solid rgba(96, 165, 250, 0.15)' }}
                  >
                    <BookOpen className="h-6 w-6" style={{ color: 'var(--iridescent-1)' }} />
                  </div>
                  <h3 className="text-xl font-semibold text-white/85">Knowledge for Everyone</h3>
                </div>
                <p className="text-white/40 leading-relaxed">
                  We believe that powerful tools for knowledge creation should be accessible to everyone. Topical is free to use and designed to make structured content creation as simple as typing a topic.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What It Does Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white/90">What Topical Does</h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              A complete workflow for AI-powered content creation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Search, title: "Topic Discovery", desc: "Search any subject and get an AI-generated hierarchy of topics and subtopics, organized for effective learning.", color: 'var(--iridescent-1)' },
              { icon: Brain, title: "AI Content Generation", desc: "Generate comprehensive MDX content using Google Gemini, with three modes: LLM-only, web crawling, or URL-based.", color: 'var(--iridescent-2)' },
              { icon: PenLine, title: "Inline Refinement", desc: "Select any text and refine it with AI — ask questions, request rewrites, or improve specific sections.", color: 'var(--iridescent-3)' },
              { icon: Layers, title: "Hierarchy Management", desc: "Drag-and-drop topic reordering, add/remove topics and subtopics, and auto-save content as you work.", color: 'var(--iridescent-1)' },
              { icon: FileText, title: "Rich MDX Editor", desc: "Full code/preview/split editor with MDX support, syntax highlighting, image uploads, and live preview.", color: 'var(--iridescent-2)' },
              { icon: Share2, title: "Community Sharing", desc: "Publish lesson plans for others to discover, or keep them private. Browse and learn from community content.", color: 'var(--iridescent-3)' },
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

      {/* Tech Stack Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white/90">Built With</h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              Modern technologies powering a seamless experience
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { name: "React", desc: "Frontend UI", icon: Code },
              { name: "Hono", desc: "Backend API", icon: Zap },
              { name: "FastAPI", desc: "AI Microservice", icon: Brain },
              { name: "Google Gemini", desc: "AI Generation", icon: Sparkles },
              { name: "TanStack Router", desc: "Type-safe routing", icon: Layers },
              { name: "Drizzle ORM", desc: "Database layer", icon: Code },
              { name: "Zustand", desc: "State management", icon: Layers },
              { name: "MDX", desc: "Rich content", icon: FileText },
            ].map(({ name, desc, icon: Icon }) => (
              <div key={name} className="glass-card p-5 text-center group">
                <div
                  className="h-10 w-10 rounded-xl mx-auto flex items-center justify-center mb-3"
                  style={{ background: 'rgba(96, 165, 250, 0.06)', border: '1px solid rgba(96, 165, 250, 0.1)' }}
                >
                  <Icon className="h-4 w-4" style={{ color: 'var(--iridescent-1)' }} />
                </div>
                <h4 className="font-semibold text-sm text-white/80 mb-0.5">{name}</h4>
                <p className="text-xs text-white/30">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4 text-white/90">How It Works</h2>
            <p className="text-lg text-white/40 max-w-2xl mx-auto">
              From search to sharing in just a few steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Search", desc: "Enter any topic to generate a structured hierarchy" },
              { step: "2", title: "Generate", desc: "Use AI to create rich MDX content for each subtopic" },
              { step: "3", title: "Refine", desc: "Edit, refine with AI, and customize your content" },
              { step: "4", title: "Share", desc: "Save your lesson plan and share it with the community" },
            ].map(({ step, title, desc }, i) => {
              const colors = ['var(--iridescent-1)', 'var(--iridescent-2)', 'var(--iridescent-3)', 'var(--iridescent-1)'];
              return (
                <div key={step} className="flex flex-col items-center text-center">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center mb-4 animate-float"
                    style={{
                      animationDelay: `${i * 0.5}s`,
                      background: `${colors[i]}08`,
                      border: `1px solid ${colors[i]}20`,
                    }}
                  >
                    <span className="text-xl font-bold" style={{ color: colors[i] }}>{step}</span>
                  </div>
                  <h3 className="text-base font-semibold mb-1 text-white/85">{title}</h3>
                  <p className="text-white/40 text-sm">{desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="glass-card liquid-glow p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 gradient-text">
              {isAuthenticated ? "Continue Creating" : "Start Creating Today"}
            </h2>
            <p className="text-base text-white/40 mb-8 max-w-2xl mx-auto">
              {isAuthenticated
                ? "Jump back into your lesson plans or explore content from the community."
                : "Join Topical and start building structured, AI-powered lesson plans for free."}
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
                    Create Lesson Plan
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </a>
                  <a
                    href="/public-lessons"
                    className="glass-btn inline-flex items-center justify-center h-12 px-8 text-base font-medium"
                  >
                    Browse Public Lessons
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
              <a href="/public-lessons" className="text-xs text-white/30 hover:text-white/60 transition-colors">Public Lessons</a>
              <div className="text-xs text-white/20">© {new Date().getFullYear()} Topical</div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}