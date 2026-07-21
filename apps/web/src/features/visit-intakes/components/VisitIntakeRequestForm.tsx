"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { CreateVisitIntakeRequest } from "@hep/shared-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const visitIntakeRequestFormSchema = z.object({
  reasonForVisit: z.string().trim().min(1, "Reason for visit is required"),
  symptoms: z.string().trim().min(1, "Symptoms are required"),
  whatsNewSinceLastVisit: z.string().trim(),
});

type VisitIntakeRequestFormValues = z.infer<
  typeof visitIntakeRequestFormSchema
>;

function toCreateVisitIntakeRequest(
  values: VisitIntakeRequestFormValues,
): CreateVisitIntakeRequest {
  return {
    reasonForVisit: values.reasonForVisit,
    symptoms: values.symptoms,
    ...(values.whatsNewSinceLastVisit
      ? { whatsNewSinceLastVisit: values.whatsNewSinceLastVisit }
      : {}),
  };
}

export interface VisitIntakeRequestFormProps {
  onSubmit: (input: CreateVisitIntakeRequest) => void;
  isSubmitting: boolean;
}

/**
 * BAC-47, AC1: "Request a Visit" -- reason for visit, current symptoms, and
 * anything new/changed since the patient's last visit (optional). Mirrors
 * `SoapNoteForm`'s multi-line `TextField` shape (a plain `<textarea>`, no
 * dedicated `ui/textarea` component exists in this codebase yet).
 */
export function VisitIntakeRequestForm({
  onSubmit,
  isSubmitting,
}: VisitIntakeRequestFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VisitIntakeRequestFormValues>({
    resolver: zodResolver(visitIntakeRequestFormSchema),
    defaultValues: {
      reasonForVisit: "",
      symptoms: "",
      whatsNewSinceLastVisit: "",
    },
  });

  function submit(values: VisitIntakeRequestFormValues) {
    onSubmit(toCreateVisitIntakeRequest(values));
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => void handleSubmit(submit)(event)}
      noValidate
    >
      <TextField
        id="reasonForVisit"
        label="Reason for visit"
        error={errors.reasonForVisit?.message}
        textareaProps={register("reasonForVisit")}
      />
      <TextField
        id="symptoms"
        label="Symptoms"
        error={errors.symptoms?.message}
        textareaProps={register("symptoms")}
      />
      <TextField
        id="whatsNewSinceLastVisit"
        label="Anything new since your last visit?"
        error={errors.whatsNewSinceLastVisit?.message}
        textareaProps={register("whatsNewSinceLastVisit")}
      />

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 w-full sm:w-auto"
      >
        {isSubmitting ? "Submitting…" : "Submit"}
      </Button>
    </form>
  );
}

interface TextFieldProps {
  id: string;
  label: string;
  error?: string;
  textareaProps: ReturnType<
    ReturnType<typeof useForm<VisitIntakeRequestFormValues>>["register"]
  >;
}

function TextField({ id, label, error, textareaProps }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        rows={3}
        aria-invalid={Boolean(error)}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        {...textareaProps}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
