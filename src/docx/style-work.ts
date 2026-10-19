import { checkDocxLimit, type DocxLimits } from "./limits";

/** Maximum actual matching steps for one selected node; XML bounds node count. */
export class StyleWork {
  private steps = 0;
  constructor(private readonly limits: DocxLimits) {}
  step(): void {
    checkDocxLimit(++this.steps, "maxStyleTraversalSteps", this.limits);
  }
}
