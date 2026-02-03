"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ToastContainer, toast } from "react-toastify";
import { FiMail, FiLock } from "react-icons/fi";
import { LuFingerprint } from "react-icons/lu";
import "react-toastify/dist/ReactToastify.css";

const Login: React.FC = () => {
  const [Email, setEmail] = useState("");
  const [Password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isWebAuthnSupported = () =>
    typeof window !== "undefined" &&
    window.PublicKeyCredential &&
    typeof window.PublicKeyCredential === "function";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!Email || !Password) {
        toast.error("Email and Password are required!");
        return;
      }

      setLoading(true);
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ Email, Password }),
        });

        const result = await response.json();

        if (response.ok && result.userId) {
          toast.success("Login successful!");
          setTimeout(() => {
            router.push(
              `/Acculog/Attendance/Dashboard?id=${encodeURIComponent(result.userId)}`
            );
          }, 800);
        } else {
          toast.error(result.message || "Login failed!");
        }
      } catch {
        toast.error("An error occurred while logging in!");
      } finally {
        setLoading(false);
      }
    },
    [Email, Password, router]
  );

  const handleVerifyFingerprint = async () => {
    if (!isWebAuthnSupported()) {
      toast.error("WebAuthn is not supported in this browser.");
      return;
    }
    toast.info("Fingerprint login feature coming soon!");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-cyan-50 via-white to-cyan-100">
      <ToastContainer className="text-xs" />

      <div className="relative z-10 w-full max-w-md p-8 bg-white shadow-lg rounded-2xl border border-gray-200">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6 text-center">
          <Image
            src="/acculog.png"
            alt="Acculog Logo"
            width={220}
            height={60}
            className="mb-3 rounded-md"
          />
          <p className="text-xs text-gray-500 font-medium">
            Time & Attendance Tracking
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 shadow-sm border border-gray-200">
            <FiMail className="text-cyan-600" />
            <input
              type="email"
              placeholder="Email"
              value={Email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            />
          </div>

          {/* Password */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 shadow-sm border border-gray-200">
            <FiLock className="text-cyan-600" />
            <input
              type="password"
              placeholder="Password"
              value={Password}
              onChange={(e) => setPassword(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-gray-800"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold text-sm rounded-lg transition-all duration-300 shadow-md hover:scale-[1.02] disabled:opacity-60"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-4 text-[10px] text-center text-gray-400 font-medium">
          Acculog © {new Date().getFullYear()} | Attendance & Time Tracking System
        </p>
      </div>
    </div>
  );
};

export default Login;
