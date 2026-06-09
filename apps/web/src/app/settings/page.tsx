import type { SourceConfig } from "@homejobboard/shared";
import { ProfileEditor } from "@/components/profile-editor";
import { SourceToggles } from "@/components/source-toggles";
import { getSettings, listSources, type SettingRow } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Settings() {
  let settings: SettingRow[] = [];
  let sources: SourceConfig[] = [];
  try {
    [settings, sources] = await Promise.all([getSettings(), listSources()]);
  } catch {
    return <p className="text-red-600 text-sm">Failed to load settings (is the API running?).</p>;
  }

  const profile = settings.find((s) => s.key === "fitness_profile")?.value ?? "";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="font-semibold text-lg">Fitness profile</h1>
        <p className="text-muted text-sm">
          The LLM scores each job against this. Be specific about role, stack, level, location,
          comp, and dealbreakers.
        </p>
        <ProfileEditor initial={profile} />
      </section>

      <section className="space-y-2">
        <h1 className="font-semibold text-lg">Sources</h1>
        <SourceToggles sources={sources} />
      </section>
    </div>
  );
}
