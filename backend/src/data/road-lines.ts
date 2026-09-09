export type RoadLinePattern =
  | 'yellow-white'
  | 'white-white'
  | 'white-yellow'
  | 'yellow-yellow'
  | 'white-whiteyellow'
  | 'yellow-whiteyellow'
  | 'white-whitegreen'
  | 'red-white'
  | 'red-yellow'
  | 'blue-orange'
  | 'blue-white'
  | 'blue-blue';

/** Countries mapped to their road line patterns (outside | inside) */
export const roadLinesData: Record<string, RoadLinePattern[]> = {
  // Outside: Yellow | Inside: White
  Australia: ['yellow-white', 'white-white', 'yellow-yellow'],
  Botswana: ['yellow-white'],
  Chile: ['yellow-white', 'white-white', 'white-yellow', 'yellow-yellow'],
  Eswatini: ['yellow-white', 'yellow-whiteyellow'],
  France: ['yellow-white', 'white-white', 'white-whiteyellow'],
  Gibraltar: ['yellow-white', 'white-white'],
  Hungary: ['yellow-white', 'white-white'],
  India: ['yellow-white', 'white-white', 'yellow-yellow'],
  Ireland: ['yellow-white'],
  'Isle of Man': ['yellow-white', 'white-white'],
  Israel: ['yellow-white'],
  Jersey: ['yellow-white'],
  Jordan: ['yellow-white'],
  Kazakhstan: ['yellow-white', 'white-white'],
  Lesotho: ['yellow-white'],
  Lithuania: ['yellow-white', 'white-white'],
  Malaysia: ['yellow-white', 'white-white'],
  Mexico: ['yellow-white', 'white-white', 'white-yellow'],
  Montenegro: ['yellow-white', 'white-white'],
  Namibia: ['yellow-white', 'red-white'],
  Nepal: ['yellow-white'],
  'New Zealand': [
    'yellow-white',
    'white-white',
    'white-yellow',
    'yellow-yellow',
    'white-whiteyellow',
  ],
  Nigeria: ['yellow-white'],
  Oman: ['yellow-white', 'yellow-yellow'],
  Palestine: ['yellow-white'],
  Portugal: ['yellow-white', 'white-white'],
  Russia: ['yellow-white', 'white-white', 'white-yellow'],
  Singapore: ['yellow-white', 'white-white'],
  'South Africa': ['yellow-white', 'red-white'],
  Spain: ['yellow-white', 'white-white', 'blue-white'],
  'Sri Lanka': ['yellow-white', 'white-white'],
  Turkey: ['yellow-white', 'white-white', 'white-yellow', 'yellow-yellow', 'white-whiteyellow'],
  'United Arab Emirates': ['yellow-white', 'yellow-yellow'],
  'United Kingdom': ['yellow-white', 'white-white', 'red-white'],
  // Outside: White | Inside: White (only)
  Albania: ['white-white', 'white-yellow'],
  Andorra: ['white-white'],
  Argentina: ['white-white', 'white-yellow', 'white-whiteyellow'],
  Austria: ['white-white', 'white-yellow'],
  Bangladesh: ['white-white'],
  Belgium: ['white-white'],
  Bhutan: ['white-white'],
  Bolivia: ['white-white', 'white-yellow'],
  'Bosnia and Herzegovina': ['white-white'],
  Brazil: ['white-white', 'white-yellow', 'yellow-yellow', 'blue-blue'],
  Bulgaria: ['white-white'],
  'Christmas Island': ['white-white'],
  Croatia: ['white-white'],
  Curaçao: ['white-white'],
  Cyprus: ['white-white'],
  'Czech Republic': ['white-white'],
  Denmark: ['white-white'],
  Estonia: ['white-white'],
  'Faroe Islands': ['white-white'],
  Finland: ['white-white', 'white-yellow', 'white-whiteyellow'],
  Germany: ['white-white'],
  Ghana: ['white-white'],
  Greece: ['white-white', 'white-yellow'],
  Greenland: ['white-white'],
  Iceland: ['white-white'],
  Indonesia: ['white-white', 'white-yellow', 'yellow-yellow'],
  Italy: ['white-white'],
  Japan: ['white-white', 'white-yellow', 'white-whiteyellow'],
  Kenya: ['white-white', 'white-yellow'],
  Kyrgyzstan: ['white-white'],
  Laos: ['white-white'],
  Latvia: ['white-white'],
  Liechtenstein: ['white-white'],
  Luxembourg: ['white-white'],
  Madagascar: ['white-white'],
  Malta: ['white-white'],
  Monaco: ['white-white'],
  Mongolia: ['white-white'],
  Netherlands: ['white-white', 'white-whitegreen'],
  'North Macedonia': ['white-white', 'yellow-yellow'],
  Peru: ['white-white', 'white-yellow'],
  Philippines: ['white-white', 'white-yellow', 'white-whiteyellow', 'blue-orange', 'blue-white'],
  Poland: ['white-white'],
  Qatar: ['white-white', 'white-yellow'],
  Romania: ['white-white', 'yellow-yellow'],
  Rwanda: ['white-white', 'white-yellow'],
  'San Marino': ['white-white'],
  Senegal: ['white-white'],
  Serbia: ['white-white'],
  Slovakia: ['white-white'],
  Slovenia: ['white-white'],
  'South Korea': ['white-white', 'white-yellow', 'yellow-yellow'],
  Sweden: ['white-white'],
  Switzerland: ['white-white'],
  'São Tomé and Príncipe': ['white-white'],
  Tunisia: ['white-white'],
  Uganda: ['white-white', 'white-yellow'],
  Ukraine: ['white-white'],
  Uruguay: ['white-white', 'white-whiteyellow'],
  Vietnam: ['white-white', 'white-yellow', 'white-whiteyellow'],
  // Outside: White | Inside: Yellow (only additions not already above)
  'American Samoa': ['white-yellow'],
  Cambodia: ['white-yellow'],
  Canada: ['white-yellow'],
  Colombia: ['white-yellow'],
  'Costa Rica': ['white-yellow'],
  'Dominican Republic': ['white-yellow'],
  Ecuador: ['white-yellow'],
  Guam: ['white-yellow'],
  Guatemala: ['white-yellow'],
  Lebanon: ['white-yellow'],
  'Northern Mariana Islands': ['white-yellow'],
  Norway: ['white-yellow'],
  Panama: ['white-yellow'],
  Paraguay: ['white-yellow'],
  'Puerto Rico': ['white-yellow'],
  Taiwan: ['white-yellow', 'yellow-yellow', 'red-yellow', 'blue-blue'],
  Thailand: ['white-yellow'],
  'United States': ['white-yellow'],

  'Hong Kong': ['yellow-yellow'],
};

export const linePatternLabels: Record<RoadLinePattern, string> = {
  'yellow-white': 'Outside: Yellow | Inside: White',
  'white-white': 'Outside: White | Inside: White',
  'white-yellow': 'Outside: White | Inside: Yellow',
  'yellow-yellow': 'Outside: Yellow | Inside: Yellow',
  'white-whiteyellow': 'Outside: White | Inside: White & Yellow',
  'yellow-whiteyellow': 'Outside: Yellow | Inside: White & Yellow',
  'white-whitegreen': 'Outside: White | Inside: White & Green',
  'red-white': 'Outside: Red | Inside: White',
  'red-yellow': 'Outside: Red | Inside: Yellow',
  'blue-orange': 'Outside: Blue | Inside: Orange',
  'blue-white': 'Outside: Blue | Inside: White',
  'blue-blue': 'Outside: Blue | Inside: Blue',
};

export const linePatternColors: Record<RoadLinePattern, string> = {
  'yellow-white': '#eab308', // yellow dominant
  'white-white': '#e5e7eb', // white/grey
  'white-yellow': '#facc15', // yellowish
  'yellow-yellow': '#ca8a04', // deep yellow
  'white-whiteyellow': '#d4d4aa', // pale yellow-white mix
  'yellow-whiteyellow': '#bfae3d', // yellow-green tint
  'white-whitegreen': '#86efac', // green-white
  'red-white': '#f87171', // red
  'red-yellow': '#dc2626', // dark red
  'blue-orange': '#60a5fa', // blue
  'blue-white': '#93c5fd', // light blue
  'blue-blue': '#3b82f6', // blue
};
