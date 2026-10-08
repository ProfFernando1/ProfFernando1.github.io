export type AnswerLetter = 'A' | 'B' | 'C' | 'D' | 'E';
export type DifficultyLevel = 'facil' | 'media' | 'dificil';

export type EnemQuestion = {
  id: string;
  year: number;
  examId: string;
  number: number;
  booklet: { color: string; code: string; day: 1 | 2 };
  topics: { primary: string; secondary: string[] };
  difficulty: { level: DifficultyLevel; rationale: string };
  interdisciplinary: boolean;
  images: Array<{ src: string; width: number; height: number; alt: string; order: number; page: number }>;
  accessibleText: string;
  options: Array<{ letter: AnswerLetter; text: string | null }>;
  answer: { status: 'valid' | 'annulled' | 'unresolved'; correct: AnswerLetter | null };
  explanation: string;
  source: { examPdfUrl: string; keyPdfUrl: string; examPage: number; keyPage: number };
  reviewStatus: 'verified' | 'pending';
};

export type EnemQuestionBank = {
  schemaVersion: 1;
  coverage: {
    startYear: number;
    endYear: number;
    application: string;
    difficultyNote: string;
  };
  questions: EnemQuestion[];
};
