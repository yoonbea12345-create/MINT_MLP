// 인증 리스트 레지스트리 — 여기 배열에만 등록하면 뱃지·매칭·안내가 자동 반영된다.
// priority 오름차순으로 뱃지가 노출되며, 카드에는 상위 2개까지 표시(match.ts·ResultCard 참고).

import type { CertSource } from './types';
import { MICHELIN } from './michelin';
import { USHULANG } from './ushulang';
import { BAEKNYEON } from './baeknyeon';
import { GOODPRICE } from './goodprice';

export const CERT_SOURCES: CertSource[] = [MICHELIN, USHULANG, BAEKNYEON, GOODPRICE];

export type { CertSource, CertEntry, CertMatch, Sido } from './types';
export { findCertifications, normalizeName } from './match';
