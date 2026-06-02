import { z } from "zod";
import { tool } from "ai";

/**
 * Client-side tools — defined with schemas but no execute function.
 * The AI SDK protocol sends these as tool-call events to the frontend,
 * which executes them and returns results.
 */
export const clientTools = {
  navigate_to_study: tool({
    description:
      "Navigate to a specific cBioPortal study view page. Use this when the user wants to view or explore a particular study.",
    inputSchema: z.object({
      studyId: z
        .string()
        .describe("The cancer study identifier (e.g., 'brca_tcga', 'msk_chord_2024')"),
    }),
  }),

  query_available_charts: tool({
    description:
      "Get list of available filter charts in the current study view. Use this to discover what filters can be applied.",
    inputSchema: z.object({}),
  }),

  apply_study_filter: tool({
    description:
      "Apply a filter to the study view. Call query_available_charts first to discover available filters and their valid values.",
    inputSchema: z.object({
      chartUniqueKey: z
        .string()
        .describe("Chart identifier (e.g., 'CANCER_TYPE', 'AGE'). Use query_available_charts to discover."),
      filterType: z.enum(["categorical", "interval"]),
      values: z
        .union([
          z.array(z.string()),
          z.array(
            z.object({
              start: z.number().optional(),
              end: z.number().optional(),
            })
          ),
        ])
        .describe("Filter values. Categorical: array of strings. Interval: array of range objects."),
    }),
  }),

  clear_study_filter: tool({
    description: "Clear/remove a filter from the study view.",
    inputSchema: z.object({
      chartUniqueKey: z
        .string()
        .describe("Chart identifier to clear (e.g., 'CANCER_TYPE')"),
    }),
  }),
};
