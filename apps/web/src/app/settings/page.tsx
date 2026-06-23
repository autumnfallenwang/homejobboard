import { type JobFilters, jobFiltersSchema, type SourceConfig } from "@homejobboard/shared";
import { FiltersEditor } from "@/components/filters-editor";
import { ProfileEditor } from "@/components/profile-editor";
import { SourceToggles } from "@/components/source-toggles";
import { getSettings, listSources, type SettingRow } from "@/lib/api";

export const dynamic = "force-dynamic";

function parseFilters(raw: string | undefined): JobFilters {
  try {
    return jobFiltersSchema.parse(JSON.parse(raw ?? "{}"));
  } catch {
    return jobFiltersSchema.parse({});
  }
}

export default async function Settings() {
  let settings: SettingRow[] = [];
  let sources: SourceConfig[] = [];
  try {
    [settings, sources] = await Promise.all([getSettings(), listSources()]);
  } catch {
    return (
      <p className="rounded border border-primary/40 bg-primary/5 p-3 font-mono text-primary text-sm">
        Failed to load settings (is the API running?).
      </p>
    );
  }

  const profile = settings.find((s) => s.key === "fitness_profile")?.value ?? "";
  const filters = parseFilters(settings.find((s) => s.key === "job_filters")?.value);

  return (
    <div className="max-w-3xl space-y-10">
      <Section
        n="01"
        title="Fitness profile"
        hint="The LLM scores every new job against this. Be specific about role, stack, level, location, comp, and dealbreakers."
      >
        <ProfileEditor initial={profile} />
      </Section>

      <Section
        n="02"
        title="Pre-filters"
        hint="Applied at ingestion, before storing or scoring — cuts noise and LLM cost. Empty = keep everything."
      >
        <FiltersEditor initial={filters} />
      </Section>

      <Section
        n="03"
        title="Sources"
        hint="Boards polled on the schedule. ATS boards are per-company — add any company that runs Greenhouse, Lever, or Ashby."
      >
        <SourceToggles sources={sources} />
      </Section>
    </div>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 border-border border-b pb-2">
        <h1 className="font-display text-xl">
          <span className="me-3 font-mono text-muted text-sm tabular-nums">{n}</span>
          {title}
        </h1>
        <p className="mt-1 text-muted text-sm">{hint}</p>
      </div>
      {children}
    </section>
  );
}
