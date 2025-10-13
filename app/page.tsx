export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-600/10 grid place-items-center"><span className="text-blue-700 font-black">MT</span></div>
          <div>
            <h1 className="font-bold">MagicTales</h1>
            <p className="text-xs text-slate-500">Personalized, place-aware storybooks</p>
          </div>
        </div>
        <nav className="hidden md:flex gap-6 text-sm text-slate-600">
          <a href="#features" className="hover:text-slate-900">Features</a>
          <a href="#how" className="hover:text-slate-900">How it works</a>
          <a href="/demo" className="text-blue-700 font-medium">Try the demo →</a>
        </nav>
      </header>
      <section className="max-w-7xl mx-auto px-6 py-16 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <h2 className="text-4xl md:text-5xl font-extrabold leading-tight text-slate-900">
            Make your child the <span className="text-blue-700">hero</span><br/>of a real-city adventure.
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Upload an avatar, pick a city, and get a beautifully illustrated book that visits <em>real</em> landmarks. Designed for print. Powered by AI.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/demo" className="px-5 py-3 rounded-lg bg-blue-600 text-white shadow hover:bg-blue-700">Generate a Storybook</a>
            <a href="#features" className="px-5 py-3 rounded-lg border">See features</a>
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-blue-200 via-white to-amber-200 border shadow-inner overflow-hidden">
            <div className="absolute inset-6 rounded-2xl border-2 border-dashed border-slate-300 grid place-items-center text-slate-500">
              Preview your book in seconds
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-slate-600">
            <div className="p-3 bg-white rounded-xl border shadow-sm">Real landmarks</div>
            <div className="p-3 bg-white rounded-xl border shadow-sm">Face-lock avatar</div>
            <div className="p-3 bg-white rounded-xl border shadow-sm">Print-ready PDF</div>
          </div>
        </div>
      </section>
      <section id="features" className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-6">
        {[
          { t: 'Localized accuracy', d: 'We stitch templates with curated landmark data for city-correct scenes.'},
          { t: 'Instant layout', d: 'Auto-generates pages and composes a clean, printable PDF.'},
          { t: 'Interactive editor', d: 'Swap scenes, edit copy, reorder, and re-generate.'},
        ].map((f,i)=> (
          <div key={i} className="bg-white rounded-2xl border p-5 shadow-sm">
            <div className="text-blue-700 font-semibold">{f.t}</div>
            <p className="text-slate-600 text-sm mt-1">{f.d}</p>
          </div>
        ))}
      </section>
      <section id="how" className="max-w-7xl mx-auto px-6 py-12">
        <h3 className="font-bold text-xl mb-4">How it works</h3>
        <ol className="grid md:grid-cols-3 gap-6 text-sm">
          <li className="bg-white rounded-2xl border p-5"><span className="font-semibold">1) Upload an avatar</span><br/>Optionally add a reference photo for likeness.</li>
          <li className="bg-white rounded-2xl border p-5"><span className="font-semibold">2) Pick a city</span><br/>We use curated landmarks and templates.</li>
          <li className="bg-white rounded-2xl border p-5"><span className="font-semibold">3) Generate & print</span><br/>Get images + a polished PDF.</li>
        </ol>
      </section>
      <footer className="py-10 text-center text-xs text-slate-500">MagicTales © {new Date().getFullYear()}</footer>
    </main>
  );
}
