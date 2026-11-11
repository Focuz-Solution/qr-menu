// Cambodia's 25 provinces and capital, with their NCDD codes (spec §4.2 geo_provinces; decision D9:
// provinces first). Used by Delivery zones now and by checkout later. Districts/communes come with checkout.
export const PROVINCES = [
  { code: "01", km: "បន្ទាយមានជ័យ", en: "Banteay Meanchey" },
  { code: "02", km: "បាត់ដំបង", en: "Battambang" },
  { code: "03", km: "កំពង់ចាម", en: "Kampong Cham" },
  { code: "04", km: "កំពង់ឆ្នាំង", en: "Kampong Chhnang" },
  { code: "05", km: "កំពង់ស្ពឺ", en: "Kampong Speu" },
  { code: "06", km: "កំពង់ធំ", en: "Kampong Thom" },
  { code: "07", km: "កំពត", en: "Kampot" },
  { code: "08", km: "កណ្ដាល", en: "Kandal" },
  { code: "09", km: "កោះកុង", en: "Koh Kong" },
  { code: "10", km: "ក្រចេះ", en: "Kratie" },
  { code: "11", km: "មណ្ឌលគិរី", en: "Mondul Kiri" },
  { code: "12", km: "ភ្នំពេញ", en: "Phnom Penh" },
  { code: "13", km: "ព្រះវិហារ", en: "Preah Vihear" },
  { code: "14", km: "ព្រៃវែង", en: "Prey Veng" },
  { code: "15", km: "ពោធិ៍សាត់", en: "Pursat" },
  { code: "16", km: "រតនគិរី", en: "Ratanak Kiri" },
  { code: "17", km: "សៀមរាប", en: "Siem Reap" },
  { code: "18", km: "ព្រះសីហនុ", en: "Preah Sihanouk" },
  { code: "19", km: "ស្ទឹងត្រែង", en: "Stung Treng" },
  { code: "20", km: "ស្វាយរៀង", en: "Svay Rieng" },
  { code: "21", km: "តាកែវ", en: "Takeo" },
  { code: "22", km: "ឧត្ដរមានជ័យ", en: "Oddar Meanchey" },
  { code: "23", km: "កែប", en: "Kep" },
  { code: "24", km: "ប៉ៃលិន", en: "Pailin" },
  { code: "25", km: "ត្បូងឃ្មុំ", en: "Tboung Khmum" },
] as const;

export type ProvinceCode = (typeof PROVINCES)[number]["code"];

export const isProvinceCode = (code: string): code is ProvinceCode => PROVINCES.some((p) => p.code === code);
