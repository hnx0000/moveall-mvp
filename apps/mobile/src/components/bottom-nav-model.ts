export const bottomNavItems = {
  index: {
    label: "홈",
    path: "M3 10 12 3l9 7v11h-6v-7H9v7H3Z",
  },
  community: {
    label: "TODAY",
    path: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1",
  },
  routines: {
    label: "기록·콘텐츠 추가",
    path: "M12 4v16M4 12h16",
  },
  knowledge: {
    label: "리그",
    path: "M7 3h10v5a5 5 0 0 1-10 0V3ZM7 5H3v2a4 4 0 0 0 4 4M17 5h4v2a4 4 0 0 1-4 4M12 13v5M8 21v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1H8Z",
  },
  profile: {
    label: "MY",
    path: "M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8M4 21v-3a8 6 0 0 1 16 0v3",
  },
} as const;
export const bottomNavPalette = {
  background: "#141713",
  border: "#303530",
  inactive: "#919B8D",
  active: "#FF613B",
  plusInk: "#161A14",
};
