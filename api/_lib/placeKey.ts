import { createHash } from 'crypto';

function normalize(s: string): string {
  return (s ?? '').replace(/\s+/g, '').trim();
}

// 상호명+주소로 결정적 캐시 키 생성 (place_buzz_cache, license_cache 매칭 공용)
export function placeKey(name: string, address: string): string {
  return createHash('sha1').update(`${normalize(name)}|${normalize(address)}`).digest('hex');
}
