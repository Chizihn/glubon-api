// src/constants/locationKeywords.ts
export type LocationKeyword = string;

/**
 * Normalised keyword → original variations
 */
export const LOCATION_KEYWORD_MAP = {
  // ────────────────────────────────────── STATES ──────────────────────────────────────
  abia: ["abia"],
  adamawa: ["adamawa"],
  "akwa ibom": ["akwa ibom", "akwa-ibom"],
  anambra: ["anambra"],
  bauchi: ["bauchi"],
  bayelsa: ["bayelsa"],
  benue: ["benue"],
  borno: ["borno"],
  "cross river": ["cross river", "cross-river"],
  delta: ["delta"],
  ebonyi: ["ebonyi"],
  edo: ["edo"],
  ekiti: ["ekiti"],
  enugu: ["enugu"],
  gombe: ["gombe"],
  imo: ["imo"],
  jigawa: ["jigawa"],
  kaduna: ["kaduna"],
  kano: ["kano"],
  katsina: ["katsina"],
  kebbi: ["kebbi"],
  kogi: ["kogi"],
  kwara: ["kwara"],
  lagos: ["lagos"],
  nasarawa: ["nasarawa"],
  niger: ["niger"],
  ogun: ["ogun"],
  ondo: ["ondo"],
  osun: ["osun"],
  oyo: ["oyo"],
  plateau: ["plateau"],
  rivers: ["rivers"],
  sokoto: ["sokoto"],
  taraba: ["taraba"],
  yobe: ["yobe"],
  zamfara: ["zamfara"],
  fct: ["fct", "abuja", "federal capital territory"],

  // ────────────────────────────────────── LAGOS AREAS ──────────────────────────────────────
  ikeja: ["ikeja"],
  "victoria island": ["victoria island", "vi", "v.i"],
  ikoyi: ["ikoyi"],
  lekki: ["lekki", "lekki phase 1", "lekki phase i"],
  ajah: ["ajah"],
  surulere: ["surulere"],
  yaba: ["yaba"],
  maryland: ["maryland"],
  gbagada: ["gbagada"],
  ogudu: ["ogudu"],
  magodo: ["magodo", "magodo gra"],
  ojodu: ["ojodu", "berger"],
  ogba: ["ogba"],
  agege: ["agege"],
  ikotun: ["ikotun"],
  ejigbo: ["ejigbo"],
  festac: ["festac", "festac town"],
  "amuwo odofin": ["amuwo odofin", "amuwo-odofin"],
  apapa: ["apapa"],
  oshodi: ["oshodi", "oshodi-isolo", "oshodi isholo"],
  isolo: ["isolo"],
  ikorodu: ["ikorodu"],
  ketu: ["ketu"],
  mushin: ["mushin"],

  // ────────────────────────────────────── ABUJA AREAS ──────────────────────────────────────
  asokoro: ["asokoro"],
  maitama: ["maitama"],
  wuse: ["wuse", "wuse 2", "wuse ii"],
  garki: ["garki", "garki 1", "garki 2"],
  jabi: ["jabi"],
  gwarimpa: ["gwarimpa", "gwarinpa"],
  kubwa: ["kubwa"],
  lifecamp: ["lifecamp", "life camp"],
  guzape: ["guzape"],
  katampe: ["katampe"],
  jahi: ["jahi"],
  kaura: ["kaura"],
  lokogoma: ["lokogoma"],
  gudu: ["gudu"],
  durumi: ["durumi"],
  wuye: ["wuye"],
  utako: ["utako"],
  kado: ["kado"],
  dakibiyu: ["dakibiyu", "dakibiya", "dakibiu"],

  // ────────────────────────────────────── PORT HARCOURT ──────────────────────────────────────
  "port harcourt": ["port harcourt", "phc", "ph"],
  gra: [
    "g.r.a",
    "g.r.a.",
    "gra",
    "government residential area",
    "government reserved area",
    "g.r.a phase",
    "g.r.a phase 1",
    "g.r.a phase 2",
    "g.r.a phase 3",
    "g.r.a phase 4",
    "g.r.a phase 5",
    "g.r.a phase 6",
    "g.r.a phase 7",
    "g.r.a phase 8",
    "g.r.a phase 9",
    "g.r.a phase 10",
  ],
  rumuola: ["rumuola"],
  rumuokoro: ["rumuokoro"],
  rumuokwuta: ["rumuokwuta"],
  rumuokwurusi: ["rumuokwurusi"],
  rumuodara: ["rumuodara"],
  rumuomasi: ["rumuomasi"],

  // ────────────────────────────────────── IBADAN ──────────────────────────────────────
  bodija: ["bodija"],
  sango: ["sango"],
  dugbe: ["dugbe"],
  apata: ["apata"],
  mokola: ["mokola"],
  ui: ["ui", "university of ibadan"],
  agodi: ["agodi"],
  jericho: ["jericho"],
  moniya: ["moniya"],
  akobo: ["akobo"],
  basorun: ["basorun"],

  // ────────────────────────────────────── KANO ──────────────────────────────────────
  bompai: ["bompai"],
  "gyadi gyadi": ["gyadi gyadi", "gyadi-gyadi"],
  nassarawa: ["nassarawa", "nassara"],
  "zaria road": ["zaria road"],
  hotoro: ["hotoro"],
  sharada: ["sharada"],
  "kwanar hulaba": ["kwanar hulaba"],
  tarauni: ["tarauni"],
  kumbotso: ["kumbotso"],
  "kwanar dabai": ["kwanar dabai"],
  "kwanar dala": ["kwanar dala"],
  "kwanar gidan rimi": ["kwanar gidan rimi"],
  "kwanar kofar ruwa": ["kwanar kofar ruwa"],
  "kwanar kofar wambai": ["kwanar kofar wambai"],

  // ────────────────────────────────────── ENUGU ──────────────────────────────────────
  "independence layout": ["independence layout"],
  "trans ekulu": ["trans ekulu", "trans-ekulu"],
  "thinkers corner": [
    "thinkers corner",
    "thinker's corner",
    "thinkers' corner",
    "thinker corner",
  ],
  "new haven": ["new haven"],
  abakpa: ["abakpa"],
  emene: ["emene"],

  // ────────────────────────────────────── CALABAR ──────────────────────────────────────
  "calabar municipal": ["calabar municipal"],
  "calabar south": ["calabar south"],
  atimbo: ["atimbo"],
  "8 mile": [
    "8 miles",
    "8 mile",
    "8-mile",
    "8th mile",
    "8th-mile",
    "8 mile",
    "8th mile",
  ],

  // ────────────────────────────────────── UYO ──────────────────────────────────────
  "uyo town": ["uyo town", "uyo main town"],
  "uyo village road": ["uyo village road", "uyo village"],

  // ────────────────────────────────────── GENERAL ──────────────────────────────────────
  "government residential area": [
    "g.r.a",
    "g.r.a.",
    "gra",
    "government residential area",
    "government reserved area",
  ],
} as const satisfies Record<string, readonly string[]>;

/**
 * Flattened + lower-cased list for fast `includes()` checks
 */
export const NORMALISED_KEYWORDS: readonly LocationKeyword[] = Object.entries(
  LOCATION_KEYWORD_MAP
)
  .flatMap(([norm, variants]) =>
    variants.map((v) => v.toLowerCase().trim())
  )
  .filter(Boolean);

/**
 * Helper: does the user query contain a known location?
 */
export const containsLocationKeyword = (query: string): boolean => {
  const lower = query.toLowerCase().trim();
  return NORMALISED_KEYWORDS.some((kw) => lower.includes(kw));
};

/**
 * Optional: extract the *canonical* name (e.g. "vi" → "victoria island")
 */
export const extractCanonicalLocation = (
  query: string
): string | undefined => {
  const lower = query.toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(LOCATION_KEYWORD_MAP)) {
    if (variants.some((v) => lower.includes(v.toLowerCase()))) {
      return canonical;
    }
  }
  return undefined;
};