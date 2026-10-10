"use client";

import { useEffect } from "react";
import AdvancedSettingsPanel from "./AdvancedSettingsPanel";
import { AdvancedSettings, DEFAULT_SETTINGS } from "@/lib/settings";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: AdvancedSettings;
  onChange: (s: AdvancedSettings) => void;
}

export default function SettingsModal({ open, onClose, settings, onChange }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold">⚙️ All yt-dlp settings</h2>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-md px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <AdvancedSettingsPanel settings={settings} onChange={onChange} />
        </div>

        <footer className="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
          <button
            onClick={() => onChange({ ...DEFAULT_SETTINGS })}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            ↺ Reset to defaults
          </button>
          <button
            onClick={onClose}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
          >
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
