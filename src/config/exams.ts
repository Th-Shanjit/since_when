// Fixed list per the spec. Used by the examLeak counter as a keyword gate
// against candidate news items fetched from GDELT.

export const EXAMS = [
  "UPSC",
  "SSC",
  "NEET",
  "JEE",
  "CBSE",
  "State PSC",
  "Railway RRB",
  "CAT",
  "CUET",
] as const;

export const EXAM_SET = new Set(EXAMS.map((e) => e.toLowerCase()));
