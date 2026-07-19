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
}

/** BAC-17, AC2: one row per patient search result. */
export function PatientResultsTable({ patients }: PatientResultsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Patient</TableHead>
          <TableHead>MRN</TableHead>
          <TableHead>Date of birth</TableHead>
          <TableHead>Gender</TableHead>
          <TableHead>Contact</TableHead>
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
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
