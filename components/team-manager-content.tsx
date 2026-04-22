"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { calculateTeamNameUnits } from "@/lib/team";

type ManagerTab = "MATCH" | "PLAYER" | "TOURNAMENT" | "TEAM";

type TeamManagerContentProps = {
  teamId: string;
  initialTeam: {
    name: string;
    logo: string | null;
    color: string | null;
    sportType: "FUTSAL" | "SOCCER";
    accessCode: string;
  };
};

const sidebarMenus: Array<{ key: ManagerTab; label: string }> = [
  { key: "MATCH", label: "매칭관리" },
  { key: "PLAYER", label: "선수관리" },
  { key: "TOURNAMENT", label: "대회관리" },
  { key: "TEAM", label: "팀관리" },
];

function getProgressColor(units: number) {
  if (units >= 30) return "bg-red-500";
  if (units >= 25) return "bg-yellow-500";
  return "bg-blue-500";
}

function sportTypeLabel(sportType: "FUTSAL" | "SOCCER") {
  return sportType === "FUTSAL" ? "풋살 팀" : "축구 팀";
}

export function TeamManagerContent({ teamId, initialTeam }: TeamManagerContentProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<ManagerTab>("MATCH");
  const [name, setName] = useState(initialTeam.name);
  const [logo, setLogo] = useState<string | null>(initialTeam.logo);
  const [color, setColor] = useState(initialTeam.color ?? "#2563eb");
  const [nameLimitMessage, setNameLimitMessage] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const units = useMemo(() => calculateTeamNameUnits(name), [name]);
  const progress = Math.min((units / 30) * 100, 100);

  const onTeamNameChange = (nextName: string) => {
    const nextUnits = calculateTeamNameUnits(nextName);
    if (nextUnits <= 30) {
      setName(nextName);
      setNameLimitMessage("");
      return;
    }
    setNameLimitMessage("팀명이 가득 찼어요! 더 이상 입력할 수 없습니다.");
  };

  const onLogoFileChange = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setIsError(true);
      setMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });

    setLogo(dataUrl);
    setIsError(false);
    setMessage("");
  };

  const onCopyAccessCode = async () => {
    try {
      await navigator.clipboard.writeText(initialTeam.accessCode);
      setIsError(false);
      setMessage("운영자 코드가 복사되었습니다.");
    } catch {
      setIsError(true);
      setMessage("복사에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const onSaveTeam = async (e: FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (units < 2 || units > 30) {
      setIsError(true);
      setMessage("팀 이름은 2~30 Unit이어야 합니다.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setIsError(false);

    try {
      const res = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          logo,
          color,
        }),
      });
      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        setIsError(true);
        setMessage(data.message ?? "팀 정보 저장에 실패했습니다.");
        setSubmitting(false);
        return;
      }

      setIsError(false);
      setMessage("팀 정보가 저장되었습니다.");
    } catch {
      setIsError(true);
      setMessage("팀 정보 저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (() => {
    if (activeMenu === "TEAM") {
      return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-zinc-900">팀관리</h2>
          <p className="mt-1 text-sm text-zinc-500">팀 기본 정보를 수정할 수 있습니다.</p>

          <form onSubmit={onSaveTeam} className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">팀 로고</label>
              {logo ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-2 block h-28 w-28 overflow-hidden rounded-xl"
                  aria-label="팀 로고 업로드"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logo} alt="업로드된 팀 로고 미리보기" className="h-28 w-28 rounded-xl object-cover" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mb-2 flex h-28 w-28 items-center justify-center rounded-xl bg-zinc-200 text-sm text-zinc-600"
                  aria-label="팀 로고 업로드"
                >
                  팀 로고
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void onLogoFileChange(e.target.files?.[0])}
                className="block w-full text-sm text-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">팀 이름</label>
              <input
                value={name}
                onChange={(e) => onTeamNameChange(e.target.value)}
                className="h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
                placeholder="팀 이름을 입력하세요"
              />
              {nameLimitMessage ? <p className="mt-1 text-xs text-red-600">{nameLimitMessage}</p> : null}
              <div className="mt-2 h-2 w-full rounded bg-zinc-100">
                <div
                  className={`h-2 rounded transition-all ${getProgressColor(units)}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">{units.toFixed(1)} / 30 Unit</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">팀 유형</label>
              <input
                value={sportTypeLabel(initialTeam.sportType)}
                readOnly
                className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-100 px-3 text-sm text-zinc-700"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">팀 운영자코드</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={initialTeam.accessCode}
                  readOnly
                  className="h-11 flex-1 rounded-lg border border-zinc-200 bg-zinc-100 px-3 text-sm tracking-widest text-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => void onCopyAccessCode()}
                  className="h-11 rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  복사
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">팀 대표 색깔</label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-20" />
            </div>

            {message ? (
              <p className={`text-sm ${isError ? "text-red-600" : "text-emerald-600"}`}>
                {message}
              </p>
            ) : null}

            <button type="submit" className="h-11 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white">
              {submitting ? "저장 중..." : "저장"}
            </button>
          </form>
        </section>
      );
    }

    if (activeMenu === "PLAYER" || activeMenu === "TOURNAMENT") {
      return <section className="rounded-xl border border-zinc-200 bg-white p-8" />;
    }

    return (
      <section className="rounded-xl border border-zinc-200 bg-white p-8 text-zinc-600">매칭관리 화면 (준비 중)</section>
    );
  })();

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
      <button
        type="button"
        onClick={() => {
          window.location.href = `/team/${teamId}`;
        }}
        className="mb-4 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        ← 뒤로가기
      </button>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl border border-zinc-200 bg-white p-2">
          <nav className="flex flex-col gap-1">
            {sidebarMenus.map((menu) => {
              const isActive = activeMenu === menu.key;
              return (
                <button
                  key={menu.key}
                  type="button"
                  onClick={() => setActiveMenu(menu.key)}
                  className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                    isActive ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {menu.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <div>{content}</div>
      </div>
    </main>
  );
}
