"use client";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faShieldAlt } from '@fortawesome/free-solid-svg-icons';



import {useState, useEffect} from "react";
import {useRouter} from "next/navigation";
import {useAuth} from "@/lib/AuthContext";

function ShieldEyeIcon(p) { return <FontAwesomeIcon icon={faShieldAlt} className={p.className || ''} /> ; }

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const {user, loading, login} = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#14171c]">
        <div className="animate-pulse text-[#5a6270] text-sm font-bold tracking-widest uppercase font-mono">
          Loading...
        </div>
      </div>
    );
  }

  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#14171c] relative overflow-hidden pattern-grid">
      <div className="absolute inset-0 bg-gradient-to-b from-[#14171c] via-transparent to-[#14171c] pointer-events-none" />

      <div className="w-full max-w-md mx-4 animate-fade-in relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded flex items-center justify-center">
            <img src="/logo.png" alt="VeriVision Logo" className="w-14 h-14 object-contain" />
          </div>
          <h1 className="text-2xl font-display font-bold text-[#e4e7eb] tracking-wide uppercase">
            VeriVision
          </h1>
          <p className="text-sm text-[#5a6270] mt-1">
            AI-Powered Visual Inspection Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded bg-[#181c22] border border-[#2b313a] shadow-2xl p-8 relative">
          <div className="absolute top-0 left-6 right-6 h-[2px] bg-gradient-to-r from-[#f5a623] to-transparent opacity-60" />
          <h2 className="text-lg font-semibold text-[#dbe0e6] mb-6 font-display uppercase tracking-wide">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-[#5a6270] uppercase tracking-wider mb-2 font-mono">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] placeholder-[#3a4149] focus:outline-none focus:border-[#f5a623]/60 focus:ring-1 focus:ring-[#f5a623]/25 transition-all text-sm"
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#5a6270] uppercase tracking-wider mb-2 font-mono">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded bg-[#0f1216] border border-[#2b313a] text-[#dbe0e6] placeholder-[#3a4149] focus:outline-none focus:border-[#f5a623]/60 focus:ring-1 focus:ring-[#f5a623]/25 transition-all text-sm"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded bg-[#e5484d]/10 border border-[#e5484d]/30 text-[#f26e72] text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded bg-[#f5a623] hover:bg-[#ffb63f] text-[#14171c] font-bold text-sm shadow-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-display">
              {submitting ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#2b313a]">
            <p className="text-[11px] text-[#5a6270] text-center">
              Default accounts:{" "}
              <span className="text-[#8a93a3] font-mono">admin / admin123</span>{" "}
              or{" "}
              <span className="text-[#8a93a3] font-mono">
                inspector / inspect123
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
