import Link from "next/link";
import type { PatientSummary } from "@hep/shared-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PatientResultsTableProps {
  patients: PatientSummary[];
  /** BAC-20, RBAC: hidden entirely for a caller without `read_encounter` -- `EncounterPage`'s own `RequirePermission` is the real enforcement, this just avoids advertising an action that would 403. */
  canViewEncounters?: boolean;
}

/** BAC-17, AC2: one row per patient search result. */
export function PatientResultsTable({
  patients,
  canViewEncounters = false,
}: PatientResultsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>MRN</TableHead>
          <TableHead>Date of birth</TableHead>
          <TableHead>Gender</TableHead>
          <TableHead>Contact</TableHead>
          {canViewEncounters && <TableHead>Chart</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => (
          <TableRow key={patient.id}>
            <TableCell className="font-medium text-foreground">
              {patient.lastName}, {patient.firstName}
            </TableCell>
            <TableCell className="font-mono text-muted-foreground">
              {patient.mrn}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {patient.dateOfBirth}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {patient.gender ?? "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              <div className="flex flex-col">
                <span>{patient.phone ?? "—"}</span>
                <span>{patient.email ?? "—"}</span>
              </div>
            </TableCell>
            {canViewEncounters && (
              <TableCell>
                <Link
                  href={`/patients/${patient.id}/encounters`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View chart
                </Link>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
