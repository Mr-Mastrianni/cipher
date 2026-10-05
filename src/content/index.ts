/**
 * The Cipher content library — a single entry point.
 *
 * Several modules describe similar ideas with their own field names (`body`,
 * `theme`, `description`), so nothing is re-exported with `export *`. Every
 * symbol is named explicitly and, where a bare name would be ambiguous, aliased
 * (for example `Module` becomes `CourseModule`, and each collection keeps its
 * own `*_CONTENT` prefix).
 */

export { CENTER_CONTENT, CENTER_CONTENT_BY_KEY } from "./centers";
export type { CenterContent } from "./centers";

export { GATES, GATE_BY_NUMBER } from "./gates";
export type { GateContent } from "./gates";

export { LINE_CONTENT, LINE_CONTENT_BY_LINE } from "./lines";
export type { LineContent } from "./lines";

export { PROFILE_CONTENT, PROFILE_CONTENT_BY_KEY } from "./profiles";
export type { ProfileContent, ProfileAngle } from "./profiles";

export { TYPE_CONTENT, TYPE_CONTENT_BY_TYPE } from "./types";
export type { TypeContent } from "./types";

export {
  AUTHORITY_CONTENT,
  AUTHORITY_CONTENT_BY_AUTHORITY,
} from "./authorities";
export type { AuthorityContent } from "./authorities";

export { COURSES } from "./courses";
export type {
  ContentBlock,
  Course,
  Lesson,
  Module as CourseModule,
} from "./courses";

export { FLASHCARDS, DECKS } from "./flashcards";
export type { Flashcard, FlashcardDifficulty } from "./flashcards";

import { CENTER_CONTENT } from "./centers";
import { GATES } from "./gates";
import { LINE_CONTENT } from "./lines";
import { PROFILE_CONTENT } from "./profiles";
import { TYPE_CONTENT } from "./types";
import { AUTHORITY_CONTENT } from "./authorities";
import { COURSES } from "./courses";
import { FLASHCARDS, DECKS } from "./flashcards";

/** Everything, gathered for tooling that wants to walk the whole library. */
export const CONTENT_LIBRARY = {
  centers: CENTER_CONTENT,
  gates: GATES,
  lines: LINE_CONTENT,
  profiles: PROFILE_CONTENT,
  types: TYPE_CONTENT,
  authorities: AUTHORITY_CONTENT,
  courses: COURSES,
  flashcards: FLASHCARDS,
  decks: DECKS,
} as const;
