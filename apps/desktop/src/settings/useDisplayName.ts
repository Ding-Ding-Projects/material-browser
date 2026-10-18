import { useEffect, useState } from "react";
import { historyRequest } from "./protected-history";
export function useDisplayName() {
  const [displayName, setDisplayName] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const result = await historyRequest("display-name-read");
      if (active && result.ok) setDisplayName(result.displayName);
    };
    void refresh();
    window.addEventListener("display-name-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("display-name-changed", refresh);
    };
  }, []);
  return displayName;
}
