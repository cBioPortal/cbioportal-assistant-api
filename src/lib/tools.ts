import { z } from "zod";
import { tool } from "ai";

/**
 * Client-side tools — defined with schemas but no execute function.
 * The AI SDK protocol sends these as tool-call events to the frontend,
 * which executes them and returns results.
 */
export const clientTools = {
  navigate_to_url: tool({
    description:
        "Navigate to any cBioPortal page by URL. Accepts a full URL (e.g., 'https://cbioportal.org/results?cancer_study_list=brca_tcga&...') or a relative path (e.g., '/results?cancer_study_list=brca_tcga'). Use this for general navigation beyond just study views.",
    inputSchema: z.object({
      url: z
          .string()
          .describe("A cBioPortal URL (absolute or relative path) to navigate to"),
    }),
  }),

  get_current_page: tool({
    description:
        "Get the current page the user is viewing in cBioPortal. Returns the pathname, query string, hash, and full URL. Use this to understand the user's current context before taking actions.",
    inputSchema: z.object({}),
  }),

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
