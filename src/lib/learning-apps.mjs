// Related educational tools from the same maker. Keep destination URLs canonical.
// Physics Lab is omitted from outbound links until its production domain is confirmed.
export const currentApp = "kids";
export const learningTheme = "playful";
export const learningApps = [
  {
    "id": "chemistry",
    "name": "Interactive Periodic Table",
    "subject": "Chemistry",
    "url": "https://interactiveperiodictable.net",
    "description": "Meet the elements. Explore their properties and mix compounds in the chemistry sandbox.",
    "mark": "118",
    "caption": "elements to meet",
    "color": "#995034",
    "tint": "#f6e7db",
    "path": "M24 18h30v30H24z M30 24h4 M43 42h5"
  },
  {
    "id": "astronomy",
    "name": "Astronomy Lab",
    "subject": "Space",
    "url": "https://theastronomylab.com",
    "description": "Follow an orbit, explore Moon phases, and discover the worlds beyond our own.",
    "mark": "8",
    "caption": "worlds to discover",
    "color": "#295979",
    "tint": "#e1edf6",
    "path": "M45 22a12 12 0 1 0 0 24 12 12 0 0 0 0-24 M23 43c-12 12 52-5 45-17 M25 40c4-4 15-9 27-12"
  },
  {
    "id": "geometry",
    "name": "Geometry Lab",
    "subject": "Math",
    "url": "https://geometrylab.net",
    "description": "Move a point, solve a triangle, and watch angles, shapes, and formulas make sense.",
    "mark": "90°",
    "caption": "a new angle on math",
    "color": "#206558",
    "tint": "#e1f0e5",
    "path": "M24 48V18l32 30H24 M24 39h9v9 M24 18l16 15"
  },
  {
    "id": "biology",
    "name": "Biology Lab",
    "subject": "Biology",
    "url": "https://thebiologylab.org",
    "description": "Cross two parents, translate a gene into protein, and watch a population grow.",
    "mark": "ATGC",
    "caption": "the code of life, decoded",
    "color": "#2f6b45",
    "tint": "#e4f1e4",
    "path": "M28 16c0 12 24 12 24 24s-24 12-24 24 M52 16c0 12-24 12-24 24s24 12 24 24 M31 24h18 M31 48h18 M33 40h14"
  },
  {
    "id": "kids",
    "name": "Kids Code",
    "subject": "Coding",
    "url": "https://kidscode.dev",
    "description": "Guide a robot, snap code blocks together, and make your first real Python programs.",
    "mark": "</>",
    "caption": "little ideas, real code",
    "color": "#784717",
    "tint": "#fff0c7",
    "path": "M30 23 19 34l11 11 M50 23l11 11-11 11 M45 18 35 50"
  },
  {
    "id": "physics",
    "name": "Physics Lab",
    "subject": "Physics",
    "url": null,
    "description": "Launch a ball, catch a wave, and experiment with motion, forces, light, and electricity.",
    "mark": "F=ma",
    "caption": "make the invisible click",
    "color": "#7c4733",
    "tint": "#f9e4d5",
    "path": "M16 49Q35 5 64 49 M16 49h48 M52 42l12 7-2-13"
  }
];
export const relatedLearning = {
  "numbers": [
    {
      "app": "geometry",
      "path": "/area-calculator/",
      "title": "Put your number skills to work",
      "description": "A rectangle’s area is width × height. Try a few sizes in Geometry Lab, then calculate the same answers in Python.",
      "label": "Explore the area calculator"
    }
  ]
};
