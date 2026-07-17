"use client";

import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PatientSearchFilters {
  name: string;
  mrn: string;
  dateOfBirth: string;
}

export interface PatientSearchFormProps {
  onSubmit: (filters: PatientSearchFilters) => void;
}

/** BAC-17, AC2: filters `GET /patients` by name, MRN, and/or date of birth -- every field optional and combinable. */
export function PatientSearchForm({ onSubmit }: PatientSearchFormProps) {
  const { register, handleSubmit } = useForm<PatientSearchFilters>({
    defaultValues: { name: "", mrn: "", dateOfBirth: "" },
  });

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="search-name">Name</Label>
        <Input
          id="search-name"
          className="h-10 w-48"
          placeholder="First or last name"
          {...register("name")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="search-mrn">MRN</Label>
        <Input
          id="search-mrn"
          className="h-10 w-40 font-mono"
          {...register("mrn")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="search-dateOfBirth">Date of birth</Label>
        <Input
          id="search-dateOfBirth"
          type="date"
          className="h-10"
          {...register("dateOfBirth")}
        />
      </div>

      <Button type="submit" className="h-10">
        Search
      </Button>
    </form>
  );
}
