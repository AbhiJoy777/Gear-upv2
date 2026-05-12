import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import {
  formatRentalTimelineDate,
  getRentalTimelineIndex,
  getRentalTimestamp,
  RENTAL_TIMELINE_STAGES,
} from '@/lib/rentalStatus';

export default function RentalTimeline({ rental, compact = false }: { rental: any; compact?: boolean }) {
  const currentIndex = getRentalTimelineIndex(rental?.status);

  return (
    <div className={`w-full rounded-[16px] border border-white/[0.06] bg-black/20 ${compact ? 'p-3' : 'p-4'}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {RENTAL_TIMELINE_STAGES.map((stage, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const timestamp = getRentalTimestamp(rental, stage);

          return (
            <div
              key={stage.key}
              className={`min-w-0 rounded-[12px] border px-2.5 py-2 transition-all ${
                current
                  ? 'border-[#A855F7]/50 bg-[#A855F7]/15 shadow-[0_0_18px_rgba(168,85,247,0.18)]'
                  : completed
                    ? 'border-[#2DD4BF]/25 bg-[#2DD4BF]/10'
                    : 'border-white/[0.05] bg-white/[0.02] opacity-60'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {completed ? (
                  <CheckCircle2 size={12} className="text-[#2DD4BF] shrink-0" />
                ) : (
                  <Circle size={12} className={`${current ? 'text-[#A855F7]' : 'text-white/25'} shrink-0`} />
                )}
                <span className={`truncate text-[10px] font-bold uppercase tracking-wider ${
                  current ? 'text-white' : completed ? 'text-[#2DD4BF]' : 'text-white/35'
                }`}>
                  {stage.label}
                </span>
              </div>
              <p className="mt-1 text-[10px] text-white/30 truncate">
                {formatRentalTimelineDate(timestamp) || (current ? 'Now' : 'Pending')}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
