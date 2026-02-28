export interface Region {
  key: string
  labelEn: string
  labelKo: string
  codes: string[]
}

export const REGIONS: Region[] = [
  {
    key: 'east-asia',
    labelEn: 'East Asia',
    labelKo: '동아시아',
    codes: ['KR', 'JP', 'CN', 'MO', 'TW', 'MN', 'HK'],
  },
  {
    key: 'southeast-asia',
    labelEn: 'Southeast Asia',
    labelKo: '동남아시아',
    codes: ['SG', 'TH', 'VN', 'MY', 'ID', 'PH', 'KH', 'LA', 'MM', 'BN', 'TL'],
  },
  {
    key: 'south-asia',
    labelEn: 'South Asia',
    labelKo: '남아시아',
    codes: ['IN', 'LK', 'NP', 'BD', 'PK', 'BT', 'MV', 'AF'],
  },
  {
    key: 'central-asia',
    labelEn: 'Central Asia',
    labelKo: '중앙아시아',
    codes: ['KZ', 'UZ', 'TM', 'TJ', 'KG', 'GE', 'AZ', 'AM'],
  },
  {
    key: 'middle-east',
    labelEn: 'Middle East',
    labelKo: '중동',
    codes: ['AE', 'SA', 'QA', 'IR', 'LB', 'IL', 'JO', 'IQ', 'YE', 'SY', 'KW', 'BH', 'OM', 'PS'],
  },
  {
    key: 'europe',
    labelEn: 'Europe',
    labelKo: '유럽',
    codes: [
      'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT', 'PT', 'IE', 'LU', 'MC', 'LI', 'AD', 'SM',
      'DK', 'SE', 'NO', 'FI', 'IS',
      'CZ', 'PL', 'HU', 'RO', 'BG', 'GR', 'TR', 'SI', 'HR', 'RS', 'SK', 'LT', 'LV', 'EE',
      'UA', 'RU', 'BY', 'MD', 'MK', 'AL', 'BA', 'ME', 'XK', 'MT', 'CY',
    ],
  },
  {
    key: 'africa',
    labelEn: 'Africa',
    labelKo: '아프리카',
    codes: [
      'ZA', 'EG', 'KE', 'MA', 'NG', 'ET', 'TZ', 'GH', 'SN', 'CM', 'MZ', 'ZM', 'ZW', 'RW',
      'UG', 'SD', 'DZ', 'TN', 'LY', 'ML', 'BF', 'CI', 'AO', 'NA', 'BW', 'MG',
    ],
  },
  {
    key: 'north-america',
    labelEn: 'North America',
    labelKo: '북아메리카',
    codes: ['US', 'CA', 'MX', 'GT', 'HN', 'SV', 'NI', 'CR', 'PA', 'CU', 'HT', 'DO', 'JM'],
  },
  {
    key: 'south-america',
    labelEn: 'South America',
    labelKo: '남아메리카',
    codes: ['BR', 'AR', 'CL', 'CO', 'PE', 'EC', 'BO', 'PY', 'UY', 'VE', 'GY', 'SR'],
  },
  {
    key: 'oceania',
    labelEn: 'Oceania',
    labelKo: '오세아니아',
    codes: ['AU', 'NZ', 'FJ', 'PG', 'SB', 'VU', 'WS', 'TO', 'KI', 'FM', 'PW', 'MH', 'NR', 'TV'],
  },
]

export interface RegionData {
  key: string
  labelEn: string
  labelKo: string
  countries: { code: string; nameEn: string; nameKo: string }[]
}

export function getRegionForCode(code: string): Region | undefined {
  return REGIONS.find((r) => r.codes.includes(code))
}

export function getRegionByKey(key: string): Region | undefined {
  return REGIONS.find((r) => r.key === key)
}
