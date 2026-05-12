import React from 'react';
import {
  getRentalTimelineIndex,
  RENTAL_TIMELINE_STAGES,
} from '@/lib/rentalStatus';

export function RentalTimelineSummary({ rental }: { rental: any }) {
  const currentIndex = getRentalTimelineIndex(rental?.status);
  const currentStage = RENTAL_TIMELINE_STAGES[currentIndex] || RENTAL_TIMELINE_STAGES[0];
  const progress = RENTAL_TIMELINE_STAGES.length <= 1
    ? 0
    : (currentIndex / (RENTAL_TIMELINE_STAGES.length - 1)) * 100;

  return (
    <div className="w-full rounded-[14px] border border-white/[0.05] bg-black/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] text-white/35 font-bold uppercase tracking-wider">Lifecycle</span>
        <span className="text-[11px] text-white font-bold truncate">{currentStage.label}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#A855F7] rounded-full shadow-[0_0_12px_rgba(168,85,247,0.45)] transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        {RENTAL_TIMELINE_STAGES.map((stage, index) => (
          <span
            key={stage.key}
            className={`h-1.5 w-1.5 rounded-full ${
              index <= currentIndex ? 'bg-[#A855F7]' : 'bg-white/15'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function RentalTimeline({ rental }: { rental: any; compact?: boolean }) {
  return <RentalTimelineSummary rental={rental} />;
}
