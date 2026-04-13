"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { calculateTeamNameUnits } from "@/lib/team";

type Team = {
  id: string;
  name: string;
  sportType: "FUTSAL" | "SOCCER";
  logo: string | null;
  color: string | null;
  accessCode: string;
  operator: string;
  admins: string[];
  players: string[];
  createdAt: string;
};

function getProgressColor(units: number) {
  if (units >= 30) return "bg-red-500";
  if (units >= 25) return "bg-yellow-500";
  return "bg-blue-500";
}

function getSportTypeLabel(type: Team["sportType"]) {
  return type === "FUTSAL" ? "풋살 팀" : "축구 팀";
}

export function TeamDashboard({ userEmail, userName }: { userEmail: string; userName?: string | null }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinPending, setJoinPending] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      const res = await fetch("/api/team/my-teams", { cache: "no-store" });
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = (await res.json()) as { teams: Team[] };
      setTeams(data.teams ?? []);
      setLoading(false);
    };

    void fetchTeams();
  }, []);

  const onJoinTeam = async (e: FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinPending(true);
    setJoinMessage("");
    const res = await fetch("/api/team/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessCode: joinCode.trim().toUpperCase() }),
    });
    const data = (await res.json()) as { team?: Team; message?: string; reason?: string };
    if (!res.ok) {
      setJoinMessage(data.message ?? "팀 참가에 실패했습니다.");
      setJoinPending(false);
      return;
    }
    if (data.team) {
      setTeams((prev) => [data.team as Team, ...prev]);
      setJoinCode("");
      setJoinMessage("팀에 참가했습니다.");
    }
    setJoinPending(false);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">내 팀 대시보드</h1>
          <p className="text-sm text-zinc-600">
            {userName ?? "사용자"} ({userEmail})
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          로그아웃
        </button>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-800">운영자 코드로 팀 참가</h2>
        <form onSubmit={onJoinTeam} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
            placeholder="6자리 코드 입력"
            className="h-11 rounded-lg border border-zinc-300 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-500"
          />
          <button
            type="submit"
            disabled={joinPending}
            className="h-11 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {joinPending ? "참가 중..." : "팀 참가"}
          </button>
        </form>
        {joinMessage ? <p className="mt-2 text-sm text-zinc-700">{joinMessage}</p> : null}
      </section>

      <section>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100"
          >
            <span className="text-3xl leading-none">+</span>
            <span className="mt-2 text-sm font-semibold">Create New Team</span>
          </button>

          {loading ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
              팀 목록 불러오는 중...
            </div>
          ) : (
            teams.map((team) => (
              <Link key={team.id} href={`/team/${team.id}`} className="block">
                <article className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {team.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={team.logo} alt={`${team.name} 로고`} className="h-12 w-12 rounded-full object-cover" />
                      ) : (
                        <div
                          className="h-12 w-12 rounded-full"
                          style={{ backgroundColor: team.color ?? "#d4d4d8" }}
                        />
                      )}
                      <div>
                        <h3 className="font-semibold text-zinc-900">{team.name}</h3>
                        <p className="text-xs text-zinc-500">{getSportTypeLabel(team.sportType)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-zinc-700">
                    <p>선수 수: {team.players.length}</p>
                    <p>생성 연도: {new Date(team.createdAt).getFullYear()}</p>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">운영자 코드: {team.accessCode}</p>
                </article>
              </Link>
            ))
          )}
        </div>
      </section>

      {showCreateModal ? (
        <CreateTeamModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(team) => {
            setTeams((prev) => [team, ...prev]);
            setShowCreateModal(false);
          }}
        />
      ) : null}
    </main>
  );
}

function CreateTeamModal({ onClose, onCreated }: { onClose: () => void; onCreated: (team: Team) => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [teamName, setTeamName] = useState("");
  const [sportType, setSportType] = useState<"" | "FUTSAL" | "SOCCER">("");
  const [logo, setLogo] = useState<string | null>(null);
  const [color, setColor] = useState("#2563eb");
  const [errorMessage, setErrorMessage] = useState("");
  const [nameLimitMessage, setNameLimitMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const units = useMemo(() => calculateTeamNameUnits(teamName), [teamName]);
  const progress = Math.min((units / 30) * 100, 100);

  const onFileChange = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMessage("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    const reader = new FileReader();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
      reader.readAsDataURL(file);
    });
    setLogo(dataUrl);
    setErrorMessage("");
  };

  const onTeamNameChange = (nextName: string) => {
    const nextUnits = calculateTeamNameUnits(nextName);
    if (nextUnits <= 30) {
      setTeamName(nextName);
      setNameLimitMessage("");
      return;
    }
    setNameLimitMessage("팀명이 가득 찼어요! 더 이상 입력할 수 없습니다.");
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (units < 2) {
      setErrorMessage("팀 이름은 최소 2 Unit 이상이어야 합니다.");
      return;
    }
    if (units > 30) {
      setErrorMessage("팀 이름은 30 Unit을 넘길 수 없습니다.");
      return;
    }
    if (!sportType) {
      setErrorMessage("팀 유형을 선택해주세요.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    const res = await fetch("/api/team/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: teamName.trim(),
        sportType,
        logo,
        color,
      }),
    });
    const data = (await res.json()) as { team?: Team; message?: string };
    if (!res.ok) {
      setErrorMessage(data.message ?? "팀 생성에 실패했습니다.");
      setSubmitting(false);
      return;
    }
    if (data.team) {
      onCreated(data.team);
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-zinc-900">팀 생성하기</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100"
            aria-label="닫기"
          >
            X
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
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
              onChange={(e) => void onFileChange(e.target.files?.[0])}
              className="block w-full text-sm text-zinc-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">팀 이름</label>
            <input
              value={teamName}
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
            <label className="mb-1 block text-sm font-medium text-zinc-700">팀 대표 색깔</label>
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-zinc-700">팀 유형</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSportType("FUTSAL")}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  sportType === "FUTSAL"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 text-zinc-700"
                }`}
              >
                풋살 팀
              </button>
              <button
                type="button"
                onClick={() => setSportType("SOCCER")}
                className={`rounded-lg border px-4 py-2 text-sm ${
                  sportType === "SOCCER"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 text-zinc-700"
                }`}
              >
                축구 팀
              </button>
            </div>
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 w-full rounded-lg bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "생성 중..." : "팀 생성하기"}
          </button>
        </form>
      </div>
    </div>
  );
}
