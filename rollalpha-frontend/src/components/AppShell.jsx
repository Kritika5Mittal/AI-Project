import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, GitCompare, Calculator, PiggyBank, ArrowLeftRight, MessageSquare, Menu, X } from "lucide-react";
import Logo from "./Logo.jsx";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/compare", label: "Compare funds", icon: GitCompare },
  { to: "/xirr", label: "XIRR calculator", icon: Calculator },
  { to: "/sip", label: "SIP calculator", icon: PiggyBank },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/chat", label: "AI assistant", icon: MessageSquare },
];

function NavList({ onNavigate }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive ? "bg-navy-800 text-white" : "text-navy-300 hover:bg-navy-900 hover:text-white"
            }`
          }
        >
          <Icon className="h-[18px] w-[18px]" aria-hidden /> {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-navy-950 p-4 lg:flex">
        <Link to="/" className="mb-8 px-2 pt-2"><Logo light /></Link>
        <NavList />
        <p className="mt-auto px-2 text-xs leading-relaxed text-navy-300">
          Historical analysis only. Not investment advice.
        </p>
      </aside>

      {/* Mobile / tablet top bar with collapsible menu */}
      <div className="lg:hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-navy-950 px-4 py-3">
          <Link to="/"><Logo light /></Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="rounded-lg p-2 text-white hover:bg-navy-800"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </header>
        {open && (
          <div id="mobile-menu" className="fixed inset-x-0 top-[52px] z-20 bg-navy-950 p-3 shadow-lg">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
        )}
      </div>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}
