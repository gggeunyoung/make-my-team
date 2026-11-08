"use client";

import { useEffect, useRef, useState } from "react";
import { uploadKakaoImage } from "@/components/kakao-sdk";
import { SHARE_CARD_SIZE } from "@/components/share-card-canvas";

export type KakaoShareDraft = {
  /** 창 제목 (예: 시상식 공유) */
  heading: string;
  /** 카카오톡 메시지의 자세히 보기 링크 */
  url: string;
  /** 같은 내용을 다시 공유할 때 이미 올린 이미지를 재사용하는 키 */
  imageKey: string;
  /** 1080×1080 공유 카드를 그린다 */
  renderImage: () => Promise<Blob>;
  /** 카카오톡 메시지 제목/설명 (각각 최대 2줄 표시) */
  title: string;
  description: string;
  /** 이미지를 올리지 못했을 때 보낼 텍스트 메시지 */
  fallbackText: string;
  /** 이미지 저장 시 파일 이름 */
  fileName: string;
};

type CardState =
  | { status: "rendering" }
  | { status: "uploading"; previewUrl: string }
  | { status: "ready"; previewUrl: string; imageUrl: string }
  | { status: "failed"; previewUrl: string | null };

/** 같은 카드를 여러 번 공유해도 카카오 서버에는 한 번만 올린다. */
const kakaoImageUploads = new Map<string, Promise<string>>();

function uploadOnce(key: string, image: Blob) {
  let upload = kakaoImageUploads.get(key);
  if (!upload) {
    upload = uploadKakaoImage(image, "share-card.jpg");
    kakaoImageUploads.set(key, upload);
    upload.catch(() => kakaoImageUploads.delete(key));
  }
  return upload;
}

function KakaoSymbol() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path d="M12 3.5c-5.25 0-9.5 3.33-9.5 7.44 0 2.66 1.78 5 4.46 6.3l-.9 3.32c-.08.3.26.54.52.37l3.97-2.62c.47.05.95.08 1.45.08 5.25 0 9.5-3.33 9.5-7.45S17.25 3.5 12 3.5z" />
    </svg>
  );
}

/** 공유 카드 미리보기 → 카카오톡 피드 메시지(이미지 + 제목 + 설명)로 보내는 창 */
export function KakaoShareDialog({
  draft,
  onClose,
  onToast,
}: {
  draft: KakaoShareDraft;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [card, setCard] = useState<CardState>({ status: "rendering" });
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    let previewUrl: string | null = null;

    void (async () => {
      try {
        const image = await draft.renderImage();
        if (cancelled) return;
        previewUrl = URL.createObjectURL(image);
        setCard({ status: "uploading", previewUrl });
        const imageUrl = await uploadOnce(draft.imageKey, image);
        if (!cancelled) setCard({ status: "ready", previewUrl, imageUrl });
      } catch {
        if (!cancelled) setCard({ status: "failed", previewUrl });
      }
    })();

    return () => {
      cancelled = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [draft]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const canUseKakao = Boolean(window.Kakao?.isInitialized());
  const busy = card.status === "rendering" || card.status === "uploading";
  const previewUrl = card.status === "rendering" ? null : card.previewUrl;

  const share = async () => {
    const kakao = window.Kakao;
    if (kakao?.isInitialized()) {
      const link = { mobileWebUrl: draft.url, webUrl: draft.url };
      try {
        if (card.status === "ready") {
          kakao.Share.sendDefault({
            objectType: "feed",
            content: {
              title: draft.title,
              description: draft.description || undefined,
              imageUrl: card.imageUrl,
              imageWidth: SHARE_CARD_SIZE,
              imageHeight: SHARE_CARD_SIZE,
              link,
            },
          });
        } else {
          kakao.Share.sendDefault({ objectType: "text", text: draft.fallbackText, link });
        }
        onClose();
        return;
      } catch {
        // SDK 오류 시 아래 클립보드 복사로 대체
      }
    }

    try {
      await navigator.clipboard.writeText(`${draft.fallbackText}\n\n${draft.url}`);
      onToast("메세지가 복사됐어요! 카카오톡에 붙여넣기 해주세요");
    } catch {
      onToast("공유에 실패했습니다. 다시 시도해주세요.");
    }
    onClose();
  };

  let notice: string | null = null;
  if (card.status === "failed") {
    notice = canUseKakao ? "이미지를 올리지 못해 글로만 공유돼요" : "카카오톡 공유를 쓸 수 없어 메시지를 복사해요";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kakao-share-dialog-title"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-sm sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 id="kakao-share-dialog-title" className="text-base font-bold text-zinc-900">
            {draft.heading}
          </h3>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="-mr-1.5 rounded-full p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="h-5 w-5">
              <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="mt-4 aspect-square w-full overflow-hidden rounded-2xl bg-zinc-100">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`${draft.title} 공유 이미지`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-400">이미지 만드는 중…</div>
          )}
        </div>

        {notice ? <p className="mt-3 text-center text-xs text-zinc-500">{notice}</p> : null}

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => void share()}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] text-sm font-semibold text-[#191919] transition hover:brightness-95 disabled:cursor-default disabled:opacity-60"
          >
            <KakaoSymbol />
            {busy ? "이미지 준비 중…" : canUseKakao ? "카카오톡으로 공유하기" : "메시지 복사하기"}
          </button>
          {previewUrl ? (
            <a
              href={previewUrl}
              download={draft.fileName}
              className="flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              이미지 저장
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
