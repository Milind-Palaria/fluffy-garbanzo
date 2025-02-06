import { Series } from "@/lib/api/metrics/types";
import { toInteger } from "lodash";
import { useTheme } from "next-themes";

export const useColors = () => {
  const { resolvedTheme } = useTheme();
  if (resolvedTheme === "dark") {
    return {
      palette: [
        "#009aa3",
        "#16f3ff",
        "#3fb1e3",
        "#0073b3",
        "#006c72",
        "#ffcb87",
        "#c9fcfe",
      ],
      tooltipBackground: "rgb(30 30 33)",
      tooltipText: "#FFFFFFA0",
      itemBorder: "rgb(30 30 33)",
      tooltipBorder: "rgb(30 30 33)",
      nodeConnection: "#006c72",
    };
  } else {
    return {
      palette: [
        "#009aa3",
        "#16f3ff",
        "#3fb1e3",
        "#0073b3",
        "#006c72",
        "#ffcb87",
        "#c9fcfe",
      ],
      tooltipBackground: "white",
      itemBorder: "white",
      tooltipText: "rgb(27, 30, 34)",
      tooltipBorder: "white/20",
      nodeConnection: "#c9fcfe",
    };
  }
};

export const getValueById = (values: Series[], id: string) =>
  values.find((v) => v.id === id)?.values;

export const getValuesMapById = (values: Series[], ids?: string[]) => {
  const valuesMap: Record<string, any> = {};
  if (!ids) return valuesMap;
  for (let i = 0; i < ids.length; i++) {
    valuesMap[ids[i]] = getValueById(values, ids[i]);
  }
  return valuesMap;
};

/**
 * Converts an object of arrays into an array of objects.
 * Example:
 * Input: `{ name: ['Alice', 'Bob'], age: [25, 30] }`
 * Output: `[ { name: 'Alice', age: 25 }, { name: 'Bob', age: 30 } ]`
 */
export const convertToRecordsArray = (
  dataMap: Record<string, any[]>
): Record<string, any>[] => {
  const keys = Object.keys(dataMap);
  if (keys.length === 0) return [];

  const length = Math.max(...keys.map((key) => dataMap[key]?.length || 0));
  return Array.from({ length }, (_, index) => {
    return keys.reduce((record, key) => {
      record[key] = dataMap[key]?.[index] ?? null;
      return record;
    }, {} as Record<string, any>);
  });
};

/**
 * Converts `snake_case` strings to `Title Case`
 * Example:
 * Input: "hello_world_example"
 * Output: "Hello World Example"
 */
export const snakeToTitle = (str: string): string => {
  return str
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase()); // Capitalize first letter of each word
};

/**
 * Formats large numbers into readable short forms.
 * Example:
 * - 1,000,000 -> "1.0M"
 * - 1,000,000,000 -> "1.0B"
 */
export const formatLargeNumber = (number: string | number): string => {
  let largeNumber = number;
  if (typeof largeNumber === "string") {
    largeNumber = parseInt(largeNumber.split(",").join(""));
    if (Number.isNaN(largeNumber)) {
      return number.toString();
    }
  }
  if (largeNumber >= 1000000000) {
    return `${(largeNumber / 1000000000).toFixed(1)}B`;
  } else if (largeNumber >= 1000000) {
    return `${(largeNumber / 1000000).toFixed(1)}M`;
  }
  return largeNumber.toString();
};
