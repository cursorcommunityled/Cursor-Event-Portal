// Shared networking color palette — safe to import in both server and client components

export const NETWORKING_COLORS = [
  { id: "blue",   bg: "#2563EB", label: "BLUE"   },
  { id: "red",    bg: "#DC2626", label: "RED"    },
  { id: "green",  bg: "#16A34A", label: "GREEN"  },
  { id: "orange", bg: "#EA580C", label: "ORANGE" },
  { id: "violet", bg: "#7C3AED", label: "VIOLET" },
  { id: "pink",   bg: "#DB2777", label: "PINK"   },
  { id: "teal",   bg: "#0D9488", label: "TEAL"   },
  { id: "yellow", bg: "#CA8A04", label: "YELLOW" },
  { id: "indigo", bg: "#4338CA", label: "INDIGO" },
  { id: "lime",   bg: "#65A30D", label: "LIME"   },
  { id: "amber",  bg: "#B45309", label: "AMBER"  },
  { id: "cyan",   bg: "#0891B2", label: "CYAN"   },
] as const;

export type NetworkingColorId = typeof NETWORKING_COLORS[number]["id"];
