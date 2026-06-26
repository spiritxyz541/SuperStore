// src/components/OTInput.jsx
import React, { useState } from 'react';

const OT_OPTIONS = [0, 0.5, 1, 1.5, 2, 3, 4];

export default function OTInput({ currentOt = 0, onChange }) {
  const [open, setOpen] = useState(false);
  const display = currentOt > 0 ? `OT ${currentOt}` : 'OT 0';
  return (
    <div className="relative inline-block print:hidden" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className="text-[6px] sm:text-[7px] font-black text-rose-600 bg-rose-50 rounded border border-rose-200 px-0.5"
        onClick={() => setOpen(!open)}
      >
        {display}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 bg-white border border-slate-200 rounded shadow-lg p-1 flex flex-col gap-0.5">
          {OT_OPTIONS.map(v => (
            <button
              key={v}
              type="button"
              className={`px-2 py-1 text-xs rounded ${v === currentOt ? 'bg-indigo-500 text-white' : 'hover:bg-slate-100'}`}
              onClick={() => { onChange(v); setOpen(false); }}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
