export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | { [key: string]: boolean | undefined | null };

export function clsx(...values: ClassValue[]): string {
  const result: string[] = [];
  const visit = (value: ClassValue) => {
    if (!value) return;
    if (typeof value === "string" || typeof value === "number") {
      result.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    Object.entries(value).forEach(([key, enabled]) => {
      if (enabled) result.push(key);
    });
  };
  values.forEach(visit);
  return result.join(" ");
}

export default clsx;
