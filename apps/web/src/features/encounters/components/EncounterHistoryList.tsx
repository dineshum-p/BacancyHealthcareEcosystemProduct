import type { EncounterSummary, VitalSigns } from "@hep/shared-types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface EncounterHistoryListProps {
  encounters: EncounterSummary[] | undefined;
  isLoading: boolean;
  isError: boolean;
}

/**
 * BAC-20, AC1/AC2/AC3: a patient's signed encounter history, most recent
 * first, with loading/error/empty states matching
 * `PatientSearchPage`'s established pattern. Read-only by construction --
 * this component renders NO edit affordance for any encounter, because
 * `services/emr` has no update endpoint for an encounter once created
 * (BAC-15 only ships `POST`/`GET`): "signing" a note IS creating it, so
 * every encounter that reaches this list is already immutable. This
 * satisfies both halves of BAC-20's RBAC: `clinic_admin`'s read-only
 * oversight view and "no edit controls after signing" for every role.
 */
export function EncounterHistoryList({
  encounters,
  isLoading,
  isError,
}: EncounterHistoryListProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">
        Loading encounter history…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load this patient&apos;s encounter history. Please try
        again.
      </p>
    );
  }

  if (!encounters || encounters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No encounter notes yet for this patient.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {encounters.map((encounter) => (
        <EncounterCard key={encounter.id} encounter={encounter} />
      ))}
    </div>
  );
}

function EncounterCard({ encounter }: { encounter: EncounterSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Encounter note — {new Date(encounter.createdAt).toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <SoapField label="Subjective" value={encounter.soapNote.subjective} />
          <SoapField label="Objective" value={encounter.soapNote.objective} />
          <SoapField label="Assessment" value={encounter.soapNote.assessment} />
          <SoapField label="Plan" value={encounter.soapNote.plan} />
        </dl>

        {encounter.vitals && <VitalsSummary vitals={encounter.vitals} />}

        {encounter.allergies.length > 0 && (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Allergies
            </p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {encounter.allergies.map((allergy) => (
                <li key={allergy.substance} className="flex items-center gap-1">
                  <Badge variant="outline">{allergy.substance}</Badge>
                  {allergy.severity && (
                    <span className="text-xs text-muted-foreground">
                      {allergy.severity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SoapField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
        {value}
      </dd>
    </div>
  );
}

function VitalsSummary({ vitals }: { vitals: VitalSigns }) {
  const entries: string[] = [];
  if (vitals.heartRate !== undefined) entries.push(`${vitals.heartRate} bpm`);
  if (
    vitals.bloodPressureSystolic !== undefined &&
    vitals.bloodPressureDiastolic !== undefined
  ) {
    entries.push(
      `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic} mmHg`,
    );
  }
  if (vitals.temperature !== undefined) entries.push(`${vitals.temperature}°C`);
  if (vitals.respiratoryRate !== undefined)
    entries.push(`${vitals.respiratoryRate} breaths/min`);
  if (vitals.spO2 !== undefined) entries.push(`${vitals.spO2}%`);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Vitals
      </p>
      <p className="mt-0.5 text-sm text-foreground">{entries.join(" · ")}</p>
    </div>
  );
}
