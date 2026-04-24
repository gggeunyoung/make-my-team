"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { calculateTeamNameUnits } from "@/lib/team";
import { PLAYER_STYLE_OPTIONS, POSITION_OPTIONS, type PlayerStyleValue, type PositionValue } from "@/lib/player";
import { MatchManagerTab } from "@/components/match-manager-tab";

type ManagerTab = "MATCH" | "PLAYER" | "TOURNAMENT" | "TEAM";
type SportType = "FUTSAL" | "SOCCER";
type Player = {
  id: string;
  name: string;
  photo: string | null;
  style: PlayerStyleValue;
  position: PositionValue[];
  createdAt?: string;
};
type PlayerFormItem = {
  clientId: string;
  playerId: string | null;
  name: string;
  photo: string | null;
  style: "" | PlayerStyleValue;
  position: PositionValue[];
  createdAt: string | null;
  removed: boolean;
  errorMessage: string;
  original: {
    name: string;
    photo: string | null;
    style: PlayerStyleValue;
    position: PositionValue[];
  } | null;
};

type TeamManagerContentProps = {
  teamId: string;
  initialTeam: {
    name: string;
    logo: string | null;
    color: string | null;
    sportType: SportType;
    accessCode: string;
  };
  initialPlayers: Player[];
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

function sportTypeLabel(sportType: SportType) {
  return sportType === "FUTSAL" ? "풋살 팀" : "축구 팀";
}

function playerStyleLabel(style: PlayerStyleValue) {
  if (style === "OFFENSIVE") return "공격형";
  if (style === "BALANCED") return "밸런스형";
  if (style === "DEFENSIVE") return "수비형";
  return "골키퍼형";
}

function positionLabel(position: PositionValue) {
  if (position === "FW") return "FW";
  if (position === "MF") return "MF";
  if (position === "DF") return "DF";
  return "GK";
}

function makePlayerFormItem(player?: Player): PlayerFormItem {
  if (!player) {
    return {
      clientId: crypto.randomUUID(),
      playerId: null,
      name: "",
      photo: null,
      style: "",
      position: [],
      createdAt: null,
      removed: false,
      errorMessage: "",
      original: null,
    };
  }

  return {
    clientId: crypto.randomUUID(),
    playerId: player.id,
    name: player.name,
    photo: player.photo,
    style: player.style,
    position: player.position,
    createdAt: player.createdAt ?? null,
    removed: false,
    errorMessage: "",
    original: {
      name: player.name,
      photo: player.photo,
      style: player.style,
      position: player.position,
    },
  };
}

function sortPlayerFormsNewest(forms: PlayerFormItem[]) {
  return [...forms].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
}

export function TeamManagerContent({ teamId, initialTeam, initialPlayers }: TeamManagerContentProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<ManagerTab>("MATCH");
  const [name, setName] = useState(initialTeam.name);
  const [logo, setLogo] = useState<string | null>(initialTeam.logo);
  const [color, setColor] = useState(initialTeam.color ?? "#2563eb");
  const [nameLimitMessage, setNameLimitMessage] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [teamIsError, setTeamIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [playerForms, setPlayerForms] = useState<PlayerFormItem[]>(() =>
    sortPlayerFormsNewest(initialPlayers.map((player) => makePlayerFormItem(player))),
  );
  const [playerSubmitting, setPlayerSubmitting] = useState(false);
  const [playerMessage, setPlayerMessage] = useState("");
  const [playerIsError, setPlayerIsError] = useState(false);
  const [showPlayerInfoModal, setShowPlayerInfoModal] = useState(false);

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
      setTeamIsError(true);
      setTeamMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });

    setLogo(dataUrl);
    setTeamIsError(false);
    setTeamMessage("");
  };

  const onCopyAccessCode = async () => {
    try {
      await navigator.clipboard.writeText(initialTeam.accessCode);
      setTeamIsError(false);
      setTeamMessage("운영자 코드가 복사되었습니다.");
    } catch {
      setTeamIsError(true);
      setTeamMessage("복사에 실패했습니다. 다시 시도해주세요.");
    }
  };

  const onSaveTeam = async (e: FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    if (units < 2 || units > 30) {
      setTeamIsError(true);
      setTeamMessage("팀 이름은 2~30 Unit이어야 합니다.");
      return;
    }

    setSubmitting(true);
    setTeamMessage("");
    setTeamIsError(false);

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
        setTeamIsError(true);
        setTeamMessage(data.message ?? "팀 정보 저장에 실패했습니다.");
        setSubmitting(false);
        return;
      }

      setTeamIsError(false);
      setTeamMessage("팀 정보가 저장되었습니다.");
    } catch {
      setTeamIsError(true);
      setTeamMessage("팀 정보 저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const onAddPlayerContainer = () => {
    setPlayerForms((prev) => [...prev, makePlayerFormItem()]);
    setPlayerMessage("");
    setPlayerIsError(false);
  };

  const onRemovePlayerContainer = (clientId: string) => {
    setPlayerForms((prev) =>
      prev
        .map((item) => {
          if (item.clientId !== clientId) return item;
          if (!item.playerId) return item;
          return { ...item, removed: true, errorMessage: "" };
        })
        .filter((item) => !(item.clientId === clientId && !item.playerId)),
    );
  };

  const onChangePlayerField = (clientId: string, updates: Partial<PlayerFormItem>) => {
    setPlayerForms((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, ...updates, errorMessage: "" } : item)),
    );
  };

  const onPlayerPhotoFileChange = async (clientId: string, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPlayerIsError(true);
      setPlayerMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });

    onChangePlayerField(clientId, { photo: dataUrl });
    setPlayerIsError(false);
    setPlayerMessage("");
  };

  const onTogglePlayerPosition = (clientId: string, position: PositionValue) => {
    setPlayerForms((prev) =>
      prev.map((item) => {
        if (item.clientId !== clientId) return item;
        const exists = item.position.includes(position);
        const nextPositions = exists ? item.position.filter((p) => p !== position) : [...item.position, position];
        return { ...item, position: nextPositions, errorMessage: "" };
      }),
    );
  };

  const samePositions = (a: PositionValue[], b: PositionValue[]) => {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((item, idx) => item === sortedB[idx]);
  };

  const validatePlayerForms = () => {
    const normalizedNames = new Map<string, string[]>();
    const nextErrors = new Map<string, string>();
    const activeForms = playerForms.filter((item) => !item.removed);

    activeForms.forEach((item) => {
      const trimmedName = item.name.trim();
      if (!trimmedName) {
        nextErrors.set(item.clientId, "선수 이름은 필수입니다.");
        return;
      }
      if (!item.style) {
        nextErrors.set(item.clientId, "선수 스타일을 선택해주세요.");
        return;
      }
      if (initialTeam.sportType === "SOCCER" && item.position.length === 0) {
        nextErrors.set(item.clientId, "축구팀은 최소 1개 이상의 포지션을 선택해주세요.");
        return;
      }
      const key = trimmedName.toLowerCase();
      const ids = normalizedNames.get(key) ?? [];
      ids.push(item.clientId);
      normalizedNames.set(key, ids);
    });

    normalizedNames.forEach((ids) => {
      if (ids.length <= 1) return;
      ids.forEach((id) => {
        nextErrors.set(id, "같은 팀 내 선수 이름은 중복될 수 없습니다.");
      });
    });

    setPlayerForms((prev) =>
      prev.map((item) => ({
        ...item,
        errorMessage: nextErrors.get(item.clientId) ?? "",
      })),
    );

    return nextErrors.size === 0;
  };

  const onSavePlayers = async () => {
    if (playerSubmitting) return;

    const isValid = validatePlayerForms();
    if (!isValid) {
      setPlayerIsError(true);
      setPlayerMessage("입력값을 확인해주세요.");
      return;
    }

    setPlayerSubmitting(true);
    setPlayerIsError(false);
    setPlayerMessage("");

    try {
      const nextPlayerForms: PlayerFormItem[] = [];

      for (const item of playerForms) {
        const name = item.name.trim();
        const position = initialTeam.sportType === "SOCCER" ? item.position : [];

        if (item.removed) {
          if (item.playerId) {
            const deactivateRes = await fetch(`/api/player/${item.playerId}/deactivate`, { method: "PUT" });
            const deactivateData = (await deactivateRes.json()) as { message?: string };
            if (!deactivateRes.ok) {
              throw new Error(deactivateData.message ?? "선수 비활성화에 실패했습니다.");
            }
          }
          continue;
        }

        if (!item.playerId) {
          const createRes = await fetch("/api/player/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              name,
              photo: item.photo,
              style: item.style,
              position,
            }),
          });
          const createData = (await createRes.json()) as { player?: Player; message?: string };
          if (!createRes.ok || !createData.player) {
            throw new Error(createData.message ?? "선수 추가에 실패했습니다.");
          }
          nextPlayerForms.push(makePlayerFormItem(createData.player));
          continue;
        }

        const original = item.original;
        const isChanged =
          !original ||
          original.name !== name ||
          original.photo !== item.photo ||
          original.style !== item.style ||
          !samePositions(original.position, position);

        if (!isChanged) {
          nextPlayerForms.push({
            ...item,
            name,
            position,
            errorMessage: "",
          });
          continue;
        }

        const updateRes = await fetch(`/api/player/${item.playerId}/update`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            photo: item.photo,
            style: item.style,
            position,
          }),
        });
        const updateData = (await updateRes.json()) as { player?: Player; message?: string };
        if (!updateRes.ok || !updateData.player) {
          throw new Error(updateData.message ?? "선수 수정에 실패했습니다.");
        }
        nextPlayerForms.push(makePlayerFormItem(updateData.player));
      }

      setPlayerForms(sortPlayerFormsNewest(nextPlayerForms));
      setPlayerIsError(false);
      setPlayerMessage("저장 완료!");
    } catch (error) {
      setPlayerIsError(true);
      setPlayerMessage(error instanceof Error ? error.message : "선수 저장 중 오류가 발생했습니다.");
    } finally {
      setPlayerSubmitting(false);
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

            {teamMessage ? (
              <p className={`text-sm ${teamIsError ? "text-red-600" : "text-emerald-600"}`}>
                {teamMessage}
              </p>
            ) : null}

            <button type="submit" className="h-11 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white">
              {submitting ? "저장 중..." : "저장"}
            </button>
          </form>
        </section>
      );
    }

    if (activeMenu === "PLAYER") {
      return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-900">선수관리</h2>
              <button
                type="button"
                onClick={() => setShowPlayerInfoModal(true)}
                className="text-sm text-zinc-500"
                aria-label="선수관리 안내 열기"
              >
                ℹ️
              </button>
            </div>
            <button
              type="button"
              onClick={onAddPlayerContainer}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              선수 추가
            </button>
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={() => void onSavePlayers()}
              className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white"
            >
              {playerSubmitting ? "저장 중..." : "저장하기"}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {playerForms.map((item) => {
              if (item.removed) return null;
              return (
                <div
                  key={item.clientId}
                  className={`rounded-xl border bg-zinc-50 p-4 ${item.errorMessage ? "border-red-400" : "border-zinc-300"}`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <p className="text-sm font-semibold text-zinc-900">{item.playerId ? "기존 선수" : "새 선수"}</p>
                    <button
                      type="button"
                      onClick={() => onRemovePlayerContainer(item.clientId)}
                      className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      aria-label="선수 삭제"
                    >
                      🗑️
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">선수 사진</label>
                      {item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.photo} alt="선수 사진 미리보기" className="mb-2 h-36 w-28 rounded-lg object-cover" />
                      ) : (
                        <div className="mb-2 flex h-36 w-28 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500">
                          No Photo
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void onPlayerPhotoFileChange(item.clientId, e.target.files?.[0])}
                        className="block w-full text-xs text-zinc-700"
                      />
                      {item.photo ? (
                        <button
                          type="button"
                          onClick={() => onChangePlayerField(item.clientId, { photo: null })}
                          className="mt-2 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700"
                        >
                          사진 제거
                        </button>
                      ) : null}
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">선수 이름</label>
                      <input
                        value={item.name}
                        onChange={(e) => onChangePlayerField(item.clientId, { name: e.target.value })}
                        className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">선수 스타일</label>
                      <select
                        value={item.style}
                        onChange={(e) => onChangePlayerField(item.clientId, { style: e.target.value as PlayerStyleValue | "" })}
                        className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
                      >
                        <option value="">선택</option>
                        {PLAYER_STYLE_OPTIONS.map((style) => (
                          <option key={style} value={style}>
                            {playerStyleLabel(style)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {initialTeam.sportType === "SOCCER" ? (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">선수 포지션</label>
                        <div className="flex flex-wrap gap-2">
                          {POSITION_OPTIONS.map((position) => {
                            const checked = item.position.includes(position);
                            return (
                              <button
                                key={position}
                                type="button"
                                onClick={() => onTogglePlayerPosition(item.clientId, position)}
                                className={`rounded-md border px-2 py-1 text-xs ${
                                  checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
                                }`}
                              >
                                {positionLabel(position)}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {item.errorMessage ? <p className="mt-3 text-sm text-red-600">{item.errorMessage}</p> : null}
                </div>
              );
            })}
          </div>

          {playerMessage ? (
            <p className={`mt-4 text-sm ${playerIsError ? "text-red-600" : "text-emerald-600"}`}>{playerMessage}</p>
          ) : null}

          {showPlayerInfoModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-zinc-900">선수관리 안내</h3>
                  <button
                    type="button"
                    onClick={() => setShowPlayerInfoModal(false)}
                    className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100"
                    aria-label="안내 닫기"
                  >
                    X
                  </button>
                </div>
                <p className="whitespace-pre-line text-sm text-zinc-700">
                  선수 사진은 있으면 좋고 없어도 괜찮습니다.
                  {"\n"}이름은 팀 내에서 중복될 수 없으며 동명이인의 경우 따로 구분해 주세요.
                  {"\n"}선수 스타일은 포지션과 무관하게 그 선수의 성향을 선택해 주세요.
                  {"\n"}공격 상황에서 적극적인 침투와 움직임을 보여주는 선수는 공격형,
                  {"\n"}수비 상황에서 빠른 커버와 압박을 보여주는 선수는 수비형,
                  {"\n"}두 가지를 균형있게 수행하면 밸런스형,
                  {"\n"}든든한 수문장은 골키퍼를 선택해 주세요.
                  {"\n"}(축구팀의 경우 포지션은 복수 선택 가능합니다.)
                </p>
              </div>
            </div>
          ) : null}
        </section>
      );
    }

    if (activeMenu === "TOURNAMENT") {
      return <section className="rounded-xl border border-zinc-200 bg-white p-8" />;
    }

    return (
      <MatchManagerTab
        teamId={teamId}
        sportType={initialTeam.sportType}
        players={initialPlayers.map((player) => ({ id: player.id, name: player.name }))}
      />
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
