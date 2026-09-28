/**
 * CBSE Class 10 NCERT (2025-26) Chapter Data
 * Official Rationalized Syllabus
 */

const CLASS_10 = [
  {
    id: "science",
    name: "Science",
    examKey: "science",
    groups: [
      {
        id: "science",
        name: null,
        chapters: [
          { id: "ch1", no: 1, name: "Chemical Reactions and Equations", pdfs: null },
          { id: "ch2", no: 2, name: "Acids, Bases and Salts", pdfs: null },
          { id: "ch3", no: 3, name: "Metals and Non-metals", pdfs: null },
          { id: "ch4", no: 4, name: "Carbon and its Compounds", pdfs: null },
          { id: "ch5", no: 5, name: "Life Processes", pdfs: null },
          { id: "ch6", no: 6, name: "Control and Coordination", pdfs: null },
          { id: "ch7", no: 7, name: "How do Organisms Reproduce?", pdfs: null },
          { id: "ch8", no: 8, name: "Heredity", pdfs: null },
          { id: "ch9", no: 9, name: "Light – Reflection and Refraction", pdfs: null },
          { id: "ch10", no: 10, name: "Human Eye and Colourful World", pdfs: null },
          { id: "ch11", no: 11, name: "Electricity", pdfs: null },
          { id: "ch12", no: 12, name: "Magnetic Effects of Electric Current", pdfs: null },
          { id: "ch13", no: 13, name: "Our Environment", pdfs: null }
        ]
      }
    ]
  },
  {
    id: "maths",
    name: "Mathematics",
    examKey: "maths",
    groups: [
      {
        id: "maths",
        name: null,
        chapters: [
          { id: "ch1", no: 1, name: "Real Numbers", pdfs: null },
          { id: "ch2", no: 2, name: "Polynomials", pdfs: null },
          { id: "ch3", no: 3, name: "Pair of Linear Equations in Two Variables", pdfs: null },
          { id: "ch4", no: 4, name: "Quadratic Equations", pdfs: null },
          { id: "ch5", no: 5, name: "Arithmetic Progressions", pdfs: null },
          { id: "ch6", no: 6, name: "Triangles", pdfs: null },
          { id: "ch7", no: 7, name: "Coordinate Geometry", pdfs: null },
          { id: "ch8", no: 8, name: "Introduction to Trigonometry", pdfs: null },
          { id: "ch9", no: 9, name: "Some Applications of Trigonometry", pdfs: null },
          { id: "ch10", no: 10, name: "Circles", pdfs: null },
          { id: "ch11", no: 11, name: "Areas Related to Circles", pdfs: null },
          { id: "ch12", no: 12, name: "Surface Areas and Volumes", pdfs: null },
          { id: "ch13", no: 13, name: "Statistics", pdfs: null },
          { id: "ch14", no: 14, name: "Probability", pdfs: null }
        ]
      }
    ]
  },
  {
    id: "sst",
    name: "Social Science",
    examKey: "sst",
    groups: [
      {
        id: "history",
        name: "History",
        chapters: [
          { id: "hist_ch1", no: 1, name: "The Rise of Nationalism in Europe", pdfs: null },
          { id: "hist_ch2", no: 2, name: "Nationalism in India", pdfs: null },
          { id: "hist_ch3", no: 3, name: "The Making of a Global World", pdfs: null },
          { id: "hist_ch4", no: 4, name: "The Age of Industrialisation", pdfs: null },
          { id: "hist_ch5", no: 5, name: "Print Culture and the Modern World", pdfs: null }
        ]
      },
      {
        id: "geography",
        name: "Geography",
        chapters: [
          { id: "geo_ch1", no: 1, name: "Resources and Development", pdfs: null },
          { id: "geo_ch2", no: 2, name: "Forest and Wildlife Resources", pdfs: null },
          { id: "geo_ch3", no: 3, name: "Water Resources", pdfs: null },
          { id: "geo_ch4", no: 4, name: "Agriculture", pdfs: null },
          { id: "geo_ch5", no: 5, name: "Minerals and Energy Resources", pdfs: null },
          { id: "geo_ch6", no: 6, name: "Manufacturing Industries", pdfs: null },
          { id: "geo_ch7", no: 7, name: "Life Lines of National Economy", pdfs: null }
        ]
      },
      {
        id: "civics",
        name: "Political Science (Civics)",
        chapters: [
          { id: "pol_ch1", no: 1, name: "Power Sharing", pdfs: null },
          { id: "pol_ch2", no: 2, name: "Federalism", pdfs: null },
          { id: "pol_ch3", no: 3, name: "Gender, Religion and Caste", pdfs: null },
          { id: "pol_ch4", no: 4, name: "Political Parties", pdfs: null },
          { id: "pol_ch5", no: 5, name: "Outcomes of Democracy", pdfs: null }
        ]
      },
      {
        id: "economics",
        name: "Economics",
        chapters: [
          { id: "eco_ch1", no: 1, name: "Development", pdfs: null },
          { id: "eco_ch2", no: 2, name: "Sectors of the Indian Economy", pdfs: null },
          { id: "eco_ch3", no: 3, name: "Money and Credit", pdfs: null },
          { id: "eco_ch4", no: 4, name: "Globalisation and the Indian Economy", pdfs: null },
          { id: "eco_ch5", no: 5, name: "Consumer Rights", pdfs: null }
        ]
      }
    ]
  }
];

if (typeof window !== "undefined") {
  window.CLASS_10 = CLASS_10;
}

const CLASS_10_RESOURCES = {
  science: [
    { title: "Competency Focused Practice Questions — Vol 1", path: "assets/pdfs/class10/science/cfpq-vol1.pdf" },
    { title: "Competency Focused Practice Questions — Vol 2", path: "assets/pdfs/class10/science/cfpq-vol2.pdf" }
  ],
  maths: [
    { title: "Competency Focused Practice Questions — Vol 1", path: "assets/pdfs/class10/maths/cfpq-vol1.pdf" },
    { title: "Competency Focused Practice Questions — Vol 2", path: "assets/pdfs/class10/maths/cfpq-vol2.pdf" },
    { title: "Competency Focused Practice Questions — Vol 3", path: "assets/pdfs/class10/maths/cfpq-vol3.pdf" },
    { title: "Competency Focused Practice Questions — Vol 4", path: "assets/pdfs/class10/maths/cfpq-vol4.pdf" }
  ],
  sst: [
    { title: "Competency Focused Practice Questions — Vol 1", path: "assets/pdfs/class10/sst/cfpq-vol1.pdf" },
    { title: "Competency Focused Practice Questions — Vol 2", path: "assets/pdfs/class10/sst/cfpq-vol2.pdf" }
  ]
};

if (typeof window !== "undefined") {
  window.CLASS_10_RESOURCES = CLASS_10_RESOURCES;
}

const CBSE_PYQ_PORTAL_URL = "https://www.cbse.gov.in/cbsenew/question-paper.html";

if (typeof window !== "undefined") {
  window.CBSE_PYQ_PORTAL_URL = CBSE_PYQ_PORTAL_URL;
}
