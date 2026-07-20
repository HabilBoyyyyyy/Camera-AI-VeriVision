"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import * as api from "@/lib/api";

export default function UsersPage() {
  const { isAdmin } = useAuth();
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("inspector");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <span className="material-symbols-outlined text-[64px] mb-4" style={{color: "var(--clr-error)", opacity: 0.8}}>gpp_bad</span>
        <h2 className="text-xl font-bold" style={{color: "var(--clr-text)"}}>Access Denied</h2>
        <p className="mt-2 text-sm" style={{color: "var(--clr-text-muted)"}}>Only administrators can access this page.</p>
      </div>
    );
  }

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await api.registerUser(username, password, role);
      setSuccess(`User ${username} registered successfully as ${role}.`);
      setUsername("");
      setPassword("");
      setRole("inspector");
    } catch (err) {
      setError(err.message || "Failed to register user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{color: "var(--clr-text)"}}>User Management</h1>
        <p className="text-sm mt-1" style={{color: "var(--clr-text-sub)"}}>Create and manage inspector accounts.</p>
      </div>

      <div className="vv-card p-6">
        <h2 className="text-base font-semibold mb-6 flex items-center gap-2" style={{color: "var(--clr-text)"}}>
          <span className="material-symbols-outlined">person_add</span>
          Register New Account
        </h2>

        {error && (
          <div className="mb-6 p-4 rounded-md text-sm border flex items-start gap-2" style={{background: "rgba(186, 26, 26, 0.1)", borderColor: "rgba(186, 26, 26, 0.3)", color: "var(--clr-error)"}}>
            <span className="material-symbols-outlined text-[18px]">error</span>
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-md text-sm border flex items-start gap-2" style={{background: "rgba(22, 163, 74, 0.1)", borderColor: "rgba(22, 163, 74, 0.3)", color: "var(--clr-success)"}}>
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <div>{success}</div>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{color: "var(--clr-text-sub)"}}>Username</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 border rounded-md text-sm transition-colors"
              style={{background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)"}}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. inspector_john"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{color: "var(--clr-text-sub)"}}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              className="w-full px-3 py-2 border rounded-md text-sm transition-colors"
              style={{background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)"}}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 6 characters"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{color: "var(--clr-text-sub)"}}>Role</label>
            <select
              className="w-full px-3 py-2 border rounded-md text-sm transition-colors"
              style={{background: "var(--clr-surface)", borderColor: "var(--clr-border)", color: "var(--clr-text)"}}
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="inspector">Inspector</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading || !username || !password}
              className="btn-primary w-full justify-center"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                  Registering...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">person_add</span>
                  Create Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
