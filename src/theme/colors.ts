export type ResolvedThemeMode = "light" | "dark";

export function createTheme(mode: ResolvedThemeMode) {
  const isDark = mode === "dark";

  return {
    mode,
    isDark,
    background: isDark ? "#07110D" : "#F6FAF3",
    backgroundAlt: isDark ? "#0D1A14" : "#EAF6DF",
    surface: isDark ? "rgba(20, 34, 27, 0.56)" : "rgba(255, 255, 255, 0.42)",
    surfaceStrong: isDark ? "rgba(24, 42, 33, 0.72)" : "rgba(255, 255, 255, 0.66)",
    glass: isDark ? "rgba(12, 26, 20, 0.48)" : "rgba(255, 255, 255, 0.36)",
    glassHighlight: isDark ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.72)",
    glassLowlight: isDark ? "rgba(117, 209, 151, 0.1)" : "rgba(59, 143, 91, 0.08)",
    glassStroke: isDark ? "rgba(255, 255, 255, 0.24)" : "rgba(255, 255, 255, 0.88)",
    ink: isDark ? "#EEF7F0" : "#1E2B24",
    muted: isDark ? "#A8B8AC" : "#607166",
    line: isDark ? "rgba(184, 214, 190, 0.2)" : "rgba(138, 170, 132, 0.32)",
    green: isDark ? "#75D197" : "#3B8F5B",
    greenSoft: isDark ? "rgba(117, 209, 151, 0.18)" : "#DDEFE3",
    yellow: isDark ? "#F6C762" : "#F3B63F",
    yellowSoft: isDark ? "rgba(246, 199, 98, 0.18)" : "#FFF2CB",
    red: isDark ? "#FF8A78" : "#D95C4A",
    redSoft: isDark ? "rgba(255, 138, 120, 0.18)" : "#FFE1DA",
    blue: isDark ? "#83B7EB" : "#4D82B8",
    blueSoft: isDark ? "rgba(131, 183, 235, 0.18)" : "#DDEBFA",
    teal: isDark ? "#60D0CC" : "#2D8C8C",
    graySoft: isDark ? "rgba(221, 233, 222, 0.08)" : "#EDF1EA",
    shadow: isDark ? "rgba(0, 0, 0, 0.45)" : "rgba(48, 84, 57, 0.16)"
  };
}

export type AppTheme = ReturnType<typeof createTheme>;
