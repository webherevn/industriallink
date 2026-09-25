'use client';

import { useState } from 'react';
import { JobTrack } from '@industriallink/contracts';
import { JdSalesCreateFlow } from './sales-create-flow';
import { JdTechnicalCreateFlow } from './technical-create-flow';

export default function NewJobPage() {
  const [track, setTrack] = useState<JobTrack>(JobTrack.Sales);
  if (track === JobTrack.Technical) {
    return <JdTechnicalCreateFlow onSwitchTrack={setTrack} />;
  }
  return <JdSalesCreateFlow onSwitchTrack={setTrack} />;
}
