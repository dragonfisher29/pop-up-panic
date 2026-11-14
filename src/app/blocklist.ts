const WORDS = [
  'ASS', 'FAG', 'FGT', 'FUK', 'FCK', 'FUC', 'FUQ', 'DIK', 'DCK', 'COK',
  'CUM', 'TIT', 'SEX', 'XXX', 'KKK', 'NIG', 'NGR', 'NGA', 'SHT', 'CNT',
  'TWT', 'WTF', 'PUS', 'FAP', 'JIZ', 'BCH', 'HOE', 'WOP', 'GOK', 'KYK',
  'DYK', 'TRN', 'NAZ', 'SHT', 'PNS', 'VAG', 'CLT', 'TTS', 'WHR', 'SLT',
  'HOR', 'JAP', 'SPC', 'CHK', 'RPE', 'ANL', 'ANS', 'BUM', 'POO', 'PEE',
  'FUX', 'FKK', 'PIS', 'SUK', 'SUC',
];

export const BLOCKLIST: ReadonlySet<string> = new Set(WORDS);

export function isValidInitials(s: string): boolean {
  return /^[A-Z]{3}$/.test(s) && !BLOCKLIST.has(s);
}
