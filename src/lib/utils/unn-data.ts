export const UNN_CAMPUS_DATA: Record<string, string[]> = {
  "Faculty of Agriculture": [
    "Agricultural Economics",
    "Agricultural Extension",
    "Animal Science",
    "Crop Science",
    "Food Science and Technology",
    "Home Science and Management",
    "Nutrition and Dietetics",
    "Soil Science",
  ],
  "Faculty of Arts": [
    "Archeology and Tourism",
    "Combined Arts",
    "English and Literary Studies",
    "Fine and Applied Arts",
    "Foreign Language and Literatures",
    "History and International Studies",
    "Linguistics",
    "Mass Communication",
    "Music",
    "Theatre and Film Studies",
  ],
  "Faculty of Biological Sciences": [
    "Biochemistry",
    "Combined Biological Sciences",
    "Microbiology",
    "Genetics and Biotechnology",
    "Plant Science and Botany",
    "Zoology and Environmental Biology",
  ],
  "Faculty of Education": [
    "Adult Education and Extra-Mural Studies",
    "Arts Education",
    "Educational Foundations",
    "Human Kinetics and Health Education",
    "Library and Information Science",
    "Science Education",
    "Social Science Education",
  ],
  "Faculty of Engineering": [
    "Agricultural and Bioresources Engineering",
    "Biomedical Engineering",
    "Civil Engineering",
    "Electrical Engineering",
    "Electronics and Computer Engineering",
    "Mechanical Engineering",
    "Mechatronics Engineering",
    "Metallurgical and Materials Engineering",
  ],
  "Faculty of Pharmaceutical Sciences": ["Pharmacy"],
  "Faculty of Physical Sciences": [
    "Computer Science",
    "Combined Physical Sciences",
    "Geology",
    "Mathematics",
    "Physics and Astronomy",
    "Pure and Industrial Chemistry",
    "Science Lab technology",
    "Statistics",
  ],
  "Faculty of Social Sciences": [
    "Combined social Sciences",
    "Criminology and Security Studies",
    "Economics",
    "Geography",
    "Philosophy",
    "Political Science and Diplomacy",
    "Psychology",
    "Public Administration and Local government",
    "Religion and Cultural Studies",
    "Social Works",
    "Sociology and Anthropology",
  ],
  "Faculty of Veterinary Medicine": ["Veterinary Medicine"],
  "Faculty of Vocational and Technical Education": [
    "Agricultural Education",
    "Business Education",
    "Computer and Robotics Education",
    "Entrepreneurship and Vocational Education",
    "Home Economics and Hospitality Management Education",
    "Industrial Technical Education",
  ],
};

/**
 * Programme duration (years of study) per faculty.
 * Used to determine finalist year for CGAN fee calculation.
 */
export const UNN_COURSE_YEARS: Record<string, number> = {
  "Faculty of Agriculture": 5,
  "Faculty of Arts": 4,
  "Faculty of Biological Sciences": 4,
  "Faculty of Education": 4,
  "Faculty of Engineering": 5,
  "Faculty of Pharmaceutical Sciences": 6,
  "Faculty of Physical Sciences": 4,
  "Faculty of Social Sciences": 4,
  "Faculty of Veterinary Medicine": 6,
  "Faculty of Vocational and Technical Education": 4,
};

// Department-level overrides (if any department has a different duration than its faculty default)
export const UNN_DEPT_COURSE_YEARS: Record<string, number> = {
  // Faculty of Agriculture (Default is 5)
  "Home Science and Management": 4,
  "Nutrition and Dietetics": 4,

  // Faculty of Physical Sciences (Default is 4)
  "Geology": 5,
  "Science Lab technology": 5,
};

/** Get the number of years of study for a given faculty and department. Defaults to 4. */
export function getYearsOfStudy(
  faculty: string | null | undefined,
  department?: string | null | undefined
): number {
  if (!faculty) return 4;

  const facultyTrimmed = faculty.trim();

  // If department is provided, check for overrides first
  if (department) {
    const deptTrimmed = department.trim();
    for (const key of Object.keys(UNN_DEPT_COURSE_YEARS)) {
      if (key.toLowerCase() === deptTrimmed.toLowerCase()) {
        return UNN_DEPT_COURSE_YEARS[key];
      }
    }
  }

  // Look up by faculty
  for (const key of Object.keys(UNN_COURSE_YEARS)) {
    if (key.toLowerCase() === facultyTrimmed.toLowerCase()) {
      return UNN_COURSE_YEARS[key];
    }
  }

  return 4;
}

/** Check if a user role qualifies as alumnus (no annual session dues) */
export function isAlumnus(role: string | null | undefined): boolean {
  return role === "alumnus";
}

/** Check if profile has the minimum required fields completed */
export function isProfileComplete(profile: {
  faculty?: string | null;
  department?: string | null;
  academic_level?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
} | null): boolean {
  if (!profile) return false;
  return !!(
    profile.faculty &&
    profile.department &&
    profile.academic_level &&
    profile.phone &&
    profile.date_of_birth
  );
}

export const UNN_HOSTELS = [
  "Alvan Ikoku Hostel",
  "Eni-Njoku Hostel",
  "Kwame Nkrumah Hostel",
  "Sir Odumegwu Ojukwu Hostel",
  "Balewa Hostel",
  "Bello Hostel",
  "Eyo Ita Hostel",
  "Mary Slessor Hostel",
  "Okeke Hostel",
  "Okpara Hostel",
  "Zik's Flat",
  "Presidential Hostel",
  "Aja Nwachukwu Hostel",
  "Off Campus",
];

export function getDuesAmount(
  academicLevel: string,
  faculty?: string | null,
  department?: string | null,
): number {
  switch (academicLevel) {
    case "100 Level":
      return 500;
    case "200 Level":
      return 400;
    case "300 Level":
      return 400;
    case "400 Level":
      // Note: if course year is above four years (e.g. Engineering, Veterinary Medicine, Pharmacy, Agriculture, Geology, Science Lab tech), total due is ₦400 not ₦500
      const totalCourseYears = getYearsOfStudy(faculty, department);
      return totalCourseYears > 4 ? 400 : 500;
    case "500 Level":
      return 400;
    case "Graduate":
    case "Postgraduate":
      return 300;
    default:
      return 400;
  }
}

export const EXCO_POSITIONS = [
  "President",
  "Vice-President",
  "General Secretary",
  "Assistant General Secretary",
  "Financial Secretary",
  "Treasurer",
  "Religious Coordinator",
  "Assistant Religious Coordinator",
  "Director of Socials",
  "Assistant Director of Socials",
  "Director of Works",
  "Assistant Director of Works",
  "Director of Transport",
  "Assistant Director of Transport",
  "General Public Relations Officer (GPRO)",
  "Female Public Relations Officer (FPRO)",
  "Annunciation Public Relations Officer",
  "Assistant Annunciation Public Relations Officer",
  "Academic Coordinator",
  "Assistant Academic Coordinator",
  "Director of Hostel and Faculty Affairs",
  "Assistant Director of Hostel and Faculty Affairs",
  "Ex-Officio Member",
] as const;

export type ExcoPosition = typeof EXCO_POSITIONS[number];

export const NFCS_SOCIETIES = [
  "St Anthony of Padua",
  "Blue Army",
  "Jesus Reigns Charismatic Renewal",
  "Divine Mercy",
  "Precious Blood",
  "Our Lady of Perpetual Help",
  "Legion of Mary",
  "Purgatory Society",
  "St Vincent De Paul",
  "St Jude Society",
  "Block Rosary",
  "Queen of All Hearts",
  "St Theresa of the Child Jesus",
  "Sacred Heart of Jesus",
  "Student Altar Servers",
  "Altar Girls",
  "Lectors",
  "Student Choirs",
  "Cantors",
  "Student Church Warden",
  "Student Board of Commentators",
  "Gospel Band",
  "Social Communication Commission (SCC)",
  "Evangelical Committee (Evancom)",
  "Decency & Disciplinary Committee (DDC)",
  "Federation Theatre (FT)",
  "Faculty of Education Catholic Students Assoc. (FECSA)",
  "Veterinary Catholic Students Assoc. (VECSA)",
  "Catholic Assoc. of Social Science Students (CASSS)",
  "Assoc. of Catholic Agricultural Students (ACAS)",
  "Assoc. of Catholic Engineering Students (ACES)",
  "Catholic Assoc. of Biological Science Students (CABSS)",
  "Faculty of Arts Catholic Students Assoc. (FACSA)",
  "Catholic Pharmaceutical Students Assoc. (CAPSAN)",
  "Physical Science Students Catholic Assoc. (PHYSSCA)",
  "Vocational & Technical Education Catholic Assoc. (VOTECSA)",
  "Federation of Catholic Medical & Dentistry Students (FECAMDS)",
  "First Year Catholic Assoc. of Basic Medical Sciences (FYCABAMS)",
  "First Year Catholic Health Science Students Assoc. (FYCAHSSA)",
] as const;

export type NfcsSociety = typeof NFCS_SOCIETIES[number];

