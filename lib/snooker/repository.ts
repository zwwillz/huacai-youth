import type { SnookerDashboardSnapshot, SnookerEvent, SnookerPlayer, SnookerRankingRow } from "./domain";
import { dashboardSnapshot } from "./foundation";

export type SnookerRepositoryMode = "verified-snapshot" | "supabase";

export type SnookerRepository = {
  mode: SnookerRepositoryMode;
  getDashboard(): Promise<SnookerDashboardSnapshot>;
  getEvent(slug: string): Promise<SnookerEvent | null>;
  getPlayers(): Promise<SnookerPlayer[]>;
  getRankings(): Promise<SnookerRankingRow[]>;
};

export const snapshotSnookerRepository: SnookerRepository = {
  mode: "verified-snapshot",
  async getDashboard() {
    return dashboardSnapshot;
  },
  async getEvent(slug) {
    return dashboardSnapshot.event.slug === slug ? dashboardSnapshot.event : null;
  },
  async getPlayers() {
    return dashboardSnapshot.players;
  },
  async getRankings() {
    return dashboardSnapshot.rankings;
  },
};

export function getSnookerRepository(): SnookerRepository {
  return snapshotSnookerRepository;
}
