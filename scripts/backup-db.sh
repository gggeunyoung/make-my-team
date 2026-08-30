#!/usr/bin/env bash
# 동네프로 DB 백업 — Supabase에서 전체 데이터를 덤프해 로컬에 보관합니다.
#
#   사용법:  ./scripts/backup-db.sh
#
# 백업 파일에는 사용자 이메일/이름 등 개인정보가 들어 있습니다.
# 저장 위치(~/dongnaepro-backups)는 저장소 바깥이라 커밋될 일이 없지만,
# 다른 곳으로 옮길 때도 공개 저장소에는 절대 두지 마십시오.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${DONGNAEPRO_BACKUP_DIR:-$HOME/dongnaepro-backups}"
KEEP=20  # 보관할 백업 개수 (오래된 것부터 삭제)

PG_DUMP="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
if [[ ! -x "$PG_DUMP" ]]; then
  PG_DUMP="$(command -v pg_dump || true)"
fi
if [[ -z "$PG_DUMP" ]]; then
  echo "❌ pg_dump 를 찾을 수 없습니다. 설치: brew install postgresql@17" >&2
  exit 1
fi

if [[ ! -f "$REPO_DIR/.env" ]]; then
  echo "❌ .env 파일이 없습니다: $REPO_DIR/.env" >&2
  exit 1
fi

DATABASE_URL="$(grep -m1 '^DATABASE_URL=' "$REPO_DIR/.env" | sed 's/^DATABASE_URL=//')"
if [[ -z "$DATABASE_URL" ]]; then
  echo "❌ .env 에서 DATABASE_URL 을 읽지 못했습니다." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/dongnaepro-$STAMP.dump"

echo "▶ 백업 중... ($(basename "$OUT"))"
"$PG_DUMP" "$DATABASE_URL" \
  --format=custom \
  --schema=public \
  --no-owner --no-privileges \
  --file="$OUT"

# 덤프가 실제로 읽히는지 즉시 검증 (빈 파일/손상 조기 발견)
PG_RESTORE="$(dirname "$PG_DUMP")/pg_restore"
TABLES="$("$PG_RESTORE" --list "$OUT" | grep -c 'TABLE DATA' || true)"
if [[ "$TABLES" -lt 1 ]]; then
  echo "❌ 백업은 만들어졌지만 테이블 데이터가 없습니다. 확인이 필요합니다: $OUT" >&2
  exit 1
fi

echo "✅ 완료  —  테이블 $TABLES개  /  $(du -h "$OUT" | cut -f1)"
echo "   $OUT"

# 오래된 백업 정리
COUNT="$(ls -1t "$BACKUP_DIR"/dongnaepro-*.dump 2>/dev/null | wc -l | tr -d ' ')"
if (( COUNT > KEEP )); then
  ls -1t "$BACKUP_DIR"/dongnaepro-*.dump | tail -n +$((KEEP + 1)) | while read -r old; do
    rm -f "$old"
    echo "   (오래된 백업 삭제: $(basename "$old"))"
  done
fi
