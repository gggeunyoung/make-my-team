export const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

/** 카카오톡 텍스트 템플릿 본문 최대 길이 */
export const KAKAO_TEXT_MAX_LENGTH = 200;

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
const UPLOAD_TIMEOUT_MS = 15000;

type KakaoLink = {
  mobileWebUrl: string;
  webUrl: string;
};

type KakaoTextTemplate = {
  objectType: "text";
  text: string;
  link: KakaoLink;
};

/** 피드 템플릿: 이미지 + 제목/설명(각각 최대 2줄 표시) + 자세히 보기 버튼 */
type KakaoFeedTemplate = {
  objectType: "feed";
  content: {
    title: string;
    description?: string;
    imageUrl: string;
    imageWidth?: number;
    imageHeight?: number;
    link: KakaoLink;
  };
};

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: KakaoTextTemplate | KakaoFeedTemplate) => void;
        uploadImage: (options: { file: File[] }) => Promise<{ infos: { original: { url: string } } }>;
      };
    };
  }
}

export function initKakaoSdk() {
  if (!window.Kakao || !KAKAO_JS_KEY || window.Kakao.isInitialized()) return;
  window.Kakao.init(KAKAO_JS_KEY);
}

/** 카카오톡 메시지에 넣을 이미지를 카카오 서버에 올리고 URL을 받는다 (카카오 서버에 100일 보관). */
export async function uploadKakaoImage(image: Blob, fileName: string): Promise<string> {
  const kakao = window.Kakao;
  if (!kakao?.isInitialized()) throw new Error("Kakao SDK가 준비되지 않았습니다.");

  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("이미지 업로드 시간이 초과되었습니다.")), UPLOAD_TIMEOUT_MS);
  });
  try {
    const file = new File([image], fileName, { type: image.type });
    const response = await Promise.race([kakao.Share.uploadImage({ file: [file] }), timeout]);
    return response.infos.original.url;
  } finally {
    window.clearTimeout(timer);
  }
}
