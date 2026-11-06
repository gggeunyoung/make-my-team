export const KAKAO_SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js";

/** 카카오톡 텍스트 템플릿 본문 최대 길이 */
export const KAKAO_TEXT_MAX_LENGTH = 200;

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: {
          objectType: "text";
          text: string;
          link: {
            mobileWebUrl: string;
            webUrl: string;
          };
        }) => void;
      };
    };
  }
}

export function initKakaoSdk() {
  if (!window.Kakao || !KAKAO_JS_KEY || window.Kakao.isInitialized()) return;
  window.Kakao.init(KAKAO_JS_KEY);
}
