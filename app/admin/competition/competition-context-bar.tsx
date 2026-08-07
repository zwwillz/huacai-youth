import Link from "next/link";
import type { CompetitionContextGroup } from "@/db/competition-context";

export type CompetitionPhaseOption = { code: string; title: string; hint?: string; disabled?: boolean };

type Props = {
  eventId: string;
  eventTitle: string;
  groups: CompetitionContextGroup[];
  selectedGroupId: string;
  basePath: string;
  phases?: CompetitionPhaseOption[];
  selectedPhase?: string;
  extraQuery?: Record<string, string | undefined>;
  eyebrow?: string;
  title?: string;
  description?: string;
};

function href(path: string, eventId: string, groupId: string, phase: string | undefined, extra?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  params.set("event", eventId);
  params.set("group", groupId);
  if (phase) params.set("phase", phase);
  for (const [key, value] of Object.entries(extra ?? {})) if (value) params.set(key, value);
  return `${path}?${params.toString()}`;
}

export default function CompetitionContextBar({ eventId, eventTitle, groups, selectedGroupId, basePath, phases = [], selectedPhase, extraQuery, eyebrow = "竞赛执行", title, description }: Props) {
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  return <section className="competition-context-bar">
    <div className="competition-context-top">
      <div className="competition-context-copy"><small>{eyebrow}</small><h2>{title || eventTitle}</h2>{description && <p>{description}</p>}</div>
      <div className="competition-group-toggle" aria-label="选择比赛组别">
        {groups.map((group) => <Link key={group.id} className={group.id === selectedGroup?.id ? "active" : ""} href={href(basePath, eventId, group.id, selectedPhase, extraQuery)}><b>{group.code}</b><span>{group.name}</span></Link>)}
      </div>
    </div>
    {phases.length > 0 && <nav className="competition-phase-toggle" aria-label="选择比赛阶段">
      {phases.map((phase) => phase.disabled ? <span key={phase.code} className="disabled"><strong>{phase.title}</strong>{phase.hint && <small>{phase.hint}</small>}</span> : <Link key={phase.code} className={phase.code === selectedPhase ? "active" : ""} href={href(basePath, eventId, selectedGroup?.id || selectedGroupId, phase.code, extraQuery)}><strong>{phase.title}</strong>{phase.hint && <small>{phase.hint}</small>}</Link>)}
    </nav>}
  </section>;
}
