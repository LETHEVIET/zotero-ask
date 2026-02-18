import { type Tool } from "../services/tools";

export const getCurrentTimeTool: Tool = {
  name: "get_current_time",
  description: "Get the current time and date.",
  parameters: {
    type: "object",
    properties: {
      timezone: {
        type: "string",
        description:
          "The timezone to get the time for (e.g. 'America/New_York'). Default is local time.",
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async ({ timezone }: { timezone?: string }) => {
    const options: Intl.DateTimeFormatOptions = {
      dateStyle: "full",
      timeStyle: "long",
    };
    if (timezone) {
      options.timeZone = timezone;
    }
    return new Date().toLocaleString("en-US", options);
  },
};
