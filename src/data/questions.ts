/**
 * ─────────────────────────────────────────────────────────────
 *  SUAL BAZASI  (question bank)
 *
 *  These are 25 SAMPLE questions so the site works right away.
 *  Replace them with the teacher's real questions, then run:
 *
 *      npm run seed
 *
 *  Rules
 *  - `position` is the order in the exam (1–25).
 *  - `options` must contain exactly 5 texts → A, B, C, D, E.
 *  - `correct` is the letter of the right answer.
 *  - `image` (optional): put the file in /public/questions/ and write
 *    "/questions/sual-7.png", or use a full https:// link.
 *  - Running the seed again updates existing questions by `position`.
 * ─────────────────────────────────────────────────────────────
 */

export type Letter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface SeedQuestion {
  position: number;
  text: string;
  image?: string | null;
  options: [string, string, string, string, string];
  correct: Letter;
  explanation: string;
}

export const questions: SeedQuestion[] = [
  {
    position: 1,
    text: 'İkilik say sistemində neçə müxtəlif rəqəm istifadə olunur?',
    options: ['1', '2', '8', '10', '16'],
    correct: 'B',
    explanation: 'İkilik say sisteminin əsası 2-dir. Yalnız 0 və 1 rəqəmləri istifadə olunur.',
  },
  {
    position: 2,
    text: 'Onluq say sistemindəki 13 ədədinin ikilik say sistemində yazılışı hansıdır?',
    options: ['1011', '1001', '1110', '1101', '1111'],
    correct: 'D',
    explanation: '13 = 8 + 4 + 1 = 1·2³ + 1·2² + 0·2¹ + 1·2⁰ = 1101₂.',
  },
  {
    position: 3,
    text: '1010₂ ikilik ədədinin onluq say sistemindəki qiyməti neçədir?',
    options: ['8', '9', '12', '5', '10'],
    correct: 'E',
    explanation: '1010₂ = 1·8 + 0·4 + 1·2 + 0·1 = 10.',
  },
  {
    position: 4,
    text: 'Səkkizlik say sistemində hansı rəqəmlər istifadə olunur?',
    options: ['0-dan 8-ə qədər', '0-dan 7-yə qədər', '1-dən 8-ə qədər', '0-dan 9-a qədər', '0-dan F-ə qədər'],
    correct: 'B',
    explanation: 'Səkkizlik sistemin əsası 8-dir, ona görə rəqəmlər 0, 1, 2, 3, 4, 5, 6, 7-dir.',
  },
  {
    position: 5,
    text: 'Onaltılıq say sistemində A hərfi onluq sistemdə hansı ədədə uyğundur?',
    options: ['9', '11', '12', '15', '10'],
    correct: 'E',
    explanation: 'Onaltılıq sistemdə A=10, B=11, C=12, D=13, E=14, F=15.',
  },
  {
    position: 6,
    text: 'F₁₆ ədədinin onluq say sistemindəki qiyməti neçədir?',
    options: ['13', '14', '16', '15', '17'],
    correct: 'D',
    explanation: 'Onaltılıq sistemdə F hərfi 15-ə bərabərdir.',
  },
  {
    position: 7,
    text: '17₈ ədədinin onluq say sistemindəki qiyməti neçədir?',
    options: ['7', '17', '15', '23', '14'],
    correct: 'C',
    explanation: '17₈ = 1·8 + 7·1 = 15.',
  },
  {
    position: 8,
    text: '100₂ ikilik ədədinin onluq qiyməti neçədir?',
    options: ['2', '3', '5', '4', '8'],
    correct: 'D',
    explanation: '100₂ = 1·2² + 0·2¹ + 0·2⁰ = 4.',
  },
  {
    position: 9,
    text: 'Onluq 25 ədədinin səkkizlik say sistemində yazılışı hansıdır?',
    options: ['25', '32', '31', '41', '19'],
    correct: 'C',
    explanation: '25 = 3·8 + 1, yəni 25 = 31₈.',
  },
  {
    position: 10,
    text: 'Onluq 255 ədədinin onaltılıq say sistemində yazılışı hansıdır?',
    options: ['EF', 'FE', 'F0', '100', 'FF'],
    correct: 'E',
    explanation: '255 = 15·16 + 15, yəni FF₁₆.',
  },
  {
    position: 11,
    text: '2A₁₆ ədədinin onluq say sistemindəki qiyməti neçədir?',
    options: ['32', '42', '36', '46', '52'],
    correct: 'B',
    explanation: '2A₁₆ = 2·16 + 10 = 42.',
  },
  {
    position: 12,
    text: '1 bayt neçə bitdir?',
    options: ['2', '4', '10', '8', '16'],
    correct: 'D',
    explanation: '1 bayt = 8 bit.',
  },
  {
    position: 13,
    text: '3 bit vasitəsilə neçə müxtəlif kombinasiya yazmaq olar?',
    options: ['3', '6', '9', '16', '8'],
    correct: 'E',
    explanation: 'n bit ilə 2ⁿ müxtəlif kombinasiya yazılır: 2³ = 8.',
  },
  {
    position: 14,
    text: '111₂ + 1₂ toplamasının ikilik say sistemində nəticəsi nədir?',
    options: ['1001', '1000', '1010', '1100', '1111'],
    correct: 'B',
    explanation: '111₂ = 7, 7 + 1 = 8 və 8 = 1000₂.',
  },
  {
    position: 15,
    text: '1011₂ + 1₂ toplamasının ikilik say sistemində nəticəsi nədir?',
    options: ['1010', '1101', '1110', '1111', '1100'],
    correct: 'E',
    explanation: '1011₂ = 11, 11 + 1 = 12 və 12 = 1100₂.',
  },
  {
    position: 16,
    text: 'Say sisteminin əsası nəyi göstərir?',
    options: [
      'Ədədin uzunluğunu',
      'Sistemdə istifadə olunan rəqəmlərin sayını',
      'Ən böyük ədədi',
      'Ədədin işarəsini',
      'Ədədin sıfırlarının sayını',
    ],
    correct: 'B',
    explanation: 'Say sisteminin əsası həmin sistemdə istifadə olunan müxtəlif rəqəmlərin sayına bərabərdir.',
  },
  {
    position: 17,
    text: 'Onluq 10 ədədinin ikilik say sistemində yazılışı hansıdır?',
    options: ['1000', '1001', '1011', '1100', '1010'],
    correct: 'E',
    explanation: '10 = 8 + 2 = 1010₂.',
  },
  {
    position: 18,
    text: '11111₂ ədədinin onluq say sistemindəki qiyməti neçədir?',
    options: ['15', '16', '32', '31', '63'],
    correct: 'D',
    explanation: '11111₂ = 16 + 8 + 4 + 2 + 1 = 31 (və ya 2⁵ − 1).',
  },
  {
    position: 19,
    text: 'Aşağıdakılardan hansı mövqeli say sistemi DEYİL?',
    options: ['İkilik', 'Onluq', 'Səkkizlik', 'Onaltılıq', 'Roma'],
    correct: 'E',
    explanation: 'Roma say sistemində rəqəmin qiyməti onun yerindən asılı deyil, buna görə mövqeli deyil.',
  },
  {
    position: 20,
    text: '10₁₆ ədədinin onluq say sistemindəki qiyməti neçədir?',
    options: ['8', '10', '20', '16', '32'],
    correct: 'D',
    explanation: '10₁₆ = 1·16 + 0 = 16.',
  },
  {
    position: 21,
    text: 'Onluq 100 ədədinin ikilik yazılışı neçə rəqəmdən ibarətdir?',
    options: ['5', '6', '8', '9', '7'],
    correct: 'E',
    explanation: '100 = 64 + 32 + 4 = 1100100₂. Bu, 7 rəqəmdir.',
  },
  {
    position: 22,
    text: 'Müasir kompüterlər məlumatı əsasən hansı say sistemində emal edir?',
    options: ['Onluq', 'İkilik', 'Səkkizlik', 'Onaltılıq', 'Roma'],
    correct: 'B',
    explanation: 'Kompüterin elektron sxemləri iki vəziyyətdə (0 və 1) işlədiyi üçün məlumat ikilik sistemdə emal olunur.',
  },
  {
    position: 23,
    text: 'Onluq 64 ədədinin ikilik yazılışında neçə sıfır var?',
    options: ['4', '5', '7', '8', '6'],
    correct: 'E',
    explanation: '64 = 2⁶ = 1000000₂. Yazılışda 1 vahid və 6 sıfır var.',
  },
  {
    position: 24,
    text: '9₁₆ + 1₁₆ toplamasının onaltılıq say sistemində nəticəsi nədir?',
    options: ['10₁₆', '9₁₆', 'B₁₆', 'A₁₆', 'F₁₆'],
    correct: 'D',
    explanation: '9 + 1 = 10 (onluqda). Onaltılıq sistemdə 10 rəqəmi A hərfi ilə yazılır.',
  },
  {
    position: 25,
    text: 'Ən böyük 4 bitlik ikilik ədəd (1111₂) onluq sistemdə neçəyə bərabərdir?',
    options: ['8', '16', '31', '4', '15'],
    correct: 'E',
    explanation: '1111₂ = 8 + 4 + 2 + 1 = 15 (və ya 2⁴ − 1).',
  },
];
