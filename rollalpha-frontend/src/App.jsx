import { Route, Routes, Link } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Landing from "./pages/Landing.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Compare from "./pages/Compare.jsx";
import Xirr from "./pages/Xirr.jsx";
import Sip from "./pages/Sip.jsx";
import Chat from "./pages/Chat.jsx";
import Transactions from "./pages/Transactions.jsx";

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="mt-2 text-slate-600">The page you opened doesn't exist.</p>
        <Link to="/dashboard" className="mt-4 inline-block font-medium text-navy-700 underline">Go to dashboard</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/xirr" element={<Xirr />} />
        <Route path="/sip" element={<Sip />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/chat" element={<Chat />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
