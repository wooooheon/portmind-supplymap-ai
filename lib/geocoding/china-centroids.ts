export type ChinaCentroidEstimate = {
  latitude: number;
  longitude: number;
  confidence: number;
  provider: string;
  province?: string;
  city?: string;
};

const provinceCentroids: Record<string, { lat: number; lng: number; label: string }> = {
  ANHUI: { lat: 31.8612, lng: 117.2857, label: "Anhui" },
  BEIJING: { lat: 39.9042, lng: 116.4074, label: "Beijing" },
  CHONGQING: { lat: 29.563, lng: 106.5516, label: "Chongqing" },
  FUJIAN: { lat: 26.0789, lng: 117.9874, label: "Fujian" },
  GANSU: { lat: 36.0594, lng: 103.8263, label: "Gansu" },
  GUANGDONG: { lat: 23.1317, lng: 113.2663, label: "Guangdong" },
  GUANGXI: { lat: 22.8152, lng: 108.3275, label: "Guangxi" },
  GUIZHOU: { lat: 26.647, lng: 106.6302, label: "Guizhou" },
  HAINAN: { lat: 20.0174, lng: 110.3492, label: "Hainan" },
  HEBEI: { lat: 38.0428, lng: 114.5149, label: "Hebei" },
  HEILONGJIANG: { lat: 45.7421, lng: 126.6629, label: "Heilongjiang" },
  HENAN: { lat: 34.7657, lng: 113.7532, label: "Henan" },
  HUBEI: { lat: 30.5454, lng: 114.3423, label: "Hubei" },
  HUNAN: { lat: 28.1124, lng: 112.9834, label: "Hunan" },
  "INNER MONGOLIA": { lat: 40.8175, lng: 111.7652, label: "Inner Mongolia" },
  JIANGSU: { lat: 32.0603, lng: 118.7969, label: "Jiangsu" },
  JIANGXI: { lat: 28.682, lng: 115.8579, label: "Jiangxi" },
  JILIN: { lat: 43.8378, lng: 125.3235, label: "Jilin" },
  LIAONING: { lat: 41.8057, lng: 123.4315, label: "Liaoning" },
  NINGXIA: { lat: 38.4872, lng: 106.2309, label: "Ningxia" },
  QINGHAI: { lat: 36.6232, lng: 101.7804, label: "Qinghai" },
  SHAANXI: { lat: 34.3416, lng: 108.9398, label: "Shaanxi" },
  SHANDONG: { lat: 36.6683, lng: 117.0204, label: "Shandong" },
  SHANGHAI: { lat: 31.2304, lng: 121.4737, label: "Shanghai" },
  SHANXI: { lat: 37.8706, lng: 112.5489, label: "Shanxi" },
  SICHUAN: { lat: 30.5728, lng: 104.0668, label: "Sichuan" },
  TIANJIN: { lat: 39.3434, lng: 117.3616, label: "Tianjin" },
  TIBET: { lat: 29.652, lng: 91.1721, label: "Tibet" },
  XINJIANG: { lat: 43.8256, lng: 87.6168, label: "Xinjiang" },
  YUNNAN: { lat: 25.0389, lng: 102.7183, label: "Yunnan" },
  ZHEJIANG: { lat: 30.2741, lng: 120.1551, label: "Zhejiang" }
};

const cityCentroids: Record<string, { lat: number; lng: number; province: string; label: string }> = {
  BEIJING: { lat: 39.9042, lng: 116.4074, province: "Beijing", label: "Beijing" },
  CHAOZHOU: { lat: 23.6567, lng: 116.6226, province: "Guangdong", label: "Chaozhou" },
  DALIAN: { lat: 38.914, lng: 121.6147, province: "Liaoning", label: "Dalian" },
  DEZHOU: { lat: 37.4355, lng: 116.3592, province: "Shandong", label: "Dezhou" },
  DONGGUAN: { lat: 23.0207, lng: 113.7518, province: "Guangdong", label: "Dongguan" },
  FOSHAN: { lat: 23.0215, lng: 113.1214, province: "Guangdong", label: "Foshan" },
  FUZHOU: { lat: 26.0745, lng: 119.2965, province: "Fujian", label: "Fuzhou" },
  GUANGZHOU: { lat: 23.1291, lng: 113.2644, province: "Guangdong", label: "Guangzhou" },
  HANGZHOU: { lat: 30.2741, lng: 120.1551, province: "Zhejiang", label: "Hangzhou" },
  JIAXING: { lat: 30.7461, lng: 120.7555, province: "Zhejiang", label: "Jiaxing" },
  JIEYANG: { lat: 23.5497, lng: 116.3727, province: "Guangdong", label: "Jieyang" },
  JINAN: { lat: 36.6512, lng: 117.1201, province: "Shandong", label: "Jinan" },
  JINHUA: { lat: 29.0792, lng: 119.6474, province: "Zhejiang", label: "Jinhua" },
  LINYI: { lat: 35.1047, lng: 118.3564, province: "Shandong", label: "Linyi" },
  NANJING: { lat: 32.0603, lng: 118.7969, province: "Jiangsu", label: "Nanjing" },
  NINGBO: { lat: 29.8683, lng: 121.544, province: "Zhejiang", label: "Ningbo" },
  QINGDAO: { lat: 36.0671, lng: 120.3826, province: "Shandong", label: "Qingdao" },
  QINHUANGDAO: { lat: 39.9354, lng: 119.6005, province: "Hebei", label: "Qinhuangdao" },
  QUANZHOU: { lat: 24.8741, lng: 118.6759, province: "Fujian", label: "Quanzhou" },
  RIZHAO: { lat: 35.4164, lng: 119.5269, province: "Shandong", label: "Rizhao" },
  SHANGHAI: { lat: 31.2304, lng: 121.4737, province: "Shanghai", label: "Shanghai" },
  SHENZHEN: { lat: 22.5431, lng: 114.0579, province: "Guangdong", label: "Shenzhen" },
  SUZHOU: { lat: 31.2989, lng: 120.5853, province: "Jiangsu", label: "Suzhou" },
  TAIZHOU: { lat: 28.6564, lng: 121.4208, province: "Zhejiang", label: "Taizhou" },
  TIANJIN: { lat: 39.3434, lng: 117.3616, province: "Tianjin", label: "Tianjin" },
  WEIFANG: { lat: 36.7069, lng: 119.1618, province: "Shandong", label: "Weifang" },
  WEIHAI: { lat: 37.5131, lng: 122.1204, province: "Shandong", label: "Weihai" },
  WENZHOU: { lat: 27.9938, lng: 120.6994, province: "Zhejiang", label: "Wenzhou" },
  WUXI: { lat: 31.4912, lng: 120.3119, province: "Jiangsu", label: "Wuxi" },
  XIAMEN: { lat: 24.4798, lng: 118.0894, province: "Fujian", label: "Xiamen" },
  YANTAI: { lat: 37.4645, lng: 121.4479, province: "Shandong", label: "Yantai" },
  YIWU: { lat: 29.3069, lng: 120.0751, province: "Zhejiang", label: "Yiwu" },
  ZHANGZHOU: { lat: 24.513, lng: 117.6471, province: "Fujian", label: "Zhangzhou" },
  ZHONGSHAN: { lat: 22.5176, lng: 113.3928, province: "Guangdong", label: "Zhongshan" }
};

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function withJitter(lat: number, lng: number, key: string, spread: number) {
  const hash = hashText(key);
  const latOffset = (((hash & 0xffff) / 0xffff) - 0.5) * spread;
  const lngOffset = ((((hash >>> 16) & 0xffff) / 0xffff) - 0.5) * spread;
  return { latitude: lat + latOffset, longitude: lng + lngOffset };
}

function normalizeAddressText(...values: Array<string | null | undefined>) {
  return values
    .filter(Boolean)
    .join(" ")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function estimateChinaLocationFromAddress(args: {
  address?: string | null;
  city?: string | null;
  province?: string | null;
}): ChinaCentroidEstimate | null {
  const haystack = normalizeAddressText(args.address, args.city, args.province);
  if (!haystack) return null;

  const cityMatch = Object.entries(cityCentroids)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => haystack.includes(key));
  if (cityMatch) {
    const [, match] = cityMatch;
    const jittered = withJitter(match.lat, match.lng, haystack, 0.12);
    return {
      ...jittered,
      confidence: 0.68,
      provider: "address-city-centroid",
      province: match.province,
      city: match.label
    };
  }

  const provinceMatch = Object.entries(provinceCentroids)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([key]) => haystack.includes(key));
  if (provinceMatch) {
    const [, match] = provinceMatch;
    const jittered = withJitter(match.lat, match.lng, haystack, 0.45);
    return {
      ...jittered,
      confidence: 0.54,
      provider: "address-province-centroid",
      province: match.label
    };
  }

  return null;
}
