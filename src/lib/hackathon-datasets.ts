export type HackathonDataset = {
  id: string;
  title: string;
  description: string;
  filename: string;
  path: string;
  rows: number;
  columns: string[];
};

/** Hosted datasets for the hackathon Data tab. Files live under /public/data. */
export const HACKATHON_DATASETS: HackathonDataset[] = [];
