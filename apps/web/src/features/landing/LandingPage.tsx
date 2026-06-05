import { Link } from 'react-router-dom'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-950 text-zinc-100 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-950/60 via-surface-950 to-surface-950" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <span className="font-bold text-lg text-white">Collab Notes</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-zinc-400 hover:text-zinc-100 px-4 py-2 rounded-lg transition-colors text-sm font-medium">
            Sign in
          </Link>
          <Link to="/register" className="gradient-brand text-white px-5 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-lg shadow-brand-500/20">
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm px-4 py-1.5 rounded-full mb-8 animate-fade-in">
          <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse-slow" />
          Real-time collaboration powered by Yjs CRDT
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
          Write together,{' '}
          <span className="text-gradient">seamlessly.</span>
        </h1>

        <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          A collaborative notes app where your whole team writes in real-time.
          Multiple cursors, offline sync, rich text editor — built for teams.
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            to="/register"
            className="gradient-brand text-white px-8 py-3.5 rounded-xl text-base font-semibold hover:opacity-90 active:scale-[0.98] transition-all shadow-xl shadow-brand-500/25"
          >
            Start for free
          </Link>
          <Link
            to="/login"
            className="glass text-zinc-300 px-8 py-3.5 rounded-xl text-base font-semibold hover:text-white transition-all"
          >
            Sign in
          </Link>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          {[
            {
              icon: '⚡',
              title: 'Real-time sync',
              desc: 'See every keystroke as it happens. Conflict-free CRDT (Yjs) ensures zero data loss.',
            },
            {
              icon: '📱',
              title: 'Works offline',
              desc: 'Keep writing even without internet. Changes sync automatically when you reconnect.',
            },
            {
              icon: '🔒',
              title: 'Team RBAC',
              desc: 'Invite teammates with owner, editor, or viewer roles. Full workspace isolation.',
            },
            {
              icon: '📝',
              title: 'Rich text editor',
              desc: 'Headings, lists, code blocks, tasks, images, @mentions — all in a beautiful editor.',
            },
            {
              icon: '💬',
              title: 'Threaded comments',
              desc: 'Leave comments on any part of a note. Resolve them when done.',
            },
            {
              icon: '🕐',
              title: 'Version history',
              desc: 'Restore any previous version of a note. Up to 100 snapshots per document.',
            },
          ].map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover:border-brand-500/30 transition-all group">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2 group-hover:text-brand-300 transition-colors">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
