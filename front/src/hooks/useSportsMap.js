import { useEffect, useState } from "react";
import { getSportsMap } from "@/api/endpoints";

export function useSportsMap() {
  const [map, setMap] = useState({});

  useEffect(() => {
    let active = true;
    getSportsMap().then((m) => {
      if (active) setMap(m);
    });
    return () => {
      active = false;
    };
  }, []);

  return map;
}
