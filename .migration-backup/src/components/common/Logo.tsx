import React from 'react';
import { Gamepad2 } from 'lucide-react';

export default function Logo({ size = 32, className = "" }: { size?: number, className?: string }) {
  return (
    <div className={`relative flex items-center justify-center bg-white/5 rounded-xl p-2 overflow-hidden border border-white/10 ${className}`} style={{ width: size, height: size }}>
      <Gamepad2 size={size * 0.6} className="text-white" strokeWidth={2.5} />
      <div className="fifa-glare" />
    </div>
  );
}
