import { select } from "@inquirer/prompts";
import type { Context as InquirerPromptContext } from "@inquirer/type";

export type InteractiveDoctorOutput = "summary" | "details" | "json";

type DoctorOutputChoice = {
  name: string;
  value: InteractiveDoctorOutput;
  description: string;
};

interface SelectInteractiveDoctorOutputOptions {
  input: NodeJS.ReadStream;
  output: NodeJS.WritableStream;
  selectImpl?: (
    options: {
      message: string;
      choices: readonly DoctorOutputChoice[];
      default: InteractiveDoctorOutput;
    },
    context?: InquirerPromptContext,
  ) => Promise<InteractiveDoctorOutput>;
}

const DOCTOR_OUTPUT_CHOICES: readonly DoctorOutputChoice[] = [
  {
    name: "Summary",
    value: "summary",
    description: "Workflow readiness and recommended actions",
  },
  {
    name: "Details",
    value: "details",
    description: "Versions, checks, and capability evidence",
  },
  {
    name: "JSON",
    value: "json",
    description: "Machine-readable evidence",
  },
];

export async function selectInteractiveDoctorOutput(
  options: SelectInteractiveDoctorOutputOptions,
): Promise<InteractiveDoctorOutput> {
  const selectImpl =
    options.selectImpl ?? ((promptOptions, context) => select(promptOptions, context));

  return await selectImpl(
    {
      message: "Choose doctor output",
      choices: DOCTOR_OUTPUT_CHOICES,
      default: "summary",
    },
    {
      input: options.input,
      output: options.output,
    },
  );
}
