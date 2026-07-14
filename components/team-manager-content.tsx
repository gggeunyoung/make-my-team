"use client";

import { createClient } from "@supabase/supabase-js";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateTeamNameUnits } from "@/lib/team";
import { PLAYER_STYLE_OPTIONS, POSITION_OPTIONS, type PlayerStyleValue, type PositionValue } from "@/lib/player";
import { ConfirmModal } from "@/components/confirm-modal";
import { MatchManagerTab } from "@/components/match-manager-tab";
import { TournamentManagerTab } from "@/components/tournament-manager-tab";
import { PlayerPhotoCropModal } from "@/components/player-photo-crop-modal";
import { TeamLogo } from "@/components/team-logo";

type ManagerTab = "MATCH" | "PLAYER" | "TOURNAMENT" | "TEAM";

const SECTION_TO_TAB: Record<string, ManagerTab> = {
  match: "MATCH",
  player: "PLAYER",
  tournament: "TOURNAMENT",
  team: "TEAM",
};

const TAB_TO_SECTION: Record<ManagerTab, string> = {
  MATCH: "match",
  PLAYER: "player",
  TOURNAMENT: "tournament",
  TEAM: "team",
};

const TOURNAMENT_DRAFT_KEY_PREFIX = "tournament-match-form-draft:";

function findTournamentDraftId(): string | null {
  if (typeof window === "undefined") return null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(TOURNAMENT_DRAFT_KEY_PREFIX)) {
      return key.slice(TOURNAMENT_DRAFT_KEY_PREFIX.length);
    }
  }
  return null;
}
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
    const aNew = !a.createdAt;
    const bNew = !b.createdAt;
    if (aNew && bNew) return 0;
    if (aNew) return -1;
    if (bNew) return 1;
    const timeA = new Date(a.createdAt!).getTime();
    const timeB = new Date(b.createdAt!).getTime();
    return timeB - timeA;
  });
}

function samePositions(a: PositionValue[], b: PositionValue[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((item, idx) => item === sortedB[idx]);
}

function getPlayerFormPosition(item: PlayerFormItem, sportType: SportType): PositionValue[] {
  return sportType === "SOCCER" ? item.position : [];
}

function isPlayerFormNew(item: PlayerFormItem): boolean {
  return item.playerId === null;
}

function isPlayerFormModified(item: PlayerFormItem, sportType: SportType): boolean {
  if (!item.playerId || !item.original) return false;
  const name = item.name.trim();
  const position = getPlayerFormPosition(item, sportType);
  const original = item.original;
  return (
    original.name !== name ||
    original.photo !== item.photo ||
    original.style !== item.style ||
    !samePositions(original.position, position)
  );
}

function isPlayerFormRemoved(item: PlayerFormItem): boolean {
  return item.removed && item.playerId !== null;
}

function hasPlayerUnsavedChanges(forms: PlayerFormItem[], sportType: SportType): boolean {
  return forms.some(
    (item) =>
      isPlayerFormNew(item) || isPlayerFormModified(item, sportType) || isPlayerFormRemoved(item),
  );
}

function resetPlayerFormsToOriginal(forms: PlayerFormItem[]): PlayerFormItem[] {
  return sortPlayerFormsNewest(
    forms
      .filter((item) => item.playerId && item.original)
      .map((item) =>
        makePlayerFormItem({
          id: item.playerId!,
          name: item.original!.name,
          photo: item.original!.photo,
          style: item.original!.style,
          position: item.original!.position,
          createdAt: item.createdAt ?? undefined,
        }),
      ),
  );
}

function getPlayerCardClass(item: PlayerFormItem, sportType: SportType): string {
  if (item.errorMessage) return "border-red-400 bg-white shadow-sm";
  if (isPlayerFormNew(item)) return "border-blue-300 bg-blue-50 shadow-sm";
  if (isPlayerFormModified(item, sportType)) return "border-amber-400 bg-white shadow-sm";
  return "border-zinc-300 bg-white shadow-sm";
}

function TeamManagerContentInner({ teamId, initialTeam, initialPlayers }: TeamManagerContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeMenu = useMemo(() => {
    const section = searchParams.get("section")?.toLowerCase() ?? "match";
    return SECTION_TO_TAB[section] ?? "MATCH";
  }, [searchParams]);

  const selectSection = useCallback(
    (tab: ManagerTab) => {
      const params = new URLSearchParams();
      params.set("section", TAB_TO_SECTION[tab]);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const draftRedirectDoneRef = useRef(false);

  useEffect(() => {
    if (draftRedirectDoneRef.current) return;
    draftRedirectDoneRef.current = true;

    if (searchParams.get("action")) return;

    const matchDraftKey = `match-form-draft:${teamId}`;
    if (localStorage.getItem(matchDraftKey)) {
      const params = new URLSearchParams();
      params.set("section", "match");
      params.set("action", "create");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }

    const tournamentId = findTournamentDraftId();
    if (tournamentId) {
      const params = new URLSearchParams();
      params.set("section", "tournament");
      params.set("tournamentId", tournamentId);
      params.set("action", "create-match");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [teamId, pathname, router, searchParams]);

  const [name, setName] = useState(initialTeam.name);
  const [logo, setLogo] = useState<string | null>(initialTeam.logo);
  const [logoPreviewIsImage, setLogoPreviewIsImage] = useState(() => {
    const l = initialTeam.logo;
    if (!l) return false;
    if (l.startsWith("data:image")) return true;
    if (l.startsWith("https://")) return true;
    return false;
  });
  const [logoUploading, setLogoUploading] = useState(false);
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
  const [cropState, setCropState] = useState<{ clientId: string; imageSrc: string } | null>(null);
  const [removePlayerClientId, setRemovePlayerClientId] = useState<string | null>(null);
  const [pendingMenuTab, setPendingMenuTab] = useState<ManagerTab | null>(null);

  const hasUnsavedChanges = useMemo(
    () => hasPlayerUnsavedChanges(playerForms, initialTeam.sportType),
    [playerForms, initialTeam.sportType],
  );

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const onSelectMenu = useCallback(
    (tab: ManagerTab) => {
      if (activeMenu === "PLAYER" && tab !== "PLAYER" && hasUnsavedChanges) {
        setPendingMenuTab(tab);
        return;
      }
      selectSection(tab);
    },
    [activeMenu, hasUnsavedChanges, selectSection],
  );

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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
      setTeamIsError(true);
      setTeamMessage("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 필요합니다.");
      return;
    }

    setLogoUploading(true);
    setTeamIsError(false);
    setTeamMessage("");

    try {
      const signRes = await fetch("/api/team/logo-signed-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: file.type || undefined,
          fileName: file.name,
        }),
      });
      const signData = (await signRes.json()) as {
        bucket?: string;
        path?: string;
        token?: string;
        publicUrl?: string;
        message?: string;
      };

      if (!signRes.ok) {
        setTeamIsError(true);
        setTeamMessage(signData.message ?? "업로드 준비에 실패했습니다.");
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { error: uploadError } = await supabase.storage
        .from(signData.bucket!)
        .uploadToSignedUrl(signData.path!, signData.token!, file, {
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        setTeamIsError(true);
        setTeamMessage("파일 업로드에 실패했습니다.");
        return;
      }

      setLogo(signData.publicUrl!);
      setLogoPreviewIsImage(file.type.startsWith("image/"));
    } catch {
      setTeamIsError(true);
      setTeamMessage("파일 업로드 중 오류가 발생했습니다.");
    } finally {
      setLogoUploading(false);
    }
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
      const patchBody: Record<string, unknown> = {
        name: name.trim(),
        color,
      };
      if (logo === null || logo === "") {
        patchBody.logo = null;
      } else if (logo.startsWith("data:")) {
        // 레거시 base64는 서버가 거부하므로 전송하지 않음(이름·색만 갱신)
      } else {
        patchBody.logo = logo;
      }

      const res = await fetch(`/api/team/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
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
    setPlayerForms((prev) => [makePlayerFormItem(), ...prev]);
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

    setCropState({ clientId, imageSrc: dataUrl });
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
      type SaveTask = {
        type: "deactivate" | "create" | "update" | "skip";
        item: PlayerFormItem;
        promise?: Promise<Response>;
      };

      const tasks: SaveTask[] = playerForms.map((item) => {
        const name = item.name.trim();
        const position = initialTeam.sportType === "SOCCER" ? item.position : [];

        if (item.removed) {
          if (item.playerId) {
            return {
              type: "deactivate",
              item,
              promise: fetch(`/api/player/${item.playerId}/deactivate`, { method: "PUT" }),
            };
          }
          return { type: "deactivate", item };
        }

        if (!item.playerId) {
          return {
            type: "create",
            item,
            promise: fetch("/api/player/create", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ teamId, name, photo: item.photo, style: item.style, position }),
            }),
          };
        }

        const original = item.original;
        const isChanged =
          !original ||
          original.name !== name ||
          original.photo !== item.photo ||
          original.style !== item.style ||
          !samePositions(original.position, position);

        if (!isChanged) {
          return { type: "skip", item };
        }

        return {
          type: "update",
          item,
          promise: fetch(`/api/player/${item.playerId}/update`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, photo: item.photo, style: item.style, position }),
          }),
        };
      });

      const results = await Promise.allSettled(
        tasks.map(async (task) => {
          if (!task.promise) return { task, data: null };
          const res = await task.promise;
          const data = await res.json();
          if (!res.ok) throw new Error(data.message ?? "저장에 실패했습니다.");
          return { task, data };
        }),
      );

      const errors: string[] = [];
      const nextPlayerForms: PlayerFormItem[] = [];
      let savedCount = 0;

      for (const result of results) {
        if (result.status === "rejected") {
          errors.push(result.reason instanceof Error ? result.reason.message : "저장에 실패했습니다.");
          continue;
        }
        const { task, data } = result.value;
        if (task.type === "deactivate") continue;
        if (task.type === "create" || task.type === "update") {
          savedCount += 1;
        }
        if (task.type === "skip") {
          nextPlayerForms.push({
            ...task.item,
            name: task.item.name.trim(),
            position: initialTeam.sportType === "SOCCER" ? task.item.position : [],
            errorMessage: "",
          });
        } else if (task.type === "create" || task.type === "update") {
          const player = (data as { player?: Player })?.player;
          if (player) {
            nextPlayerForms.push(makePlayerFormItem(player));
          }
        }
      }

      if (errors.length > 0) {
        setPlayerForms(sortPlayerFormsNewest(nextPlayerForms));
        setPlayerIsError(true);
        setPlayerMessage(errors[0]);
      } else {
        setPlayerForms(sortPlayerFormsNewest(nextPlayerForms));
        setPlayerIsError(false);
        setPlayerMessage(`${savedCount}명의 선수 정보가 저장되었습니다`);
      }
      router.refresh();
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
              <div className="relative mb-2 h-28 w-28">
                {logo && logoPreviewIsImage ? (
                  <button
                    type="button"
                    onClick={() => !logoUploading && fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="block disabled:opacity-60"
                    aria-label="팀 로고 업로드"
                  >
                    <TeamLogo src={logo} alt="업로드된 팀 로고 미리보기" className="h-28 w-28" rounded="xl" />
                  </button>
                ) : logo ? (
                  <button
                    type="button"
                    onClick={() => !logoUploading && fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="flex h-28 w-28 items-center justify-center rounded-xl bg-zinc-200 px-2 text-center text-xs font-medium text-zinc-700 disabled:opacity-60"
                    aria-label="팀 로고 파일 교체"
                  >
                    파일 업로드됨
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => !logoUploading && fileInputRef.current?.click()}
                    disabled={logoUploading}
                    className="flex h-28 w-28 items-center justify-center rounded-xl bg-zinc-200 text-sm text-zinc-600 disabled:opacity-60"
                    aria-label="팀 로고 업로드"
                  >
                    팀 로고
                  </button>
                )}
                {logoUploading ? (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/45 text-center text-xs font-semibold text-white"
                    aria-live="polite"
                  >
                    업로드 중...
                  </div>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                disabled={logoUploading}
                onChange={(e) => {
                  void onLogoFileChange(e.target.files?.[0]);
                  e.target.value = "";
                }}
                className="block w-full text-sm text-zinc-700 disabled:opacity-60"
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

            <button
              type="submit"
              disabled={logoUploading}
              className="h-11 w-full rounded-full bg-zinc-900 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
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
                aria-label="선수관리 안내"
                onClick={() => setShowPlayerInfoModal(true)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-xs font-semibold text-zinc-600 hover:bg-zinc-100"
              >
                ?
              </button>
            </div>
            <button
              type="button"
              onClick={onAddPlayerContainer}
              className="rounded-full border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              선수 추가
            </button>
          </div>

          <div className="mb-4">
            <button
              type="button"
              onClick={() => void onSavePlayers()}
              disabled={!hasUnsavedChanges || playerSubmitting}
              className={
                hasUnsavedChanges
                  ? "h-10 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                  : "h-10 cursor-not-allowed rounded-full bg-zinc-200 px-4 text-sm font-semibold text-zinc-400"
              }
            >
              {playerSubmitting ? "저장 중..." : "저장하기"}
            </button>
            {playerMessage ? (
              <p className={`mt-2 text-sm ${playerIsError ? "text-red-600" : "text-emerald-600"}`}>{playerMessage}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {playerForms.map((item) => {
              if (item.removed) return null;
              const showNewBadge = isPlayerFormNew(item);
              const showModifiedBadge = !showNewBadge && isPlayerFormModified(item, initialTeam.sportType);
              return (
                <div
                  key={item.clientId}
                  className={`relative rounded-xl border p-4 ${getPlayerCardClass(item, initialTeam.sportType)}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">{item.playerId ? "기존 선수" : "새 선수"}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      {showNewBadge ? (
                        <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          NEW
                        </span>
                      ) : null}
                      {showModifiedBadge ? (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                          변경됨
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setRemovePlayerClientId(item.clientId)}
                        className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                        aria-label="선수 삭제"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">선수 사진</label>
                      <div className="flex items-start gap-2">
                        <label
                          htmlFor={`player-photo-${item.clientId}`}
                          className="block shrink-0 cursor-pointer"
                        >
                          {item.photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.photo} alt="선수 사진 미리보기" className="h-36 w-28 rounded-lg object-cover" />
                          ) : (
                            <div className="flex h-36 w-28 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-500">
                              No Photo
                            </div>
                          )}
                        </label>
                        {item.photo ? (
                          <button
                            type="button"
                            onClick={() => onChangePlayerField(item.clientId, { photo: null })}
                            className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100"
                          >
                            사진 제거
                          </button>
                        ) : null}
                      </div>
                      <input
                        id={`player-photo-${item.clientId}`}
                        type="file"
                        accept="image/*"
                        onChange={(e) => void onPlayerPhotoFileChange(item.clientId, e.target.files?.[0])}
                        className="hidden"
                      />
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
      return (
        <TournamentManagerTab
          teamId={teamId}
          sportType={initialTeam.sportType}
          players={initialPlayers.map((player) => ({ id: player.id, name: player.name }))}
        />
      );
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
        className="mb-4 rounded-full border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
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
                  onClick={() => onSelectMenu(menu.key)}
                  className={`rounded-full px-3 py-2 text-left text-sm font-medium transition ${
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

      <ConfirmModal
        open={removePlayerClientId !== null}
        title="선수 삭제"
        message="정말 이 선수를 삭제하시겠습니까?"
        confirmLabel="삭제"
        onConfirm={() => {
          if (removePlayerClientId) {
            onRemovePlayerContainer(removePlayerClientId);
          }
          setRemovePlayerClientId(null);
        }}
        onCancel={() => setRemovePlayerClientId(null)}
      />

      <ConfirmModal
        open={pendingMenuTab !== null}
        title="저장하지 않은 변경사항"
        message="저장하지 않은 변경사항이 있습니다. 이동하시겠습니까?"
        confirmLabel="이동"
        cancelLabel="취소"
        confirmVariant="primary"
        onConfirm={() => {
          if (pendingMenuTab) {
            setPlayerForms(resetPlayerFormsToOriginal(playerForms));
            setPlayerMessage("");
            setPlayerIsError(false);
            selectSection(pendingMenuTab);
            setPendingMenuTab(null);
          }
        }}
        onCancel={() => setPendingMenuTab(null)}
      />

      {cropState ? (
        <PlayerPhotoCropModal
          imageSrc={cropState.imageSrc}
          onConfirm={(croppedDataUrl) => {
            onChangePlayerField(cropState.clientId, { photo: croppedDataUrl });
            setCropState(null);
            setPlayerIsError(false);
            setPlayerMessage("");
          }}
          onCancel={() => setCropState(null)}
        />
      ) : null}
    </main>
  );
}

export function TeamManagerContent(props: TeamManagerContentProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8">
          <p className="text-sm text-zinc-500">불러오는 중...</p>
        </main>
      }
    >
      <TeamManagerContentInner {...props} />
    </Suspense>
  );
}
