import { Annotation } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";

export const BaseConfigurationAnnotation = Annotation.Root({
  filterKwargs: Annotation<Record<string, unknown>>,
  k: Annotation<number>,
});

export function ensureBaseConfiguration(
  config: RunnableConfig
): typeof BaseConfigurationAnnotation.State {
  const { configurable = {} } = config || {};
  return {
    filterKwargs: (configurable.filterKwargs as Record<string, unknown>) || {},
    k: (configurable.k as number) || 5,
  };
}
