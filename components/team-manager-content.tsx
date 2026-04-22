"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { calculateTeamNameUnits } from "@/lib/team";
import { PLAYER_STYLE_OPTIONS, POSITION_OPTIONS, type PlayerStyleValue, type PositionValue } from "@/lib/player";

type ManagerTab = "MATCH" | "PLAYER" | "TOURNAMENT" | "TEAM";
type SportType = "FUTSAL" | "SOCCER";
type Player = {
  id: string;
  name: string;
  photo: string | null;
  style: PlayerStyleValue;
  position: PositionValue[];
};
type PlayerDraft = {
  name: string;
  photo: string | null;
  style: "" | PlayerStyleValue;
  position: PositionValue[];
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

function makeEmptyPlayerDraft(): PlayerDraft {
  return {
    name: "",
    photo: null,
    style: "",
    position: [],
  };
}

function makePlayerDraft(player: Player): PlayerDraft {
  return {
    name: player.name,
    photo: player.photo,
    style: player.style,
    position: player.position,
  };
}

export function TeamManagerContent({ teamId, initialTeam, initialPlayers }: TeamManagerContentProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const createFileInputRef = useRef<HTMLInputElement | null>(null);
  const editFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<ManagerTab>("MATCH");
  const [name, setName] = useState(initialTeam.name);
  const [logo, setLogo] = useState<string | null>(initialTeam.logo);
  const [color, setColor] = useState(initialTeam.color ?? "#2563eb");
  const [nameLimitMessage, setNameLimitMessage] = useState("");
  const [teamMessage, setTeamMessage] = useState("");
  const [teamIsError, setTeamIsError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [showCreatePlayerForm, setShowCreatePlayerForm] = useState(false);
  const [createPlayerDraft, setCreatePlayerDraft] = useState<PlayerDraft>(makeEmptyPlayerDraft());
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerDraft, setEditPlayerDraft] = useState<PlayerDraft>(makeEmptyPlayerDraft());
  const [playerSubmitting, setPlayerSubmitting] = useState(false);
  const [playerMessage, setPlayerMessage] = useState("");
  const [playerIsError, setPlayerIsError] = useState(false);

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

  const onPlayerPhotoFileChange = async (
    file: File | undefined,
    mode: "create" | "edit",
  ) => {
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

    if (mode === "create") {
      setCreatePlayerDraft((prev) => ({ ...prev, photo: dataUrl }));
    } else {
      setEditPlayerDraft((prev) => ({ ...prev, photo: dataUrl }));
    }
    setPlayerIsError(false);
    setPlayerMessage("");
  };

  const onTogglePlayerPosition = (position: PositionValue, mode: "create" | "edit") => {
    const updater = (draft: PlayerDraft): PlayerDraft => {
      const exists = draft.position.includes(position);
      const nextPositions = exists
        ? draft.position.filter((item) => item !== position)
        : [...draft.position, position];
      return { ...draft, position: nextPositions };
    };

    if (mode === "create") {
      setCreatePlayerDraft((prev) => updater(prev));
      return;
    }
    setEditPlayerDraft((prev) => updater(prev));
  };

  const onCreatePlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (playerSubmitting) return;
    if (!createPlayerDraft.name.trim()) {
      setPlayerIsError(true);
      setPlayerMessage("선수 이름은 필수입니다.");
      return;
    }
    if (!createPlayerDraft.style) {
      setPlayerIsError(true);
      setPlayerMessage("선수 스타일을 선택해주세요.");
      return;
    }

    setPlayerSubmitting(true);
    setPlayerMessage("");
    setPlayerIsError(false);

    try {
      const res = await fetch("/api/player/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          name: createPlayerDraft.name.trim(),
          photo: createPlayerDraft.photo,
          style: createPlayerDraft.style,
          position: initialTeam.sportType === "SOCCER" ? createPlayerDraft.position : [],
        }),
      });
      const data = (await res.json()) as { player?: Player; message?: string };

      if (!res.ok) {
        setPlayerIsError(true);
        setPlayerMessage(data.message ?? "선수 추가에 실패했습니다.");
        setPlayerSubmitting(false);
        return;
      }
      if (data.player) {
        setPlayers((prev) => [...prev, data.player as Player]);
      }
      setShowCreatePlayerForm(false);
      setCreatePlayerDraft(makeEmptyPlayerDraft());
      setPlayerIsError(false);
      setPlayerMessage("선수가 추가되었습니다.");
    } catch {
      setPlayerIsError(true);
      setPlayerMessage("선수 추가 중 오류가 발생했습니다.");
    } finally {
      setPlayerSubmitting(false);
    }
  };

  const onStartEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditPlayerDraft(makePlayerDraft(player));
    setPlayerIsError(false);
    setPlayerMessage("");
  };

  const onUpdatePlayer = async (e: FormEvent) => {
    e.preventDefault();
    if (playerSubmitting || !editingPlayerId) return;
    if (!editPlayerDraft.name.trim()) {
      setPlayerIsError(true);
      setPlayerMessage("선수 이름은 필수입니다.");
      return;
    }
    if (!editPlayerDraft.style) {
      setPlayerIsError(true);
      setPlayerMessage("선수 스타일을 선택해주세요.");
      return;
    }

    setPlayerSubmitting(true);
    setPlayerMessage("");
    setPlayerIsError(false);

    try {
      const res = await fetch(`/api/player/${editingPlayerId}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editPlayerDraft.name.trim(),
          photo: editPlayerDraft.photo,
          style: editPlayerDraft.style,
          position: initialTeam.sportType === "SOCCER" ? editPlayerDraft.position : [],
        }),
      });
      const data = (await res.json()) as { player?: Player; message?: string };

      if (!res.ok) {
        setPlayerIsError(true);
        setPlayerMessage(data.message ?? "선수 수정에 실패했습니다.");
        setPlayerSubmitting(false);
        return;
      }
      if (data.player) {
        setPlayers((prev) => prev.map((player) => (player.id === data.player?.id ? (data.player as Player) : player)));
      }
      setEditingPlayerId(null);
      setEditPlayerDraft(makeEmptyPlayerDraft());
      setPlayerIsError(false);
      setPlayerMessage("선수 정보가 저장되었습니다.");
    } catch {
      setPlayerIsError(true);
      setPlayerMessage("선수 수정 중 오류가 발생했습니다.");
    } finally {
      setPlayerSubmitting(false);
    }
  };

  const onDeactivatePlayer = async (playerId: string) => {
    if (playerSubmitting) return;

    setPlayerSubmitting(true);
    setPlayerMessage("");
    setPlayerIsError(false);
    try {
      const res = await fetch(`/api/player/${playerId}/deactivate`, {
        method: "PUT",
      });
      const data = (await res.json()) as { message?: string };

      if (!res.ok) {
        setPlayerIsError(true);
        setPlayerMessage(data.message ?? "선수 삭제에 실패했습니다.");
        setPlayerSubmitting(false);
        return;
      }

      setPlayers((prev) => prev.filter((player) => player.id !== playerId));
      if (editingPlayerId === playerId) {
        setEditingPlayerId(null);
        setEditPlayerDraft(makeEmptyPlayerDraft());
      }
      setPlayerIsError(false);
      setPlayerMessage("선수가 비활성화되었습니다.");
    } catch {
      setPlayerIsError(true);
      setPlayerMessage("선수 삭제 중 오류가 발생했습니다.");
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
            <h2 className="text-lg font-semibold text-zinc-900">선수관리</h2>
            <button
              type="button"
              onClick={() => {
                setShowCreatePlayerForm((prev) => !prev);
                setCreatePlayerDraft(makeEmptyPlayerDraft());
                setEditingPlayerId(null);
              }}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              선수 추가
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            {showCreatePlayerForm ? (
              <form onSubmit={onCreatePlayer} className="w-full max-w-[260px] rounded-xl border border-zinc-300 bg-zinc-50 p-4">
                <p className="mb-3 text-sm font-semibold text-zinc-900">선수 추가</p>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">선수 사진</label>
                    {createPlayerDraft.photo ? (
                      <button
                        type="button"
                        onClick={() => createFileInputRef.current?.click()}
                        className="mb-2 block h-36 w-28 overflow-hidden rounded-lg"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={createPlayerDraft.photo}
                          alt="선수 사진 미리보기"
                          className="h-36 w-28 rounded-lg object-cover"
                        />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => createFileInputRef.current?.click()}
                        className="mb-2 flex h-36 w-28 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-600"
                      >
                        선수 사진
                      </button>
                    )}
                    <input
                      ref={createFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => void onPlayerPhotoFileChange(e.target.files?.[0], "create")}
                      className="block w-full text-xs text-zinc-700"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">선수 이름</label>
                    <input
                      value={createPlayerDraft.name}
                      onChange={(e) => setCreatePlayerDraft((prev) => ({ ...prev, name: e.target.value }))}
                      className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">선수 스타일</label>
                    <select
                      value={createPlayerDraft.style}
                      onChange={(e) =>
                        setCreatePlayerDraft((prev) => ({
                          ...prev,
                          style: e.target.value as PlayerStyleValue | "",
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
                    >
                      <option value="">선택</option>
                      {PLAYER_STYLE_OPTIONS.map((style) => (
                        <option key={style} value={style}>
                          {style}
                        </option>
                      ))}
                    </select>
                  </div>

                  {initialTeam.sportType === "SOCCER" ? (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">선수 포지션</label>
                      <div className="flex flex-wrap gap-2">
                        {POSITION_OPTIONS.map((position) => {
                          const checked = createPlayerDraft.position.includes(position);
                          return (
                            <button
                              key={position}
                              type="button"
                              onClick={() => onTogglePlayerPosition(position, "create")}
                              className={`rounded-md border px-2 py-1 text-xs ${
                                checked ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700"
                              }`}
                            >
                              {position}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <button type="submit" className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white">
                    저장
                  </button>
                </div>
              </form>
            ) : null}

            {players.map((player) => {
              if (editingPlayerId === player.id) {
                return (
                  <form
                    key={player.id}
                    onSubmit={onUpdatePlayer}
                    className="w-full max-w-[260px] rounded-xl border border-zinc-300 bg-zinc-50 p-4"
                  >
                    <p className="mb-3 text-sm font-semibold text-zinc-900">선수 수정</p>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">선수 사진</label>
                        {editPlayerDraft.photo ? (
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="mb-2 block h-36 w-28 overflow-hidden rounded-lg"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={editPlayerDraft.photo}
                              alt="선수 사진 미리보기"
                              className="h-36 w-28 rounded-lg object-cover"
                            />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => editFileInputRef.current?.click()}
                            className="mb-2 flex h-36 w-28 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-600"
                          >
                            선수 사진
                          </button>
                        )}
                        <input
                          ref={editFileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => void onPlayerPhotoFileChange(e.target.files?.[0], "edit")}
                          className="block w-full text-xs text-zinc-700"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">선수 이름</label>
                        <input
                          value={editPlayerDraft.name}
                          onChange={(e) => setEditPlayerDraft((prev) => ({ ...prev, name: e.target.value }))}
                          className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-600">선수 스타일</label>
                        <select
                          value={editPlayerDraft.style}
                          onChange={(e) =>
                            setEditPlayerDraft((prev) => ({
                              ...prev,
                              style: e.target.value as PlayerStyleValue | "",
                            }))
                          }
                          className="h-10 w-full rounded-lg border border-zinc-300 px-2 text-sm text-zinc-900"
                        >
                          <option value="">선택</option>
                          {PLAYER_STYLE_OPTIONS.map((style) => (
                            <option key={style} value={style}>
                              {style}
                            </option>
                          ))}
                        </select>
                      </div>

                      {initialTeam.sportType === "SOCCER" ? (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-zinc-600">선수 포지션</label>
                          <div className="flex flex-wrap gap-2">
                            {POSITION_OPTIONS.map((position) => {
                              const checked = editPlayerDraft.position.includes(position);
                              return (
                                <button
                                  key={position}
                                  type="button"
                                  onClick={() => onTogglePlayerPosition(position, "edit")}
                                  className={`rounded-md border px-2 py-1 text-xs ${
                                    checked
                                      ? "border-zinc-900 bg-zinc-900 text-white"
                                      : "border-zinc-300 text-zinc-700"
                                  }`}
                                >
                                  {position}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPlayerId(null);
                            setEditPlayerDraft(makeEmptyPlayerDraft());
                          }}
                          className="h-10 rounded-lg border border-zinc-300 text-sm font-medium text-zinc-700"
                        >
                          취소
                        </button>
                        <button type="submit" className="h-10 rounded-lg bg-zinc-900 text-sm font-semibold text-white">
                          저장
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onDeactivatePlayer(player.id)}
                        className="h-10 w-full rounded-lg border border-red-300 text-sm font-medium text-red-600"
                      >
                        삭제(비활성화)
                      </button>
                    </div>
                  </form>
                );
              }

              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => onStartEditPlayer(player)}
                  className="w-full max-w-[260px] rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-zinc-300"
                >
                  {player.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={player.photo} alt={`${player.name} 사진`} className="h-36 w-28 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-36 w-28 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500">
                      No Photo
                    </div>
                  )}
                  <p className="mt-3 text-sm font-semibold text-zinc-900">{player.name}</p>
                  <p className="mt-1 text-xs text-zinc-600">{playerStyleLabel(player.style)}</p>
                  {initialTeam.sportType === "SOCCER" && player.position.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-500">{player.position.map((item) => positionLabel(item)).join(", ")}</p>
                  ) : null}
                </button>
              );
            })}
          </div>

          {playerMessage ? (
            <p className={`mt-4 text-sm ${playerIsError ? "text-red-600" : "text-emerald-600"}`}>{playerMessage}</p>
          ) : null}
        </section>
      );
    }

    if (activeMenu === "TOURNAMENT") {
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
