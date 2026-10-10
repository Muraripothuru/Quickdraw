import Link from "next/link";
import {
  IconCheck,
  IconChevronRight,
  IconLink,
  IconList,
  IconPrinter,
  IconSpark,
  IconTrophy,
  IconUser,
  Logo,
} from "@/components/ui/icons";

const useCases = [
  { title: "Giveaways", text: "Pick winners from comments, entries or sign-ups." },
  { title: "College Events", text: "Randomise stage slots, prizes and teams." },
  { title: "Office Activities", text: "Ice-breakers, raffles and duty rosters." },
  { title: "Classroom Draws", text: "Fair turns, random groups and question picking." },
  { title: "Competitions", text: "Audition shortlists and jury selection." },
  { title: "Raffles", text: "Ticketed draws with verifiable results." },
  { title: "Team Selection", text: "Squads, pairings and code review rotation." },
  { title: "Random Picker", text: "One-off decisions from any name list." },
];

const steps = [
  { n: "01", title: "Create the draw", text: "Add a title, paste or upload names, or load a saved roster in one click." },
  { n: "02", title: "Set safeguards", text: "Choose how many winners you need. The system blocks invalid counts before you start." },
  { n: "03", title: "Spin to select", text: "A cryptographic RNG picks from the active pool and removes each winner automatically." },
  { n: "04", title: "Share results", text: "Publish a verification link, then export CSV or a printable PDF report." },
];

const modes = [
  { title: "Wheel of Fortune", text: "Smooth deceleration physics with ticking audio and a perfect landing." },
  { title: "Slot Machine Reel", text: "Vertical drums slow down and lock the centre row on the winner." },
  { title: "Rapid Shuffle", text: "High-velocity name cycling that eases out into a final reveal." },
  { title: "Card Reveal", text: "A mystery stack flips the top card into a neon glow." },
];

const features = [
  {
    icon: IconList,
    title: "Saved participant rosters",
    text: "Store named lists such as \u201c5th Grade Class\u201d or \u201cDev Ops Team\u201d and load them into any new draw instantly.",
  },
  {
    icon: IconTrophy,
    title: "Winner elimination engine",
    text: "Each selection runs as an atomic database transaction, so a selected participant can never win twice.",
  },
  {
    icon: IconLink,
    title: "Public verification links",
    text: "Every draw gets a shareable page with timestamps, seed commitment hashes and the full winner record.",
  },
  {
    icon: IconPrinter,
    title: "CSV & printable PDF",
    text: "One-click CSV export and a print-formatted report built for projectors, notices and records.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="LuckyDraw home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-2" aria-label="Marketing">
            <a
              href="#how"
              className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-white sm:block"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hidden rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-white sm:block"
            >
              Features
            </a>
            <Link href="/auth" className="btn btn-ghost btn-sm hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/draw/new" className="btn btn-primary btn-sm">
              Create a Draw
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_0%,rgba(99,102,241,0.22),transparent_70%)]"
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-24">
            <span className="chip border-accent/40 bg-accent/10 text-indigo-200">
              <IconSpark width={14} height={14} />
              Cryptographically secure randomness
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">
              LuckyDraw — Fair random draws. Simple to run.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">
              Create a draw, save participant lists, select winners, and share
              verified results.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/draw/new" className="btn btn-primary btn-lg w-full sm:w-auto">
                Create a Draw
                <IconChevronRight width={18} height={18} />
              </Link>
              <a href="#how" className="btn btn-outline btn-lg w-full sm:w-auto">
                How It Works
              </a>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                ["4", "reveal animations"],
                ["1 click", "roster loading"],
                ["0", "duplicate winners"],
                ["CSV + PDF", "export ready"],
              ].map(([value, label]) => (
                <div key={label} className="card px-4 py-5">
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1.5 text-2xl font-bold text-white">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="card mt-8 overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-mint" />
                  Monthly Newsletter Subscribers
                </div>
                <span className="chip border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                  12 remaining
                </span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
                {[
                  ["Winner #1", "Amara Okafor", "2 entries"],
                  ["Winner #2", "Diego Ram\u00edrez", "1 entry"],
                  ["Winner #3", "Mei-Ling Chen", "3 entries"],
                ].map(([order, name, weight], index) => (
                  <div
                    key={order}
                    className={`rounded-2xl border p-4 ${
                      index === 0
                        ? "border-accent/50 bg-accent/10"
                        : "border-line bg-panel2/70"
                    }`}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {order}
                    </p>
                    <p className="mt-1 truncate text-lg font-bold text-white">{name}</p>
                    <p className="mt-1 text-xs text-slate-500">{weight} in pool</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-panel/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              Built for every kind of draw
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map((item) => (
                <div
                  key={item.title}
                  className="card p-5 transition hover:border-accent/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-indigo-300">
                      <IconUser width={18} height={18} />
                    </span>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-400">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <span className="chip">How it works</span>
          <h2 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            Four steps from name list to verified result
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.n} className="card p-5">
                <p className="font-mono text-sm font-bold text-accent2">{step.n}</p>
                <h3 className="mt-3 font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-line bg-panel/40">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
            <span className="chip">Reveal modes</span>
            <h2 className="mt-4 max-w-2xl text-2xl font-bold text-white sm:text-3xl">
              Pick the animation that fits the room
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {modes.map((mode) => (
                <div key={mode.title} className="card relative overflow-hidden p-5">
                  <div
                    aria-hidden="true"
                    className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/20 blur-2xl"
                  />
                  <h3 className="relative font-semibold text-white">{mode.title}</h3>
                  <p className="relative mt-2 text-sm leading-relaxed text-slate-400">
                    {mode.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="card flex gap-4 p-6">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mint/15 text-mint">
                    <Icon width={20} height={20} />
                  </span>
                  <div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {feature.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="card mt-6 p-6">
            <div className="flex flex-wrap items-center gap-3">
              {[
                "Email & password sign-in",
                "Guest mode, no account needed",
                "Real-time pool updates",
                "Keyboard accessible",
                "Mobile-first layouts",
              ].map((item) => (
                <span key={item} className="chip">
                  <IconCheck width={14} height={14} className="text-mint" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <div className="card relative overflow-hidden p-8 text-center sm:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(99,102,241,0.25),transparent_70%)]"
            />
            <h2 className="relative text-2xl font-bold text-white sm:text-4xl">
              Ready to run a fair draw?
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-slate-400">
              No setup, no spreadsheets. Load your names and spin in under a minute.
            </p>
            <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/draw/new" className="btn btn-primary btn-lg w-full sm:w-auto">
                Create a Draw
              </Link>
              <Link href="/dashboard" className="btn btn-outline btn-lg w-full sm:w-auto">
                Open Dashboard
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="text-sm text-slate-500">
            Fair random draws for giveaways, classrooms and teams.
          </p>
          <div className="flex gap-4 text-sm text-slate-500">
            <a href="#how" className="hover:text-white">
              How it works
            </a>
            <Link href="/auth" className="hover:text-white">
              Sign in
            </Link>
            <Link href="/verify" className="hover:text-white">
              Verify a draw
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
