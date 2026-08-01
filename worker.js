const ROLE_DEFINITIONS = [
  { id: "sensor_temp", group: "센서", label: "온도 센서", symbol: "℃", description: "농장의 온도가 너무 높은지 살펴봅니다." },
  { id: "sensor_water", group: "센서", label: "물 센서", symbol: "💧", description: "흙에 물이 충분한지 살펴봅니다." },
  { id: "sensor_light", group: "센서", label: "햇빛 센서", symbol: "☀", description: "작물이 받을 햇빛이 부족한지 살펴봅니다." },
  { id: "computer", group: "컴퓨터", label: "메인 컴퓨터", symbol: "▣", description: "센서의 신호를 읽고 어떤 기기를 움직일지 결정합니다." },
  { id: "device_operator", group: "기기", label: "자동 기기 담당", symbol: "⚙", description: "컴퓨터가 고른 환풍기·스프링클러·생장 조명을 작동합니다." },
  { id: "engineer", group: "기술", label: "엔지니어", symbol: "🔧", description: "고장 신호를 받은 뒤 알맞은 방법으로 기기를 고칩니다." },
];

const APP_VERSION = "2026-08-01-2";
const SCORE_TIMER_LIMIT_MS = 30_000;
const CHALLENGE_START_SCORE = 200;
const CHALLENGE_SCORE_STEP_MS = 10_000;
const CHALLENGE_MIN_SCORE = 170;

const ISSUE_DEFINITIONS = {
  heat: {
    label: "온도 상승",
    sensorRole: "sensor_temp",
    deviceId: "device_fan",
    message: "농장 온도가 36°C까지 올라갔어요. 잎이 축 늘어지고 있습니다.",
  },
  drought: {
    label: "가뭄",
    sensorRole: "sensor_water",
    deviceId: "device_sprinkler",
    message: "토양 수분이 18%까지 떨어졌어요. 땅이 바싹 말랐습니다.",
  },
  low_light: {
    label: "햇빛 부족",
    sensorRole: "sensor_light",
    deviceId: "device_light",
    message: "빛의 양이 너무 적어요. 작물이 충분히 자라지 못하고 있습니다.",
  },
};

const DEFAULT_SIGNALS = {
  heat: "빨간 신호 3번",
  drought: "파란 신호 2번",
  low_light: "노란 신호 1번",
};

const DEVICE_DEFINITIONS = [
  { id: "device_fan", label: "환풍기" },
  { id: "device_sprinkler", label: "스프링클러" },
  { id: "device_light", label: "생장 조명" },
];
const DEVICE_IDS = new Set(DEVICE_DEFINITIONS.map((device) => device.id));

const DEVICE_SCENES = {
  device_fan: {
    position: "0% 0%",
    startLabel: "환풍기 작동 시작",
    runningTitle: "환풍기가 뜨거운 공기를 내보내고 있어요",
    readyText: "정상 온도입니다. 환풍기를 멈춰 주세요.",
    stopLabel: "환풍기 작동 중지",
  },
  device_sprinkler: {
    position: "50% 0%",
    startLabel: "스프링클러 작동 시작",
    runningTitle: "스프링클러가 물을 뿌리고 있어요",
    readyText: "흙에 물이 충분합니다. 스프링클러를 멈춰 주세요.",
    stopLabel: "스프링클러 작동 중지",
  },
  device_light: {
    position: "0% 100%",
    startLabel: "생장 조명 작동 시작",
    runningTitle: "생장 조명이 작물에 빛을 비추고 있어요",
    readyText: "작물이 받을 빛이 충분합니다. 생장 조명을 멈춰 주세요.",
    stopLabel: "생장 조명 작동 중지",
  },
};

const FAULTS = [
  {
    id: "power",
    label: "전원 오류",
    detail: "기기의 전원이 갑자기 꺼졌습니다.",
    repair: "전원 다시 연결하기",
  },
  {
    id: "connection",
    label: "연결 끊김",
    detail: "기기가 농장 네트워크와 연결되지 않습니다.",
    repair: "네트워크 다시 연결하기",
  },
  {
    id: "stopped",
    label: "기기 멈춤",
    detail: "명령을 받았지만 기기가 움직이지 않습니다.",
    repair: "기기 재시작하기",
  },
];

const TEAM_IDS = ["A", "B", "C"];
const TEAM_PRESENTATIONS = {
  A: { symbol: "🌱", color: "#287a4b" },
  B: { symbol: "☀", color: "#c97b0b" },
  C: { symbol: "💧", color: "#2275a5" },
};
const VALID_ROLES = new Set(ROLE_DEFINITIONS.map((role) => role.id));

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function newCode(prefix) {
  return prefix + "-" + crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
}

function emptyStats() {
  return {
    completed: 0,
    success: 0,
    faultsResolved: 0,
    hintsUsed: 0,
    fastestMs: null,
  };
}

function createInitialState() {
  const team = (id, name, color) => ({
    id,
    name,
    color,
    joinCode: newCode(id),
    score: 0,
    players: [],
    round: null,
    stats: emptyStats(),
  });

  return {
    auth: { salt: null, passwordHash: null, adminToken: null },
    activeCycleId: null,
    session: { id: crypto.randomUUID(), startedAt: new Date().toISOString() },
    classHistory: [],
    signals: { ...DEFAULT_SIGNALS },
    teams: {
      A: team("A", "새싹팀", "#287a4b"),
      B: team("B", "햇살팀", "#c97b0b"),
      C: team("C", "물방울팀", "#2275a5"),
    },
    updatedAt: new Date().toISOString(),
  };
}

function normalizeState(state) {
  let changed = false;
  if (!state.session) {
    state.session = {
      id: crypto.randomUUID(),
      startedAt: state.updatedAt ?? new Date().toISOString(),
    };
    changed = true;
  }
  if (!Array.isArray(state.classHistory)) {
    state.classHistory = [];
    changed = true;
  }
  const nextSignals = Object.fromEntries(
    Object.keys(ISSUE_DEFINITIONS).map((issueId) => [
      issueId,
      state.signals?.[issueId] ?? DEFAULT_SIGNALS[issueId],
    ]),
  );
  if (
    Object.keys(state.signals ?? {}).length !== Object.keys(nextSignals).length ||
    Object.keys(nextSignals).some((issueId) => state.signals?.[issueId] !== nextSignals[issueId])
  ) {
    state.signals = nextSignals;
    changed = true;
  }
  for (const id of TEAM_IDS) {
    const team = state.teams[id];
    if (!team.stats) {
      team.stats = emptyStats();
      changed = true;
    }
    const defaults = emptyStats();
    for (const key of Object.keys(defaults)) {
      if (team.stats[key] === undefined) {
        team.stats[key] = defaults[key];
        changed = true;
      }
    }
    for (const player of team.players) {
      const hadDeviceRole = player.roles.some((role) => role.startsWith("device_"));
      const nextRoles = player.roles.filter((role) => VALID_ROLES.has(role));
      if (hadDeviceRole) nextRoles.push("device_operator");
      const uniqueRoles = [...new Set(nextRoles)];
      if (uniqueRoles.join("|") !== player.roles.join("|")) {
        player.roles = uniqueRoles;
        changed = true;
      }
    }
    const validRound = team.round?.challenges?.every((challenge) =>
      challenge.kind === "environment"
        ? Boolean(ISSUE_DEFINITIONS[challenge.issueId]) &&
          (!challenge.selectedDevice || DEVICE_IDS.has(challenge.selectedDevice))
        : challenge.kind === "fault" && DEVICE_IDS.has(challenge.targetDevice),
    );
    if (team.round && !validRound) {
      team.round = null;
      changed = true;
    }
  }
  return changed;
}

function currentChallenge(team) {
  return team.round?.challenges[team.round.challengeIndex] ?? null;
}

function normalizeDevicePhase(challenge) {
  if (challenge?.kind !== "environment" || challenge.phase !== "device_running") {
    return false;
  }
  challenge.phase = "device";
  challenge.deviceStartedAt ??= new Date().toISOString();
  return true;
}

function challengeRole(challenge) {
  if (!challenge || challenge.phase === "result") return null;
  if (challenge.kind === "environment" && challenge.phase === "sensor") {
    return ISSUE_DEFINITIONS[challenge.issueId]?.sensorRole ?? null;
  }
  if (challenge.kind === "environment" && challenge.phase === "computer") {
    return "computer";
  }
  if (
    challenge.kind === "environment" &&
    (challenge.phase === "device" || challenge.phase === "device_running")
  ) {
    return "device_operator";
  }
  if (challenge.kind === "fault" && challenge.phase === "fault_alert") {
    return "device_operator";
  }
  if (challenge.kind === "fault" && challenge.phase === "repair") {
    return "engineer";
  }
  return null;
}

function roleLabel(roleId) {
  return ROLE_DEFINITIONS.find((role) => role.id === roleId)?.label ?? roleId;
}

function missionCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 1;
}

function teamReadiness(team) {
  const assigned = new Set(team.players.flatMap((player) => player.roles));
  const missingRoles = ROLE_DEFINITIONS.filter((role) => !assigned.has(role.id)).map(
    (role) => role.label,
  );
  const unassignedPlayers = team.players.filter((player) => !player.roles.length).length;
  return {
    ready: team.players.length > 0 && missingRoles.length === 0 && unassignedPlayers === 0,
    playerCount: team.players.length,
    assignedPlayerCount: team.players.length - unassignedPlayers,
    unassignedPlayers,
    missingRoles,
  };
}

function recommendRoles(team) {
  if (!team.players.length) throw new Error("역할을 추천하려면 참가자가 먼저 필요합니다.");
  for (const player of team.players) player.roles = [];
  const bundles =
    team.players.length === 5
      ? [
          ["sensor_temp"],
          ["sensor_water"],
          ["sensor_light"],
          ["computer", "engineer"],
          ["device_operator"],
        ]
      : [
          ["sensor_temp"],
          ["sensor_water"],
          ["sensor_light"],
          ["computer"],
          ["device_operator"],
          ["engineer"],
        ];
  bundles.forEach((bundle, index) => {
    team.players[index % team.players.length].roles.push(...bundle);
  });
  for (let index = bundles.length; index < team.players.length; index += 1) {
    const role = ROLE_DEFINITIONS[(index - bundles.length) % ROLE_DEFINITIONS.length];
    team.players[index].roles.push(role.id);
  }
  for (const player of team.players) player.roles = [...new Set(player.roles)];
}

function initializeChallenge(challenge) {
  challenge.startedAt = new Date().toISOString();
  challenge.hintUsed = false;
  return challenge;
}

function makeRound(
  team,
  requestedCount,
  cycleId = crypto.randomUUID(),
  options = {},
) {
  const count = missionCount(requestedCount);
  const practice = Boolean(options.practice);
  const assigned = new Set(team.players.flatMap((player) => player.roles));
  const availableIssues = Object.keys(ISSUE_DEFINITIONS).filter((issueId) => {
    const issue = ISSUE_DEFINITIONS[issueId];
    return (
      assigned.has("computer") &&
      assigned.has(issue.sensorRole) &&
      assigned.has("device_operator")
    );
  });
  const availableDevices = assigned.has("device_operator")
    ? DEVICE_DEFINITIONS.map((device) => device.id)
    : [];
  const canEnvironment = availableIssues.length > 0;
  const canFault = assigned.has("engineer") && availableDevices.length > 0;

  if (practice) {
    if (["sensor_temp", "computer", "device_operator"].some((role) => !assigned.has(role))) {
      throw new Error("연습에는 온도 센서·메인 컴퓨터·자동 기기 담당 역할이 필요합니다.");
    }
  } else if (!canEnvironment && !canFault) {
    throw new Error("센서-컴퓨터-기기 또는 기기-엔지니어 역할을 먼저 배정해 주세요.");
  } else if (!canEnvironment || !canFault) {
    throw new Error("미션에는 센서·컴퓨터·기기·엔지니어 역할이 모두 필요합니다.");
  }

  const environment = (issueId = randomItem(availableIssues)) => ({
    id: crypto.randomUUID(),
    kind: "environment",
    issueId,
    phase: "sensor",
  });
  const fault = () => ({
    id: crypto.randomUUID(),
    kind: "fault",
    faultId: randomItem(FAULTS).id,
    targetDevice: randomItem(availableDevices),
    phase: "fault_alert",
  });

  const faultFirst = Math.random() < 0.5;
  const challenges = practice
    ? [environment("heat")]
    : Array.from({ length: count }, (_, index) =>
        (index + (faultFirst ? 1 : 0)) % 2 === 0 ? environment() : fault(),
      );
  initializeChallenge(challenges[0]);

  return {
    id: crypto.randomUUID(),
    cycleId,
    status: "playing",
    challengeIndex: 0,
    challenges,
    practice,
    completedCount: 0,
    startedAt: new Date().toISOString(),
    message: "",
  };
}

function challengeScore(round, challenge, success) {
  const elapsedMs = Math.max(
    0,
    Date.now() - new Date(challenge.startedAt ?? round.startedAt).getTime(),
  );
  if (!success || round.practice) {
    return {
      points: 0,
      elapsedMs,
      breakdown: { base: 0, time: 0, noHint: 0, fault: 0, streak: 0 },
    };
  }
  const points = Math.max(
    CHALLENGE_MIN_SCORE,
    CHALLENGE_START_SCORE -
      Math.floor(elapsedMs / CHALLENGE_SCORE_STEP_MS) * 10,
  );
  const breakdown = {
    base: points,
    time: 0,
    noHint: 0,
    fault: 0,
    streak: 0,
  };
  return {
    points,
    elapsedMs,
    breakdown,
  };
}

function hintAvailable(round, challenge) {
  const startedAt = new Date(challenge.startedAt ?? round.startedAt).getTime();
  return Number.isFinite(startedAt) && Date.now() - startedAt >= SCORE_TIMER_LIMIT_MS;
}

function completeChallenge(team, success) {
  const challenge = currentChallenge(team);
  if (!team.round || !challenge) return;
  const score = challengeScore(team.round, challenge, success);
  challenge.success = success;
  challenge.points = score.points;
  challenge.elapsedMs = score.elapsedMs;
  challenge.pointBreakdown = score.breakdown;
  challenge.phase = "result";
  challenge.completedAt = new Date().toISOString();
  team.round.completedCount += 1;
  team.round.message = success
    ? team.round.practice
      ? "연습 문제를 해결했어요!"
      : `문제를 해결하고 ${score.points}점을 확보했어요!`
    : "이번 문제는 해결하지 못했어요.";
  if (!team.round.practice) {
    team.stats.completed += 1;
    if (challenge.hintUsed) team.stats.hintsUsed += 1;
    if (success) {
      team.stats.success += 1;
      if (challenge.kind === "fault") team.stats.faultsResolved += 1;
      team.stats.fastestMs =
        team.stats.fastestMs === null
          ? score.elapsedMs
          : Math.min(team.stats.fastestMs, score.elapsedMs);
    }
  }
}

function roundSummary(round) {
  const successful = round.challenges.filter((challenge) => challenge.success);
  const elapsedValues = successful
    .map((challenge) => challenge.elapsedMs)
    .filter(Number.isFinite);
  const fastest = successful
    .filter((challenge) => Number.isFinite(challenge.elapsedMs))
    .sort((a, b) => a.elapsedMs - b.elapsedMs)[0];
  return {
    solved: successful.length,
    total: round.challenges.length,
    faultsResolved: successful.filter((challenge) => challenge.kind === "fault").length,
    hintsUsed: successful.filter((challenge) => challenge.hintUsed).length,
    fastestMs: elapsedValues.length ? Math.min(...elapsedValues) : null,
    fastestLabel: fastest
      ? fastest.kind === "environment"
        ? ISSUE_DEFINITIONS[fastest.issueId]?.label ?? "환경 문제"
        : `${FAULTS.find((fault) => fault.id === fastest.faultId)?.label ?? "기술 문제"} 수리`
      : null,
  };
}

function advanceRound(team) {
  const round = team.round;
  if (!round || round.status === "complete") return;
  if (round.challengeIndex < round.challenges.length - 1) {
    round.challengeIndex += 1;
    round.message = "";
    initializeChallenge(round.challenges[round.challengeIndex]);
    return;
  }
  round.status = "complete";
  const successCount = round.challenges.filter((challenge) => challenge.success).length;
  const points = round.challenges.reduce(
    (sum, challenge) => sum + (challenge.points ?? 0),
    0,
  );
  round.points = points;
  round.summary = roundSummary(round);
  if (!round.practice) team.score += points;
  round.message = round.practice
    ? "연습 라운드를 마쳤습니다. 이제 본 게임을 시작할 수 있어요."
    : `${round.challenges.length}문제 중 ${successCount}문제 성공! ${points}점을 획득했습니다.`;
}

function restartChallenge(challenge) {
  challenge.phase = challenge.kind === "environment" ? "sensor" : "fault_alert";
  delete challenge.selectedSignal;
  delete challenge.selectedDevice;
  delete challenge.deviceStartedAt;
  delete challenge.repairChoice;
  delete challenge.success;
  delete challenge.points;
  delete challenge.elapsedMs;
  delete challenge.pointBreakdown;
  delete challenge.completedAt;
  delete challenge.skipped;
  initializeChallenge(challenge);
}

function publicTeam(team) {
  const presentation = TEAM_PRESENTATIONS[team.id] ?? {};
  return {
    ...structuredClone(team),
    color: presentation.color ?? team.color,
    symbol: presentation.symbol ?? "●",
    players: team.players.map(({ token: _token, ...player }) => ({ ...player })),
  };
}

function competitionResult(state) {
  const cycleIds = TEAM_IDS.map((id) => state.teams[id].round?.cycleId);
  const sameCycle = cycleIds[0] && cycleIds.every((id) => id === cycleIds[0]);
  const complete =
    sameCycle &&
    TEAM_IDS.every(
      (id) =>
        state.teams[id].round?.status === "complete" &&
        !state.teams[id].round?.practice,
    );
  if (!complete) return { complete: false };

  const leaderboard = TEAM_IDS.map((id) => {
    const team = state.teams[id];
    const presentation = TEAM_PRESENTATIONS[id] ?? {};
    return {
      id,
      name: team.name,
      symbol: presentation.symbol ?? "●",
      color: presentation.color ?? team.color,
      score: team.score,
      cycleScore: team.round?.points ?? 0,
      summary: team.round?.summary ?? roundSummary(team.round),
    };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  leaderboard.forEach((team, index) => {
    team.rank =
      index > 0 && team.score === leaderboard[index - 1].score
        ? leaderboard[index - 1].rank
        : index + 1;
  });
  const topScore = leaderboard[0].score;
  const winners = leaderboard.filter((team) => team.score === topScore);

  return {
    complete: true,
    leaderboard,
    winnerIds: winners.map((team) => team.id),
    message:
      winners.length === 1
        ? `${winners[0].name} 1위!`
        : `${winners.map((team) => team.name).join(", ")} 공동 1위!`,
  };
}

function classSnapshot(state) {
  const teams = TEAM_IDS.map((id) => {
    const team = state.teams[id];
    return {
      id,
      name: team.name,
      score: team.score,
      playerCount: team.players.length,
      stats: structuredClone(team.stats),
    };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const topScore = teams[0]?.score ?? 0;
  return {
    id: state.session.id,
    startedAt: state.session.startedAt,
    endedAt: new Date().toISOString(),
    winners: teams.filter((team) => team.score === topScore).map((team) => team.name),
    teams,
  };
}

function archiveCurrentClass(state) {
  const hasActivity = TEAM_IDS.some((id) => {
    const team = state.teams[id];
    return team.players.length || team.score || team.stats.completed;
  });
  if (hasActivity) {
    state.classHistory.unshift(classSnapshot(state));
    state.classHistory = state.classHistory.slice(0, 10);
  }
}

function clearTeamForNewClass(team, regenerateCode = true) {
  team.players = [];
  team.score = 0;
  team.round = null;
  team.stats = emptyStats();
  if (regenerateCode) team.joinCode = newCode(team.id);
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function errorMessage(error) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다.";
}

export default {
  async fetch(request, env) {
    try {
      const id = env.GAME_ROOM.idFromName("smart-farm-main");
      return await env.GAME_ROOM.get(id).fetch(request);
    } catch (error) {
      return json({ error: errorMessage(error) }, 500);
    }
  },
};

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async state() {
    let state = await this.ctx.storage.get("game");
    if (!state) {
      state = createInitialState();
      await this.ctx.storage.put("game", state);
    } else if (normalizeState(state)) {
      await this.ctx.storage.put("game", state);
    }
    return state;
  }

  async save(state) {
    state.updatedAt = new Date().toISOString();
    await this.ctx.storage.put("game", state);
  }

  async isAdmin(request, state) {
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    return Boolean(token && state.auth.adminToken && token === state.auth.adminToken);
  }

  findPlayer(request, state) {
    const id = request.headers.get("x-player-id");
    const token = request.headers.get("x-player-token");
    if (!id || !token) return null;
    for (const team of Object.values(state.teams)) {
      const player = team.players.find((item) => item.id === id && item.token === token);
      if (player) return { team, player };
    }
    return null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    try {
      if (request.method === "GET" && url.pathname === "/") {
        return new Response(homePage(), { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (request.method === "GET" && url.pathname === "/admin") {
        return new Response(adminPage(), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }
      if (request.method === "GET" && url.pathname.startsWith("/play/")) {
        const code = decodeURIComponent(url.pathname.slice(6));
        const state = await this.state();
        const joinTeam = Object.values(state.teams).find(
          (team) => team.joinCode.toUpperCase() === code.toUpperCase(),
        );
        const joinPresentation = joinTeam
          ? {
              name: joinTeam.name,
              color: TEAM_PRESENTATIONS[joinTeam.id]?.color ?? joinTeam.color,
              symbol: TEAM_PRESENTATIONS[joinTeam.id]?.symbol ?? "●",
            }
          : null;
        return new Response(playerPage(code, joinPresentation), {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      }
      if (url.pathname === "/api/public" && request.method === "GET") {
        return this.publicState();
      }
      if (url.pathname === "/api/admin/setup" && request.method === "POST") {
        return this.adminSetup(request);
      }
      if (url.pathname === "/api/admin/login" && request.method === "POST") {
        return this.adminLogin(request);
      }
      if (url.pathname === "/api/admin/state" && request.method === "GET") {
        return this.adminState(request);
      }
      if (url.pathname === "/api/admin/action" && request.method === "POST") {
        return this.adminAction(request);
      }
      if (url.pathname === "/api/join" && request.method === "POST") {
        return this.join(request);
      }
      if (url.pathname === "/api/player/state" && request.method === "GET") {
        return this.playerState(request);
      }
      if (url.pathname === "/api/player/action" && request.method === "POST") {
        return this.playerAction(request);
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      return json({ error: errorMessage(error) }, 400);
    }
  }

  async publicState() {
    const state = await this.state();
    return json({
      setupRequired: !state.auth.passwordHash,
      teams: TEAM_IDS.map((id) => {
        const team = state.teams[id];
        return {
          id: team.id,
          name: team.name,
          color: TEAM_PRESENTATIONS[id]?.color ?? team.color,
          symbol: TEAM_PRESENTATIONS[id]?.symbol ?? "●",
          joinCode: team.joinCode,
          score: team.score,
        };
      }),
    });
  }

  async adminSetup(request) {
    const state = await this.state();
    if (state.auth.passwordHash) return json({ error: "관리자 비밀번호가 이미 설정됐습니다." }, 409);
    const body = await request.json();
    const password = String(body.password ?? "");
    if (password.length < 6 || password.length > 80) {
      return json({ error: "비밀번호는 6자 이상으로 만들어 주세요." }, 400);
    }
    state.auth.salt = crypto.randomUUID();
    state.auth.passwordHash = await digest(state.auth.salt + ":" + password);
    state.auth.adminToken = crypto.randomUUID() + crypto.randomUUID();
    await this.save(state);
    return json({ token: state.auth.adminToken });
  }

  async adminLogin(request) {
    const state = await this.state();
    if (!state.auth.passwordHash) return json({ error: "먼저 관리자 비밀번호를 만들어 주세요." }, 409);
    const body = await request.json();
    const candidate = await digest(state.auth.salt + ":" + String(body.password ?? ""));
    if (candidate !== state.auth.passwordHash) {
      return json({ error: "관리자 비밀번호가 올바르지 않습니다." }, 401);
    }
    state.auth.adminToken = crypto.randomUUID() + crypto.randomUUID();
    await this.save(state);
    return json({ token: state.auth.adminToken });
  }

  adminPayload(state) {
    const { auth: _auth, ...game } = state;
    return {
      state: {
        ...structuredClone(game),
        teams: Object.fromEntries(
          TEAM_IDS.map((id) => [id, publicTeam(state.teams[id])]),
        ),
      },
      roles: ROLE_DEFINITIONS,
      issues: ISSUE_DEFINITIONS,
      faults: FAULTS,
      readiness: Object.fromEntries(
        TEAM_IDS.map((id) => [id, teamReadiness(state.teams[id])]),
      ),
      appVersion: APP_VERSION,
      competition: competitionResult(state),
    };
  }

  async adminState(request) {
    const state = await this.state();
    if (!(await this.isAdmin(request, state))) {
      return json({ error: "관리자 인증이 필요합니다." }, 401);
    }
    return json(this.adminPayload(state));
  }

  async adminAction(request) {
    const state = await this.state();
    if (!(await this.isAdmin(request, state))) {
      return json({ error: "관리자 인증이 필요합니다." }, 401);
    }
    const action = await request.json();

    if (action.type === "save_signals") {
      const nextSignals = {};
      for (const issueId of Object.keys(ISSUE_DEFINITIONS)) {
        const value = String(action.signals?.[issueId] ?? "").trim();
        if (!value) {
          throw new Error(`${ISSUE_DEFINITIONS[issueId].label} 신호 규칙을 입력해 주세요.`);
        }
        nextSignals[issueId] = value.slice(0, 30);
      }
      if (new Set(Object.values(nextSignals)).size !== Object.keys(nextSignals).length) {
        throw new Error("각 문제의 신호 규칙은 서로 다르게 정해 주세요.");
      }
      for (const team of Object.values(state.teams)) {
        const challenge = currentChallenge(team);
        if (
          challenge?.kind === "environment" &&
          challenge.phase !== "result" &&
          challenge.selectedSignal === state.signals[challenge.issueId]
        ) {
          challenge.selectedSignal = nextSignals[challenge.issueId];
        }
      }
      state.signals = nextSignals;
    } else if (action.type === "start_all") {
      const cycleId = crypto.randomUUID();
      state.activeCycleId = cycleId;
      const rounds = Object.fromEntries(
        TEAM_IDS.map((id) => [id, makeRound(state.teams[id], action.count, cycleId)]),
      );
      for (const id of TEAM_IDS) state.teams[id].round = rounds[id];
    } else if (action.type === "start_practice_all") {
      const cycleId = crypto.randomUUID();
      state.activeCycleId = cycleId;
      const rounds = Object.fromEntries(
        TEAM_IDS.map((id) => [
          id,
          makeRound(state.teams[id], 1, cycleId, { practice: true }),
        ]),
      );
      for (const id of TEAM_IDS) state.teams[id].round = rounds[id];
    } else if (action.type === "recommend_all_roles") {
      for (const id of TEAM_IDS) recommendRoles(state.teams[id]);
    } else if (action.type === "reset_all") {
      state.activeCycleId = null;
      for (const id of TEAM_IDS) {
        state.teams[id].score = 0;
        state.teams[id].round = null;
        state.teams[id].stats = emptyStats();
      }
    } else if (action.type === "clear_players") {
      state.activeCycleId = null;
      for (const id of TEAM_IDS) clearTeamForNewClass(state.teams[id], true);
    } else if (action.type === "new_class") {
      archiveCurrentClass(state);
      state.activeCycleId = null;
      state.session = { id: crypto.randomUUID(), startedAt: new Date().toISOString() };
      for (const id of TEAM_IDS) clearTeamForNewClass(state.teams[id], true);
    } else {
      const team = state.teams[action.teamId];
      if (!team) throw new Error("팀을 찾을 수 없습니다.");

      if (action.type === "assign_roles") {
        const player = team.players.find((item) => item.id === action.playerId);
        if (!player) throw new Error("참가자를 찾을 수 없습니다.");
        player.roles = [...new Set((action.roles ?? []).filter((role) => VALID_ROLES.has(role)))];
      } else if (action.type === "recommend_roles") {
        recommendRoles(team);
      } else if (action.type === "start_round") {
        if (!state.activeCycleId || competitionResult(state).complete) {
          state.activeCycleId = crypto.randomUUID();
        }
        team.round = makeRound(team, action.count, state.activeCycleId);
      } else if (action.type === "start_practice") {
        team.round = makeRound(team, 1, crypto.randomUUID(), { practice: true });
      } else if (action.type === "restart_challenge") {
        const challenge = currentChallenge(team);
        if (!challenge || team.round?.status !== "playing" || challenge.phase === "result") {
          throw new Error("다시 시작할 진행 중 문제가 없습니다.");
        }
        restartChallenge(challenge);
        team.round.message = "현재 문제를 처음부터 다시 시작합니다.";
      } else if (action.type === "skip_challenge") {
        const challenge = currentChallenge(team);
        if (!challenge || team.round?.status !== "playing" || challenge.phase === "result") {
          throw new Error("건너뛸 진행 중 문제가 없습니다.");
        }
        challenge.skipped = true;
        completeChallenge(team, false);
      } else if (action.type === "resume_round") {
        const challenge = currentChallenge(team);
        if (!challenge || team.round?.status !== "playing") {
          throw new Error("재개할 진행 중 미션이 없습니다.");
        }
        if (challenge.phase === "result") {
          advanceRound(team);
        } else {
          normalizeDevicePhase(challenge);
          challenge.startedAt = new Date().toISOString();
          team.round.message = "현재 단계를 유지하고 점수 타이머를 다시 시작합니다.";
        }
      } else if (action.type === "handoff_role") {
        const challenge = currentChallenge(team);
        const activeRole = challengeRole(challenge);
        const target = team.players.find((player) => player.id === action.playerId);
        if (!activeRole || !target) {
          throw new Error("넘길 현재 역할과 참가자를 확인해 주세요.");
        }
        for (const player of team.players) {
          player.roles = player.roles.filter((role) => role !== activeRole);
        }
        target.roles.push(activeRole);
      } else if (action.type === "reset_team") {
        team.score = 0;
        team.round = null;
        team.stats = emptyStats();
      } else if (action.type === "remove_player") {
        team.players = team.players.filter((player) => player.id !== action.playerId);
      } else {
        throw new Error("지원하지 않는 관리자 동작입니다.");
      }
    }

    await this.save(state);
    return json(this.adminPayload(state));
  }

  async join(request) {
    const state = await this.state();
    const body = await request.json();
    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim().slice(0, 20);
    const grade = String(body.grade ?? "").trim().slice(0, 10);
    const team = Object.values(state.teams).find(
      (item) => item.joinCode.toUpperCase() === code,
    );
    if (!team) return json({ error: "유효하지 않은 팀 QR입니다." }, 404);
    if (!name || !grade) return json({ error: "이름과 학년을 모두 입력해 주세요." }, 400);
    if (team.players.length >= 15) return json({ error: "이 팀의 참가 인원이 가득 찼습니다." }, 409);

    const player = {
      id: crypto.randomUUID(),
      token: crypto.randomUUID() + crypto.randomUUID(),
      name,
      grade,
      roles: [],
      joinedAt: new Date().toISOString(),
    };
    team.players.push(player);
    await this.save(state);
    return json({ playerId: player.id, playerToken: player.token, teamId: team.id });
  }

  playerPayload(state, team, player) {
    const teamView = publicTeam(team);
    const challenge = currentChallenge(teamView);

    if (challenge && challenge.phase !== "result") {
      challenge.activeRole = challengeRole(challenge);
      if (
        challenge.kind === "environment" &&
        challenge.issueId &&
        !player.roles.includes(ISSUE_DEFINITIONS[challenge.issueId].sensorRole)
      ) {
        delete challenge.issueId;
      }
      if (
        challenge.kind === "fault" &&
        challenge.targetDevice &&
        !player.roles.includes("device_operator") &&
        !(challenge.phase === "repair" && player.roles.includes("engineer"))
      ) {
        delete challenge.faultId;
      }
    }

    return {
      team: teamView,
      player: { ...player, token: undefined },
      signals: state.signals,
      roles: ROLE_DEFINITIONS,
      issues: ISSUE_DEFINITIONS,
      faults: FAULTS,
      devices: DEVICE_DEFINITIONS,
      deviceScenes: DEVICE_SCENES,
      scoreTimerLimitMs: SCORE_TIMER_LIMIT_MS,
      scoring: {
        startScore: CHALLENGE_START_SCORE,
        stepMs: CHALLENGE_SCORE_STEP_MS,
        minScore: CHALLENGE_MIN_SCORE,
      },
      appVersion: APP_VERSION,
      teamScores: TEAM_IDS.map((id) => {
        const scoreTeam = state.teams[id];
        const presentation = TEAM_PRESENTATIONS[id] ?? {};
        return {
          id,
          name: scoreTeam.name,
          symbol: presentation.symbol ?? "●",
          color: presentation.color ?? scoreTeam.color,
          score: scoreTeam.score,
        };
      }),
      competition: competitionResult(state),
    };
  }

  async playerState(request) {
    const state = await this.state();
    const found = this.findPlayer(request, state);
    if (!found) return json({ error: "참가 정보를 찾을 수 없습니다." }, 401);
    const challenge = currentChallenge(found.team);
    let stateChanged = normalizeDevicePhase(challenge);
    if (
      challenge?.phase === "result" &&
      challenge.completedAt &&
      Date.now() - new Date(challenge.completedAt).getTime() >= 900
    ) {
      advanceRound(found.team);
      stateChanged = true;
    }
    if (stateChanged) await this.save(state);
    return json(this.playerPayload(state, found.team, found.player));
  }

  async playerAction(request) {
    const state = await this.state();
    const found = this.findPlayer(request, state);
    if (!found) return json({ error: "참가 정보를 찾을 수 없습니다." }, 401);
    const { team, player } = found;
    const action = await request.json();
    const challenge = currentChallenge(team);
    if (!challenge || !team.round || team.round.status !== "playing") {
      return json(this.playerPayload(state, team, player));
    }
    normalizeDevicePhase(challenge);

    if (action.type === "use_hint" && player.roles.includes(challengeRole(challenge))) {
      if (!hintAvailable(team.round, challenge)) {
        return json({ error: "힌트는 30초 타이머가 끝난 뒤에 공개됩니다." }, 400);
      }
      challenge.hintUsed = true;
    } else if (
      action.type === "send_signal" &&
      challenge.kind === "environment" &&
      challenge.phase === "sensor" &&
      player.roles.includes(ISSUE_DEFINITIONS[challenge.issueId].sensorRole)
    ) {
      challenge.selectedSignal = String(action.signal ?? "").slice(0, 30);
      challenge.phase = "computer";
    } else if (
      action.type === "computer_decision" &&
      challenge.kind === "environment" &&
      challenge.phase === "computer" &&
      player.roles.includes("computer")
    ) {
      const selectedDevice = String(action.deviceId ?? "");
      if (!DEVICE_IDS.has(selectedDevice)) {
        return json({ error: "사용할 수 있는 기기를 선택해 주세요." }, 400);
      }
      challenge.selectedDevice = selectedDevice;
      challenge.phase = "device";
    } else if (
      action.type === "activate_device" &&
      challenge.kind === "environment" &&
      challenge.phase === "device" &&
      challenge.selectedDevice &&
      player.roles.includes("device_operator")
    ) {
      if (challenge.deviceStartedAt) {
        const issue = ISSUE_DEFINITIONS[challenge.issueId];
        completeChallenge(
          team,
          challenge.selectedSignal === state.signals[challenge.issueId] &&
            challenge.selectedDevice === issue.deviceId,
        );
      } else {
        challenge.deviceStartedAt = new Date().toISOString();
      }
    } else if (
      action.type === "stop_device" &&
      challenge.kind === "environment" &&
      challenge.phase === "device" &&
      challenge.deviceStartedAt &&
      challenge.selectedDevice &&
      player.roles.includes("device_operator")
    ) {
      const issue = ISSUE_DEFINITIONS[challenge.issueId];
      completeChallenge(
        team,
        challenge.selectedSignal === state.signals[challenge.issueId] &&
          challenge.selectedDevice === issue.deviceId,
      );
    } else if (
      action.type === "report_fault" &&
      challenge.kind === "fault" &&
      challenge.phase === "fault_alert" &&
      challenge.targetDevice &&
      player.roles.includes("device_operator")
    ) {
      challenge.phase = "repair";
    } else if (
      action.type === "repair" &&
      challenge.kind === "fault" &&
      challenge.phase === "repair" &&
      player.roles.includes("engineer")
    ) {
      challenge.repairChoice = String(action.repairChoice ?? "");
      const fault = FAULTS.find((item) => item.id === challenge.faultId);
      completeChallenge(team, Boolean(fault && fault.repair === challenge.repairChoice));
    } else {
      return json({ error: "지금은 이 역할의 차례가 아닙니다." }, 409);
    }

    await this.save(state);
    return json(this.playerPayload(state, team, player));
  }
}

const STYLES = `
:root{color-scheme:light;--ink:#17231b;--muted:#66736b;--line:#d8e2db;--panel:#fff;--green:#287a4b;--green2:#e8f4ec;--red:#b83b3b;--amber:#bd7400}
*{box-sizing:border-box}body{margin:0;background:#f3f7f4;color:var(--ink);font-family:Arial,"Noto Sans KR",sans-serif;letter-spacing:0}
button,input,select{font:inherit}button{min-height:46px;border:0;border-radius:7px;padding:10px 15px;background:var(--green);color:#fff;font-weight:700;cursor:pointer}
button:hover{filter:brightness(.95)}button:disabled{opacity:.45;cursor:not-allowed}.secondary{background:#e7eee9;color:#26352b}.danger{background:#a83b3b}.amber{background:#b46c00}
a{color:inherit}.shell{width:min(1180px,100%);margin:0 auto;padding:24px}.topbar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:22px}
.brand{display:flex;align-items:center;gap:12px}.logo{display:grid;place-items:center;width:44px;height:44px;border-radius:7px;background:#247247;color:#fff;font-size:24px}
h1,h2,h3,p{margin-top:0}h1{font-size:clamp(24px,4vw,38px);margin-bottom:7px}h2{font-size:22px}h3{font-size:17px}.muted{color:var(--muted)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:20px}.grid{display:grid;gap:16px}.grid3{grid-template-columns:repeat(3,minmax(0,1fr))}
.hero{min-height:70vh;display:grid;place-items:center}.hero-inner{width:min(680px,100%);text-align:center}.hero-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:22px}
.field{display:grid;gap:7px;text-align:left;margin-bottom:14px}.field label{font-size:13px;font-weight:700;color:#405047}.field input,.field select{width:100%;min-height:46px;border:1px solid #bdc9c1;border-radius:7px;padding:10px;background:#fff}
.auth{width:min(440px,100%);margin:8vh auto}.join-team{border-top:7px solid var(--team)}.join-team h1{color:var(--team)}.join-team button[type=submit]{background:var(--team)}.notice{padding:12px 14px;border-radius:7px;background:#eef4f0;color:#365141;margin-bottom:14px}.error{background:#fdecec;color:#8f2929}
.scorebar{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.score{border-top:5px solid var(--team);background:#fff;padding:14px;border-radius:7px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);border-left:1px solid var(--line)}
.score strong{display:block;font-size:24px;margin-top:4px}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.team{border-top:6px solid var(--team)}.team-meta{display:flex;gap:15px;flex-wrap:wrap;color:#56635b}.qr-wrap{display:flex;gap:14px;align-items:center}.qr{width:122px;height:122px;background:#fff}.qr img,.qr canvas{display:block;width:122px;height:122px}
.player-row{border-top:1px solid var(--line);padding:14px 0}.player-row:first-child{border-top:0}.player-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
.role-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.role-check{display:flex;align-items:center;gap:5px;background:#edf3ef;border-radius:6px;padding:8px 9px;font-size:13px}.role-check input{width:17px;height:17px}
.signals{grid-template-columns:repeat(5,minmax(0,1fr))}.signal-item label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}.signal-item input{width:100%;min-height:42px;border:1px solid #bdc9c1;border-radius:6px;padding:8px}
.count-control{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#405047}.count-control input{width:68px;min-height:46px;border:1px solid #bdc9c1;border-radius:7px;padding:8px;text-align:center;background:#fff}
.readiness-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:14px 0 18px}.readiness-item{border-left:6px solid var(--ready-color);background:#f3f7f4;padding:13px;border-radius:6px}.readiness-item strong{display:block;margin-bottom:4px}.readiness-item p{margin:0;font-size:13px}.ready{color:#246842}.not-ready{color:#9a4e1a}.admin-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;padding-top:14px;border-top:1px solid var(--line)}.emergency-panel{margin-top:16px;padding:14px;background:#fff8df;border-left:6px solid #d19219;border-radius:6px}.emergency-panel h3{margin-bottom:8px}.handoff{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px}.handoff select{min-height:46px;border:1px solid #bdc9c1;border-radius:7px;padding:8px;background:#fff}.history-list{display:grid;gap:9px}.history-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line)}.history-row:last-child{border-bottom:0}.history-scores{font-size:13px;color:var(--muted);margin-top:4px}
.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 9px;background:#e9f0eb;color:#33473a;font-size:13px;font-weight:700}.pills{display:flex;gap:7px;flex-wrap:wrap}
.mission{min-height:340px;display:grid;align-content:center;text-align:center}.mission .icon{font-size:54px;margin-bottom:14px}.mission h2{font-size:28px}.choices{display:grid;gap:10px;margin-top:18px}.choices button{width:100%;min-height:54px}.device-visual{width:min(520px,100%);aspect-ratio:3/2;margin:0 auto 16px;border:1px solid var(--line);border-radius:8px;background-image:url("/assets/device-scenes.png");background-size:300% 200%;background-repeat:no-repeat;background-color:#edf4ef}.device-status{margin:14px 0 0;padding:14px;border-left:6px solid var(--team);border-radius:6px;background:#eef6f0;text-align:left}.device-status strong{display:block;font-size:19px;margin-bottom:4px}.device-status p{margin:0;color:#365141}
.status-row{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:14px}.phase{color:#496156;font-size:13px;font-weight:700;text-transform:uppercase}
.round-progress{display:flex;justify-content:center;gap:7px;margin-bottom:18px}.dot{width:11px;height:11px;border-radius:50%;background:#cbd6ce}.dot.on{background:#287a4b}.dot.done{background:#e0a127}
.team-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;background:var(--team);color:#fff;padding:16px 18px;border-radius:8px;margin-bottom:14px}.team-banner-symbol{font-size:34px}.team-banner strong{display:block;font-size:22px}.team-banner span{font-size:13px}
.player-tools{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-bottom:14px}.turn-alert{width:100%;background:var(--team);color:#fff;padding:18px;text-align:center;border-radius:8px;margin-bottom:14px}.turn-alert strong{display:block;font-size:26px}.turn-alert span{display:block;margin-top:4px}.role-focus{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-left:7px solid var(--team);padding:16px;margin-bottom:14px}.role-focus.my-turn{border:3px solid var(--team);padding:14px;background:#fff}.role-focus-symbol{display:grid;place-items:center;width:54px;height:54px;flex:0 0 54px;border-radius:50%;background:var(--team);color:#fff;font-size:24px;font-weight:700}.role-focus h2{margin-bottom:4px}.role-focus p{margin-bottom:0}.next-turn{display:inline-block;margin-top:7px;font-size:13px;font-weight:700;color:var(--team)}
.role-guide{margin-bottom:16px}.role-guide h3{margin-bottom:10px}.role-guide-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.role-guide-item{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:7px;padding:12px}.role-guide-item.active{border:2px solid var(--team);padding:11px}.role-symbol{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border-radius:50%;background:#e7eee9;color:#26352b;font-weight:700}.role-guide-item strong{display:block;margin-bottom:3px}.role-guide-item p{font-size:13px;margin-bottom:0;color:var(--muted)}
.flow-track{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:14px}.flow-step{padding:10px 8px;background:#e7eee9;border-radius:6px;text-align:center;font-size:13px;font-weight:700;color:#647168}.flow-step.current{background:var(--team);color:#fff}.flow-step.done{background:#dfe8e2;color:#31513c}.mission-timer{background:#fff;border:1px solid var(--line);border-radius:7px;padding:12px 14px;margin-bottom:14px}.timer-head{display:flex;justify-content:space-between;gap:10px;font-weight:700}.timer-track{height:8px;background:#e3e9e5;border-radius:8px;overflow:hidden;margin-top:9px}.timer-fill{height:100%;width:100%;background:var(--team);transition:width .3s linear}.timer-expired .timer-fill{background:#b46c00}.timer-note{font-size:12px;color:var(--muted);margin-top:6px}.result-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.result-metric{background:#f3f7f4;padding:10px;border-radius:6px}.result-metric strong{display:block;font-size:18px}
.hint-area{margin-top:16px}.hint-box{margin-top:10px;padding:13px;border:2px solid #e0a127;border-radius:7px;background:#fff8df;color:#5b4200;font-weight:700}.signal-dialog{width:min(540px,calc(100% - 28px));border:0;border-radius:8px;padding:0;box-shadow:0 18px 50px rgba(0,0,0,.22)}.signal-dialog::backdrop{background:rgba(20,30,24,.55)}.dialog-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}.dialog-head h2{margin:0}.icon-button{display:grid;place-items:center;width:42px;height:42px;min-height:42px;padding:0;border-radius:50%;background:#e7eee9;color:#26352b;font-size:24px}.signal-rule-list{display:grid;gap:0;padding:8px 18px 18px}.signal-rule{display:flex;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid var(--line)}.signal-rule:last-child{border-bottom:0}.signal-rule strong{text-align:right;color:var(--team)}
.team-score-list{display:grid;gap:9px;padding:14px 18px 18px}.team-score-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:14px;border-left:6px solid var(--score-color);background:#f5f8f6;padding:14px;border-radius:6px}.team-score-row strong{font-size:18px}.team-score-points{font-size:24px;font-weight:700;color:#24352a}
.competition-result{background:#fff;border:2px solid #e0a127;border-radius:8px;padding:18px;margin-bottom:16px}.competition-result h2{margin-bottom:4px}.ranking{display:grid;gap:8px;margin-top:14px}.rank-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;border-left:5px solid var(--rank-color);background:#f7f9f7;padding:11px 12px;border-radius:6px}.rank-number{font-size:20px;font-weight:700}.rank-team small{display:block;color:var(--muted);margin-top:3px}.rank-score{text-align:right}.rank-score strong{display:block}.rank-score span{font-size:12px;color:var(--muted)}
.footer-note{text-align:center;color:#718078;font-size:12px;margin-top:16px}
@media(max-width:850px){.grid3,.signals,.role-guide-list,.readiness-grid{grid-template-columns:1fr}.scorebar{grid-template-columns:1fr}.shell{padding:15px}.topbar{align-items:flex-start}.section-head{align-items:flex-start;flex-direction:column}.qr-wrap{align-items:flex-start}.team{padding:16px}.result-metrics{grid-template-columns:1fr}.handoff select{width:100%}}
`;

function layout(title, body, scripts = "") {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#287a4b"><title>${title}</title><style>${STYLES}</style></head>
<body>${body}${scripts}</body></html>`;
}

function homePage() {
  return layout(
    "스마트 농장 네트워크 구조대",
    `<main class="shell hero"><section class="hero-inner">
      <div class="logo" style="margin:0 auto 18px">♧</div>
      <h1>스마트 농장 네트워크 구조대</h1>
      <p class="muted">센서에서 기기까지, 팀의 신호로 농장을 구하세요.</p>
      <div class="hero-actions"><a href="/admin"><button>관리자 시작</button></a></div>
      <div id="teams" class="grid grid3" style="margin-top:28px"></div>
      <p class="footer-note">플레이어는 선생님 화면의 팀 QR로 참가합니다.</p>
    </section></main>`,
    `<script>
fetch("/api/public").then(function(r){return r.json()}).then(function(data){
  document.getElementById("teams").innerHTML=data.teams.map(function(t){
    return '<a class="card" style="border-top:5px solid '+t.color+';text-decoration:none" href="/play/'+encodeURIComponent(t.joinCode)+'"><strong>'+t.symbol+' '+t.name+'</strong><br><span class="muted">총점 '+t.score+'점</span></a>';
  }).join("");
});
</script>`,
  );
}

function adminPage() {
  const encodedVersion = JSON.stringify(APP_VERSION);
  return layout(
    "관리자 | 스마트 농장",
    `<main class="shell">
      <header class="topbar"><div class="brand"><div class="logo">♧</div><div><strong>스마트 농장 네트워크 구조대</strong><div class="muted">관리자 운영 화면</div></div></div><a href="/">처음으로</a></header>
      <section id="auth" class="card auth">
        <h1 id="authTitle">관리자 로그인</h1>
        <p id="authHelp" class="muted">관리자 비밀번호를 입력하세요.</p>
        <form id="authForm"><div class="field"><label for="password">비밀번호</label><input id="password" type="password" minlength="6" autocomplete="current-password" required></div>
        <button id="authButton" type="submit" style="width:100%">로그인</button></form>
        <div id="authMessage" class="notice error" hidden></div>
      </section>
      <section id="dashboard" hidden>
        <div id="scores" class="scorebar"></div>
        <section id="competitionResult" class="competition-result" hidden></section>
        <section class="card" style="margin-bottom:16px">
          <div class="section-head"><div><h2>게임 운영</h2><p class="muted">준비 상태를 확인하고 연습 또는 본 게임을 시작합니다.</p></div>
          <div class="toolbar"><button class="secondary" onclick="load()">화면 새로고침</button><label class="count-control">문제 수 <input id="missionCount" type="number" min="1" max="10" value="3" inputmode="numeric"></label><button class="secondary" onclick="startPracticeAll()">전체 연습 시작</button><button onclick="startAll()">전체 본 게임 시작</button></div></div>
          <h3>팀 준비 상태</h3>
          <div id="readiness" class="readiness-grid"></div>
          <div class="toolbar"><button class="secondary" onclick="recommendAllRoles()">전체 역할 자동 추천</button></div>
          <h3 style="margin-top:20px">신호 규칙</h3>
          <div id="signals" class="grid signals"></div>
          <button id="signalSaveButton" class="secondary" style="margin-top:12px" onclick="saveSignals()">신호 규칙 저장</button>
          <div class="admin-actions"><button class="danger" onclick="resetAll()">전체 점수 초기화</button><button class="danger" onclick="clearPlayers()">참가자 정보 삭제</button><button class="danger" onclick="newClass()">새 수업 시작</button></div>
        </section>
        <div id="teams" class="grid"></div>
        <section class="card" style="margin-top:16px"><h2>최근 수업 기록</h2><div id="history" class="history-list"></div></section>
      </section>
    </main>`,
    `<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script>
var token=localStorage.getItem("farm-admin-token")||"";
var ADMIN_PAGE_VERSION=${encodedVersion};
var setupRequired=false;
var game=null;
var roles=[];
var issues={};
var competition={complete:false};
var readiness={};
var roleDrafts={};
var roleTimers={};
var roleSaving={};
var signalDrafts={};
var signalDirty=false;
var signalSaving=false;
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]})}
async function responseData(response){
  var text=await response.text();
  try{return text?JSON.parse(text):{}}
  catch(error){throw new Error("서버가 올바르지 않은 응답을 보냈습니다. 잠시 후 다시 시도해 주세요. ("+response.status+")")}
}
function api(path,options){
  options=options||{};options.headers=Object.assign({"content-type":"application/json","authorization":"Bearer "+token},options.headers||{});
  return fetch(path,options).then(async function(response){var data=await responseData(response);if(!response.ok)throw new Error(data.error||"요청 실패");return data});
}
async function boot(){
  var info=await fetch("/api/public").then(responseData);setupRequired=info.setupRequired;
  document.getElementById("authTitle").textContent=setupRequired?"관리자 비밀번호 만들기":"관리자 로그인";
  document.getElementById("authHelp").textContent=setupRequired?"처음 한 번만 사용할 관리자 비밀번호를 만들어 주세요.":"설정한 관리자 비밀번호를 입력하세요.";
  document.getElementById("authButton").textContent=setupRequired?"비밀번호 만들기":"로그인";
  if(token)load();
}
document.getElementById("authForm").addEventListener("submit",async function(event){
  event.preventDefault();var box=document.getElementById("authMessage");box.hidden=true;
  try{
    var path=setupRequired?"/api/admin/setup":"/api/admin/login";
    var result=await api(path,{method:"POST",body:JSON.stringify({password:document.getElementById("password").value})});
    token=result.token;localStorage.setItem("farm-admin-token",token);load();
  }catch(error){box.textContent=error.message;box.hidden=false}
});
async function load(){
  try{
    var data=await api("/api/admin/state");if(data.appVersion&&data.appVersion!==ADMIN_PAGE_VERSION){location.reload();return}game=data.state;roles=data.roles;issues=data.issues;competition=data.competition;readiness=data.readiness||{};
    document.getElementById("auth").hidden=true;document.getElementById("dashboard").hidden=false;render();
  }catch(error){localStorage.removeItem("farm-admin-token");token="";document.getElementById("auth").hidden=false;document.getElementById("dashboard").hidden=true}
}
function render(){
  document.getElementById("scores").innerHTML=["A","B","C"].map(function(id){var t=game.teams[id];return '<div class="score" style="--team:'+t.color+'"><span>'+esc(t.symbol)+' '+esc(t.name)+'</span><strong>'+t.score+'점</strong><span class="muted">참가 '+t.players.length+'명</span></div>'}).join("");
  var result=document.getElementById("competitionResult");result.hidden=!competition.complete;result.innerHTML=competition.complete?competitionHtml(competition):"";
  document.getElementById("readiness").innerHTML=["A","B","C"].map(function(id){var t=game.teams[id],r=readiness[id]||{ready:false,playerCount:0,assignedPlayerCount:0,missingRoles:[]},missing=r.missingRoles.length?"부족: "+r.missingRoles.join(", "):"필요한 역할이 모두 있습니다.";return '<div class="readiness-item" style="--ready-color:'+(r.ready?"#287a4b":"#c97b0b")+'"><strong class="'+(r.ready?"ready":"not-ready")+'">'+esc(t.symbol)+" "+esc(t.name)+" · "+(r.ready?"준비 완료":"준비 필요")+'</strong><p>역할 배정 '+r.assignedPlayerCount+'/'+r.playerCount+'명</p><p>'+esc(missing)+'</p></div>'}).join("");
  document.getElementById("signals").innerHTML=Object.keys(issues).map(function(id){var value=Object.prototype.hasOwnProperty.call(signalDrafts,id)?signalDrafts[id]:game.signals[id];return '<div class="signal-item"><label>'+esc(issues[id].label)+'</label><input data-signal="'+id+'" value="'+esc(value)+'" oninput="editSignal(\\''+id+'\\',this.value)"></div>'}).join("");
  document.getElementById("teams").innerHTML=["A","B","C"].map(teamHtml).join("");
  document.getElementById("history").innerHTML=(game.classHistory||[]).length?(game.classHistory||[]).map(historyHtml).join(""):'<p class="muted">아직 저장된 수업 기록이 없습니다.</p>';
  ["A","B","C"].forEach(function(id){var t=game.teams[id],box=document.getElementById("qr-"+id);if(box&&window.QRCode)new QRCode(box,{text:location.origin+"/play/"+encodeURIComponent(t.joinCode),width:122,height:122,correctLevel:QRCode.CorrectLevel.M})});
}
function roleName(id){var role=roles.find(function(item){return item.id===id});return role?role.label:id}
function adminActiveRole(c){if(!c||c.phase==="result")return null;if(c.kind==="environment"&&c.phase==="sensor")return issues[c.issueId]&&issues[c.issueId].sensorRole;if(c.kind==="environment"&&c.phase==="computer")return "computer";if(c.kind==="environment"&&(c.phase==="device"||c.phase==="device_running"))return "device_operator";if(c.kind==="fault"&&c.phase==="fault_alert")return "device_operator";if(c.kind==="fault"&&c.phase==="repair")return "engineer";return null}
function formatTime(ms){if(!Number.isFinite(ms))return "-";return (ms/1000).toFixed(ms<10000?1:0)+"초"}
function historyHtml(item){var date=new Date(item.endedAt).toLocaleString("ko-KR"),scores=item.teams.map(function(team){return team.name+" "+team.score+"점"}).join(" · ");return '<div class="history-row"><div><strong>'+esc(date)+' 수업</strong><div class="history-scores">'+esc(scores)+'</div></div><div><strong>'+esc(item.winners.join(", "))+'</strong><div class="muted">1위</div></div></div>'}
function teamHtml(id){
  var t=game.teams[id],round=t.round,r=readiness[id]||{ready:false,missingRoles:[],unassignedPlayers:0},challenge=round&&round.challenges[round.challengeIndex],activeRole=adminActiveRole(challenge);
  var roundText=!round?"대기 중":(round.status==="complete"?round.message:(round.practice?"연습 ":"본 게임 ")+"미션 "+(round.challengeIndex+1)+"/"+round.challenges.length);
  var players=t.players.length?t.players.map(function(p){return '<div class="player-row"><div class="player-head"><div><strong>'+esc(p.name)+'</strong> <span class="muted">'+esc(p.grade)+'학년</span></div><button class="danger" onclick="removePlayer(\\''+id+'\\',\\''+p.id+'\\')">삭제</button></div><div class="role-list">'+roles.map(function(r){var checked=p.roles.includes(r.id)?" checked":"";return '<label class="role-check"><input type="checkbox"'+checked+' onchange="setRole(\\''+id+'\\',\\''+p.id+'\\',\\''+r.id+'\\',this.checked)"> '+esc(r.label)+'</label>'}).join("")+'</div></div>'}).join(""):'<p class="muted">아직 참가한 학생이 없습니다.</p>';
  var options=t.players.map(function(p){return '<option value="'+p.id+'">'+esc(p.name)+'</option>'}).join("");
  var emergency=round&&round.status==="playing"?'<div class="emergency-panel"><h3>긴급 진행 도구</h3><p class="muted">현재 단계: '+esc(activeRole?roleName(activeRole)+" 담당 차례":challenge&&challenge.phase==="result"?"결과 확인":"진행 확인")+'</p><div class="toolbar">'+(challenge&&challenge.phase!=="result"?'<button class="secondary" onclick="restartChallenge(\\''+id+'\\')">현재 문제 다시 시작</button><button class="danger" onclick="skipChallenge(\\''+id+'\\')">이 단계 건너뛰기</button>':'')+'<button class="secondary" onclick="resumeRound(\\''+id+'\\')">멈춘 팀 진행 재개</button></div>'+(activeRole&&options?'<div class="handoff"><select id="handoff-'+id+'">'+options+'</select><button class="secondary" onclick="handoffRole(\\''+id+'\\')">'+esc(roleName(activeRole))+' 역할 넘기기</button></div>':'')+'</div>':"";
  var readyLine=r.ready?"준비 완료":r.missingRoles.length?"부족한 역할: "+r.missingRoles.join(", "):"역할 배정이 필요합니다.";
  return '<section class="card team" style="--team:'+t.color+'"><div class="section-head"><div><h2>'+esc(t.symbol)+' '+esc(t.name)+'</h2><div class="team-meta"><span>'+roundText+'</span><span>총점 '+t.score+'점</span><span class="'+(r.ready?"ready":"not-ready")+'">'+esc(readyLine)+'</span></div></div><div class="toolbar"><button class="secondary" onclick="recommendTeamRoles(\\''+id+'\\')">역할 자동 추천</button><button class="secondary" onclick="startPractice(\\''+id+'\\')">연습 시작</button><button onclick="startTeam(\\''+id+'\\')">본 게임 시작</button><button class="danger" onclick="resetTeam(\\''+id+'\\')">팀 초기화</button></div></div><div class="qr-wrap"><div id="qr-'+id+'" class="qr"></div><div><strong>팀 참가 QR</strong><p class="muted">'+esc(t.joinCode)+'</p><a href="/play/'+encodeURIComponent(t.joinCode)+'" target="_blank">참가 화면 열기</a></div></div>'+emergency+'<h3 style="margin-top:20px">참가자와 역할</h3>'+players+'</section>';
}
function competitionHtml(data){return '<h2>'+esc(data.message)+'</h2><p class="muted">세 팀이 모두 미션을 마쳐 총점을 비교했습니다.</p><div class="ranking">'+data.leaderboard.map(function(t){var s=t.summary||{};return '<div class="rank-row" style="--rank-color:'+t.color+'"><div class="rank-number">'+t.rank+'위</div><div class="rank-team"><strong>'+esc(t.symbol)+' '+esc(t.name)+'</strong><small>해결 '+(s.solved||0)+'/'+(s.total||0)+' · 기술 문제 '+(s.faultsResolved||0)+' · 최고 '+esc(s.fastestLabel||"-")+" "+formatTime(s.fastestMs)+'</small></div><div class="rank-score"><strong>'+t.score+'점</strong><span>이번 +'+t.cycleScore+'점</span></div></div>'}).join("")+'</div>'}
async function act(action){try{var data=await api("/api/admin/action",{method:"POST",body:JSON.stringify(action)});game=data.state;roles=data.roles;issues=data.issues;competition=data.competition;readiness=data.readiness||{};render()}catch(error){alert(error.message)}}
function setRole(teamId,playerId,role,checked){
  var key=teamId+":"+playerId,p=game.teams[teamId].players.find(function(x){return x.id===playerId});
  var current=roleDrafts[key]||p.roles,next=current.filter(function(x){return x!==role});
  if(checked)next.push(role);
  roleDrafts[key]=next;p.roles=next;
  clearTimeout(roleTimers[key]);
  roleTimers[key]=setTimeout(function(){delete roleTimers[key];saveRoles(teamId,playerId,key)},250);
}
async function saveRoles(teamId,playerId,key){
  if(roleSaving[key])return;
  roleSaving[key]=true;var data=null;
  try{
    while(roleDrafts[key]){
      var next=roleDrafts[key];delete roleDrafts[key];
      data=await api("/api/admin/action",{method:"POST",body:JSON.stringify({type:"assign_roles",teamId:teamId,playerId:playerId,roles:next})});
    }
    if(data){game=data.state;roles=data.roles;issues=data.issues;competition=data.competition;readiness=data.readiness||{};render()}
  }catch(error){alert(error.message);load()}
  finally{delete roleSaving[key];if(roleDrafts[key])saveRoles(teamId,playerId,key)}
}
function hasPendingRoleSaves(){return Object.keys(roleDrafts).length>0||Object.keys(roleSaving).length>0}
function flushRoleSaves(){
  Object.keys(roleTimers).forEach(function(key){
    clearTimeout(roleTimers[key]);delete roleTimers[key];
    var split=key.indexOf(":");
    saveRoles(key.slice(0,split),key.slice(split+1),key);
  });
  return new Promise(function(resolve){
    function check(){if(hasPendingRoleSaves())setTimeout(check,25);else resolve()}
    check();
  });
}
function selectedCount(){return Math.min(10,Math.max(1,parseInt(document.getElementById("missionCount").value,10)||1))}
async function startTeam(teamId){await flushRoleSaves();if(!readiness[teamId].ready&&!confirm("이 팀은 아직 준비 완료가 아닙니다. 배정된 역할만으로 시작할까요?"))return;act({type:"start_round",teamId:teamId,count:selectedCount()})}
async function startAll(){await flushRoleSaves();var waiting=["A","B","C"].filter(function(id){return !readiness[id].ready});if(waiting.length&&!confirm("준비가 끝나지 않은 팀이 있습니다. 배정된 역할만으로 시작할까요?"))return;act({type:"start_all",count:selectedCount()})}
async function startPractice(teamId){await flushRoleSaves();act({type:"start_practice",teamId:teamId})}
async function startPracticeAll(){await flushRoleSaves();act({type:"start_practice_all"})}
async function recommendTeamRoles(teamId){await flushRoleSaves();if(confirm("현재 역할 배정을 지우고 인원에 맞게 다시 추천할까요?"))act({type:"recommend_roles",teamId:teamId})}
async function recommendAllRoles(){await flushRoleSaves();if(confirm("세 팀의 현재 역할 배정을 지우고 자동 추천할까요?"))act({type:"recommend_all_roles"})}
function restartChallenge(teamId){if(confirm("현재 문제를 처음 단계부터 다시 시작할까요?"))act({type:"restart_challenge",teamId:teamId})}
function skipChallenge(teamId){if(confirm("현재 문제를 실패 처리하고 다음 문제로 넘어갈까요?"))act({type:"skip_challenge",teamId:teamId})}
function resumeRound(teamId){act({type:"resume_round",teamId:teamId})}
function handoffRole(teamId){var select=document.getElementById("handoff-"+teamId);if(select)act({type:"handoff_role",teamId:teamId,playerId:select.value})}
function resetTeam(teamId){if(confirm("이 팀의 점수와 현재 미션을 초기화할까요?"))act({type:"reset_team",teamId:teamId})}
function resetAll(){if(confirm("모든 팀의 점수를 초기화할까요?"))act({type:"reset_all"})}
function clearPlayers(){if(confirm("모든 참가자의 이름과 학년을 삭제할까요? QR 코드도 새로 만들어집니다."))act({type:"clear_players"})}
function newClass(){if(confirm("현재 결과를 수업 기록에 저장하고 새 수업을 시작할까요? 참가자·점수·진행 상태가 초기화됩니다."))act({type:"new_class"})}
function removePlayer(teamId,playerId){if(confirm("이 참가자를 삭제할까요?"))act({type:"remove_player",teamId:teamId,playerId:playerId})}
function editSignal(id,value){signalDrafts[id]=value;signalDirty=true;var button=document.getElementById("signalSaveButton");if(button)button.textContent="신호 규칙 저장"}
async function saveSignals(){
  if(signalSaving)return;
  var signals={},button=document.getElementById("signalSaveButton");
  Object.keys(issues).forEach(function(id){signals[id]=Object.prototype.hasOwnProperty.call(signalDrafts,id)?signalDrafts[id]:game.signals[id]});
  signalSaving=true;button.disabled=true;button.textContent="저장 중";
  try{
    var data=await api("/api/admin/action",{method:"POST",body:JSON.stringify({type:"save_signals",signals:signals})});
    Object.keys(signals).forEach(function(id){if(signalDrafts[id]===signals[id])delete signalDrafts[id]});
    signalDirty=Object.keys(signalDrafts).length>0;
    game=data.state;roles=data.roles;issues=data.issues;competition=data.competition;readiness=data.readiness||{};render();
    button.textContent=signalDirty?"신호 규칙 저장":"저장 완료";
    if(!signalDirty)setTimeout(function(){if(!signalDirty)button.textContent="신호 규칙 저장"},900);
  }catch(error){alert(error.message);button.textContent="신호 규칙 저장"}
  finally{signalSaving=false;button.disabled=false}
}
boot();
</script>`,
  );
}

function playerPage(code, team = null) {
  const encodedCode = JSON.stringify(code);
  const encodedVersion = JSON.stringify(APP_VERSION);
  const joinTitle = team?.name ? `${team.name} 참가` : "팀 참가";
  const joinColor =
    team?.color && /^#[0-9a-f]{6}$/i.test(team.color) ? team.color : "#287a4b";
  const escapedJoinTitle = joinTitle.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
  const escapedJoinSymbol = String(team?.symbol ?? "♧").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
  return layout(
    `${escapedJoinTitle} | 스마트 농장`,
    `<main id="playerShell" class="shell" style="--team:${joinColor}">
      <header class="topbar"><div class="brand"><div id="teamMark" class="logo" style="background:${joinColor}">${escapedJoinSymbol}</div><div><strong>스마트 농장 구조대</strong><div id="teamLabel" style="color:${joinColor};font-weight:700">${escapedJoinTitle}</div></div></div><div id="miniScore"></div></header>
      <section id="join" class="card auth join-team">
        <h1>${escapedJoinTitle}</h1><p class="muted">이름과 학년을 입력하면 바로 참가합니다.</p>
        <form id="joinForm"><div class="field"><label for="name">이름</label><input id="name" maxlength="20" required></div>
        <div class="field"><label for="grade">학년</label><select id="grade" required><option value="">선택</option><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option><option value="4">4학년</option><option value="5">5학년</option><option value="6">6학년</option></select></div>
        <button type="submit" style="width:100%">게임 참가</button></form><div id="joinMessage" class="notice error" hidden></div>
      </section>
      <section id="game" hidden>
        <div id="teamBanner" class="team-banner"></div>
        <div class="player-tools"><button class="secondary" onclick="openScores()">전체 팀 점수</button><button class="secondary" onclick="openSignals()">신호 규칙 확인</button></div>
        <section id="competitionResult" class="competition-result" hidden></section>
        <div id="turnAlert" class="turn-alert" hidden></div>
        <section id="currentRole" class="role-focus"></section>
        <div id="flowTrack" class="flow-track"></div>
        <section class="role-guide"><h3>내가 맡은 역할과 하는 일</h3><div id="roleGuide" class="role-guide-list"></div></section>
        <div class="status-row"><div><div class="phase" id="phase">WAITING</div><div id="roles" class="pills"></div></div></div>
        <div id="progress" class="round-progress"></div>
        <div id="missionTimer" class="mission-timer" hidden></div>
        <section id="mission" class="card mission"></section>
        <p class="footer-note">팀원의 선택과 다음 문제는 자동으로 업데이트됩니다.</p>
      </section>
      <dialog id="scoreDialog" class="signal-dialog"><div class="dialog-head"><h2>전체 팀 점수</h2><button type="button" class="icon-button" aria-label="닫기" onclick="closeScores()">×</button></div><div id="teamScores" class="team-score-list"></div></dialog>
      <dialog id="signalDialog" class="signal-dialog"><div class="dialog-head"><h2>우리 팀 신호 규칙</h2><button type="button" class="icon-button" aria-label="닫기" onclick="closeSignals()">×</button></div><div id="signalRules" class="signal-rule-list"></div></dialog>
    </main>`,
    `<script>
var TEAM_CODE=${encodedCode};
var PAGE_VERSION=${encodedVersion};
var KEY="farm-player-"+TEAM_CODE;
var auth=JSON.parse(localStorage.getItem(KEY)||"null");
var last=null;
var hintVisible=false;
var resultTimer=null;
var missionTimerInterval=null;
var renderedChallengeId=null;
var hintReportedChallengeId=null;
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]})}
async function responseData(response){
  var text=await response.text();
  try{return text?JSON.parse(text):{}}
  catch(error){throw new Error("서버가 올바르지 않은 응답을 보냈습니다. 잠시 후 다시 시도해 주세요. ("+response.status+")")}
}
function headers(){return {"content-type":"application/json","x-player-id":auth.playerId,"x-player-token":auth.playerToken}}
async function load(){
  if(!auth)return;
  try{var response=await fetch("/api/player/state",{headers:headers(),cache:"no-store"});var data=await responseData(response);if(!response.ok)throw new Error(data.error);if(data.appVersion&&data.appVersion!==PAGE_VERSION){location.reload();return}last=data;showGame(data)}
  catch(error){localStorage.removeItem(KEY);auth=null;document.getElementById("join").hidden=false;document.getElementById("game").hidden=true}
}
document.getElementById("joinForm").addEventListener("submit",async function(event){
  event.preventDefault();var box=document.getElementById("joinMessage");box.hidden=true;
  try{var response=await fetch("/api/join",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code:TEAM_CODE,name:document.getElementById("name").value,grade:document.getElementById("grade").value})});var data=await responseData(response);if(!response.ok)throw new Error(data.error);auth=data;localStorage.setItem(KEY,JSON.stringify(auth));document.getElementById("join").hidden=true;load()}
  catch(error){box.textContent=error.message;box.hidden=false}
});
async function act(action){
  try{var response=await fetch("/api/player/action",{method:"POST",headers:headers(),body:JSON.stringify(action)});var data=await responseData(response);if(!response.ok)throw new Error(data.error);last=data;showGame(data)}
  catch(error){alert(error.message)}
}
function roleInfo(id,data){return data.roles.find(function(item){return item.id===id})||{id:id,label:id,symbol:"●",description:"맡은 역할의 순서를 기다립니다."}}
function roleLabel(id,data){return roleInfo(id,data).label}
function deviceInfo(id,data){return data.devices.find(function(item){return item.id===id})||{id:id,label:id}}
function deviceLabel(id,data){return deviceInfo(id,data).label}
function deviceScene(id,data){return data.deviceScenes[id]||{position:"100% 100%",startLabel:"기기 작동 시작",runningTitle:"기기가 농장 상태를 조절하고 있어요",readyText:"농장 상태가 정상입니다. 기기를 멈춰 주세요.",stopLabel:"기기 작동 중지"}}
function activeRoleId(data,c){
  if(!c||c.phase==="result")return null;
  if(c.activeRole)return c.activeRole;
  if(c.kind==="environment"&&c.phase==="sensor"&&c.issueId)return data.issues[c.issueId].sensorRole;
  if(c.kind==="environment"&&c.phase==="computer")return "computer";
  if(c.kind==="environment"&&(c.phase==="device"||c.phase==="device_running"))return "device_operator";
  if(c.kind==="fault"&&c.phase==="fault_alert")return "device_operator";
  if(c.kind==="fault"&&c.phase==="repair")return "engineer";
  return null;
}
function openSignals(){var dialog=document.getElementById("signalDialog");if(dialog.showModal)dialog.showModal();else dialog.setAttribute("open","")}
function closeSignals(){var dialog=document.getElementById("signalDialog");if(dialog.close)dialog.close();else dialog.removeAttribute("open")}
function openScores(){var dialog=document.getElementById("scoreDialog");if(dialog.showModal)dialog.showModal();else dialog.setAttribute("open","")}
function closeScores(){var dialog=document.getElementById("scoreDialog");if(dialog.close)dialog.close();else dialog.removeAttribute("open")}
function markHintUsed(){if(!auth)return;fetch("/api/player/action",{method:"POST",headers:headers(),body:JSON.stringify({type:"use_hint"})}).catch(function(){})}
function revealHint(c){if(!c||hintVisible)return;hintVisible=true;var box=document.getElementById("hintBox"),button=document.getElementById("hintToggle");if(box)box.hidden=false;if(button)button.hidden=true;if(hintReportedChallengeId!==c.id){hintReportedChallengeId=c.id;markHintUsed()}}
function hint(text){return '<div class="hint-area"><button id="hintToggle" class="secondary" disabled'+(hintVisible?' hidden':'')+'>힌트는 30초 후 공개됩니다</button><div id="hintBox" class="hint-box"'+(hintVisible?"":" hidden")+'>'+esc(text)+'</div></div>'}
function scheduleResultAdvance(c){if(resultTimer){clearTimeout(resultTimer);resultTimer=null}if(!c||c.phase!=="result"||!c.completedAt)return;var elapsed=Date.now()-new Date(c.completedAt).getTime(),delay=Math.max(50,950-elapsed);resultTimer=setTimeout(function(){resultTimer=null;if(auth&&!document.hidden)load()},delay)}
function nextRoleId(data,c){if(!c||c.phase==="result")return null;if(c.kind==="environment"&&c.phase==="sensor")return "computer";if(c.kind==="environment"&&c.phase==="computer")return "device_operator";if(c.kind==="fault"&&c.phase==="fault_alert")return "engineer";return null}
function nextRoleText(data,c){var id=nextRoleId(data,c);return id?"다음: "+roleLabel(id,data):"이 역할이 마지막 단계입니다."}
function flowHtml(data,c){if(!c||c.phase==="result")return "";var steps,current;if(c.kind==="environment"){var sensorLabel=c.phase==="sensor"&&c.activeRole?roleLabel(c.activeRole,data):c.issueId?roleLabel(data.issues[c.issueId].sensorRole,data):"센서 감지";steps=[sensorLabel,"메인 컴퓨터",c.selectedDevice?deviceLabel(c.selectedDevice,data):"자동 기기 담당"];current=c.phase==="sensor"?0:c.phase==="computer"?1:2}else{steps=[c.targetDevice?deviceLabel(c.targetDevice,data):"자동 기기 담당","엔지니어"];current=c.phase==="fault_alert"?0:1}return steps.map(function(label,index){return '<div class="flow-step '+(index<current?"done":index===current?"current":"")+'">'+(index+1)+". "+esc(label)+'</div>'}).join("")}
function formatTime(ms){if(!Number.isFinite(ms))return "-";return (ms/1000).toFixed(ms<10000?1:0)+"초"}
function renderMissionTimer(data,c,isMyTurn){
  if(missionTimerInterval){clearInterval(missionTimerInterval);missionTimerInterval=null}
  var box=document.getElementById("missionTimer"),round=data.team.round;
  if(!round||!c||c.phase==="result"||round.status==="complete"){box.hidden=true;return}
  box.hidden=false;
  function update(){
    var limit=data.scoreTimerLimitMs||30000,elapsed=Math.max(0,Date.now()-new Date(c.startedAt||round.startedAt).getTime()),remaining=Math.max(0,limit-elapsed),percent=Math.max(0,Math.min(100,remaining/limit*100));
    if(round.practice){box.className="mission-timer"+(remaining<=0?" timer-expired":"");box.innerHTML='<div class="timer-head"><span>연습 라운드</span><strong>'+(remaining>0?"힌트까지 "+Math.ceil(remaining/1000)+"초":"힌트 공개")+'</strong></div><div class="timer-track"><div class="timer-fill" style="width:'+percent+'%"></div></div><div class="timer-note">'+(remaining>0?"버튼과 역할 순서를 익혀 보세요.":"힌트가 자동으로 열렸습니다.")+'</div>'}
    else{var scoring=data.scoring||{startScore:200,stepMs:10000,minScore:170},potential=Math.max(scoring.minScore,scoring.startScore-Math.floor(elapsed/scoring.stepMs)*10);box.className="mission-timer"+(remaining<=0?" timer-expired":"");box.innerHTML='<div class="timer-head"><span>'+(remaining>0?"점수 타이머 "+Math.ceil(remaining/1000)+"초":"점수 타이머 종료")+'</span><strong>현재 '+potential+'점</strong></div><div class="timer-track"><div class="timer-fill" style="width:'+percent+'%"></div></div><div class="timer-note">'+(remaining>0?"200점에서 시작해 10초마다 10점씩 줄어듭니다.":"170점이 유지되며 힌트가 자동으로 열립니다.")+'</div>'}
    if(remaining<=0&&isMyTurn)revealHint(c)
  }
  update();missionTimerInterval=setInterval(update,1000);
}
function showGame(data){
  var team=data.team,player=data.player,round=team.round,challenge=round&&round.challenges[round.challengeIndex];
  var challengeId=challenge&&challenge.id;
  if(challengeId!==renderedChallengeId){renderedChallengeId=challengeId;hintVisible=false}
  var activeId=activeRoleId(data,challenge),isMyTurn=activeId&&player.roles.includes(activeId);
  document.getElementById("join").hidden=true;document.getElementById("game").hidden=false;
  document.getElementById("playerShell").style.setProperty("--team",team.color);
  document.getElementById("teamMark").style.background=team.color;
  document.getElementById("teamMark").textContent=team.symbol;
  document.getElementById("teamLabel").textContent=team.name+" · "+player.name;
  document.getElementById("miniScore").innerHTML="<strong>"+team.score+"점</strong>";
  document.getElementById("teamBanner").innerHTML='<div><strong>'+esc(team.symbol)+' '+esc(team.name)+'</strong><span>'+esc(player.name)+' 구조대원</span></div><div class="team-banner-symbol">'+esc(team.symbol)+'</div>';
  var result=document.getElementById("competitionResult");result.hidden=!data.competition.complete;result.innerHTML=data.competition.complete?competitionHtml(data.competition):"";
  var turnAlert=document.getElementById("turnAlert");turnAlert.hidden=!isMyTurn;turnAlert.innerHTML=isMyTurn?'<strong>지금 내 차례!</strong><span>'+esc(roleLabel(activeId,data))+' 역할을 수행하세요.</span>':"";
  document.getElementById("roles").innerHTML=player.roles.length?player.roles.map(function(id){return '<span class="pill">'+esc(roleLabel(id,data))+'</span>'}).join(""):'<span class="pill">역할 배정 대기</span>';
  var currentRole=document.getElementById("currentRole");currentRole.className="role-focus"+(isMyTurn?" my-turn":"");
  if(isMyTurn){
    var active=roleInfo(activeId,data);
    currentRole.innerHTML='<div class="role-focus-symbol">'+esc(active.symbol)+'</div><div><p class="phase">지금은 내가 움직일 차례</p><h2>'+esc(active.label)+'</h2><p>'+esc(active.description)+'</p><span class="next-turn">'+esc(nextRoleText(data,challenge))+'</span></div>';
  }else{
    var waitingTitle=!player.roles.length?"역할 배정을 기다려요":!round?"미션 시작을 기다려요":round.status==="complete"?"미션을 마쳤어요":activeId?roleLabel(activeId,data)+" 담당 차례예요":"팀원의 선택을 기다려요";
    var waitingText=!player.roles.length?"선생님이 역할을 배정하면 역할 이름과 하는 일이 표시됩니다.":activeId?"현재 "+roleLabel(activeId,data)+" 담당자가 진행하고 있습니다.":"내 역할 차례가 오면 이곳에 크게 표시됩니다.";
    currentRole.innerHTML='<div class="role-focus-symbol">…</div><div><p class="phase">현재 수행 역할</p><h2>'+esc(waitingTitle)+'</h2><p>'+esc(waitingText)+'</p>'+(challenge&&challenge.phase!=="result"?'<span class="next-turn">'+esc(nextRoleText(data,challenge))+'</span>':"")+'</div>';
  }
  document.getElementById("flowTrack").innerHTML=flowHtml(data,challenge);
  document.getElementById("roleGuide").innerHTML=player.roles.length?player.roles.map(function(id){var role=roleInfo(id,data),activeClass=id===activeId?" active":"";return '<div class="role-guide-item'+activeClass+'"><div class="role-symbol">'+esc(role.symbol)+'</div><div><strong>'+esc(role.label)+'</strong><p>'+esc(role.description)+'</p></div></div>'}).join(""):'<p class="muted">아직 배정된 역할이 없습니다.</p>';
  document.getElementById("teamScores").innerHTML=data.teamScores.map(function(item){return '<div class="team-score-row" style="--score-color:'+item.color+'"><strong>'+esc(item.symbol)+' '+esc(item.name)+'</strong><span class="team-score-points">'+item.score+'점</span></div>'}).join("");
  document.getElementById("signalRules").innerHTML=Object.keys(data.issues).map(function(id){return '<div class="signal-rule"><span>'+esc(data.issues[id].label)+'</span><strong>'+esc(data.signals[id])+'</strong></div>'}).join("");
  document.getElementById("progress").innerHTML=round?round.challenges.map(function(item,index){var cls=index<round.challengeIndex?"dot done":index===round.challengeIndex?"dot on":"dot";return '<span class="'+cls+'"></span>'}).join(""):"";
  document.getElementById("phase").textContent=round?(round.practice?"연습 ":"본 게임 ")+"미션 "+(round.challengeIndex+1)+"/"+round.challenges.length:"WAITING";
  document.getElementById("mission").innerHTML=missionHtml(data,challenge);
  renderMissionTimer(data,challenge,isMyTurn);
  scheduleResultAdvance(challenge);
}
function competitionHtml(data){return '<h2>'+esc(data.message)+'</h2><p class="muted">세 팀의 총점 비교 결과입니다.</p><div class="ranking">'+data.leaderboard.map(function(t){var s=t.summary||{};return '<div class="rank-row" style="--rank-color:'+t.color+'"><div class="rank-number">'+t.rank+'위</div><div class="rank-team"><strong>'+esc(t.symbol)+' '+esc(t.name)+'</strong><small>해결 '+(s.solved||0)+'/'+(s.total||0)+' · 기술 문제 '+(s.faultsResolved||0)+' · 최고 '+esc(s.fastestLabel||"-")+" "+formatTime(s.fastestMs)+'</small></div><div class="rank-score"><strong>'+t.score+'점</strong><span>이번 +'+t.cycleScore+'점</span></div></div>'}).join("")+'</div>'}
function wait(icon,title,text){return '<div><div class="icon">'+icon+'</div><h2>'+esc(title)+'</h2><p class="muted">'+esc(text)+'</p></div>'}
function roundResultHtml(round){var s=round.summary||{solved:0,total:round.challenges.length,faultsResolved:0,hintsUsed:0,fastestMs:null,fastestLabel:null},allSuccess=s.solved===s.total;return '<div><div class="icon">'+(round.practice?"🎓":allSuccess?"🏆":"🌱")+'</div><h2>'+esc(round.message)+'</h2>'+(round.practice?'<p class="muted">점수에는 포함되지 않았습니다.</p>':'<div class="result-metrics"><div class="result-metric"><span>해결</span><strong>'+s.solved+'/'+s.total+'</strong></div><div class="result-metric"><span>기술 문제</span><strong>'+s.faultsResolved+'개</strong></div><div class="result-metric"><span>가장 빠른 해결</span><strong>'+esc(s.fastestLabel||"-")+' '+formatTime(s.fastestMs)+'</strong></div></div>')+'</div>'}
function missionHtml(data,c){
  var team=data.team,player=data.player,round=team.round;
  if(!player.roles.length)return wait("⌛","역할을 기다리는 중","선생님이 역할을 배정하면 여기에 표시됩니다.");
  if(!round)return wait("🌿","농장 시스템 대기 중","모든 역할을 확인하고 미션 시작을 기다리세요.");
  if(round.status==="complete")return roundResultHtml(round);
  if(!c)return wait("⌛","문제를 불러오는 중","잠시 기다려 주세요.");
  if(c.phase==="result")return '<div><div class="icon">'+(c.success?"✅":"❌")+'</div><h2>'+(c.success?"문제 해결 성공!":"문제 해결 실패")+'</h2><p class="muted">'+esc(round.message||"결과를 확인하고 다음 문제를 준비하세요.")+'</p>'+(round.practice?"":'<strong>'+(c.points||0)+'점</strong>')+'</div>';
  if(c.kind==="environment"&&c.phase==="sensor"){
    if(c.issueId){var issue=data.issues[c.issueId];return '<div><div class="icon">📡</div><h2>'+esc(issue.label)+' 감지</h2><p>'+esc(issue.message)+'</p><div class="choices">'+Object.keys(data.signals).map(function(id){return '<button onclick="act({type:\\'send_signal\\',signal:\\''+esc(data.signals[id])+'\\'})">'+esc(data.signals[id])+'</button>'}).join("")+'</div>'+hint("지금 문제는 "+issue.label+"이에요. "+data.signals[c.issueId]+" 버튼을 누르세요.")+'</div>'}
    return wait("🙈","센서가 확인 중","문제 상황은 담당 센서에게만 보입니다.");
  }
  if(c.kind==="environment"&&c.phase==="computer"){
    if(player.roles.includes("computer")){var signalIssueId=Object.keys(data.signals).find(function(id){return data.signals[id]===c.selectedSignal}),signalIssue=signalIssueId&&data.issues[signalIssueId],computerHint=signalIssue?"이 신호는 "+signalIssue.label+"을 뜻해요. "+deviceLabel(signalIssue.deviceId,data)+"를 선택하세요.":"신호 규칙 창에서 같은 신호를 찾아 알맞은 기기를 선택하세요.";return '<div><div class="icon">🧠</div><h2>신호를 해석하세요</h2><p>전달된 신호: <strong>'+esc(c.selectedSignal)+'</strong></p><div class="choices">'+data.devices.map(function(device){return '<button onclick="act({type:\\'computer_decision\\',deviceId:\\''+device.id+'\\'})">'+esc(device.label)+' 선택</button>'}).join("")+'</div>'+hint(computerHint)+'</div>'}
    return wait("🔄","컴퓨터가 판단 중","전달된 신호를 바탕으로 작동할 기기를 고르고 있습니다.");
  }
  if(c.kind==="environment"&&c.phase==="device"){
    if(player.roles.includes("device_operator")){var scene=deviceScene(c.selectedDevice,data);if(c.deviceStartedAt)return '<div><div class="device-visual" role="img" aria-label="'+esc(deviceLabel(c.selectedDevice,data))+' 작동 결과" style="background-position:'+scene.position+'"></div><h2>'+esc(scene.runningTitle)+'</h2><div class="device-status"><strong>농장 상태 확인</strong><p>'+esc(scene.readyText)+'</p></div><div class="choices"><button class="amber" onclick="act({type:\\'stop_device\\'})">'+esc(scene.stopLabel)+'</button></div>'+hint(scene.readyText+" 아래의 "+scene.stopLabel+" 버튼을 누르면 완료돼요.")+'</div>';return '<div><div class="device-visual" role="img" aria-label="'+esc(deviceLabel(c.selectedDevice,data))+' 작동 전과 후" style="background-position:'+scene.position+'"></div><h2>'+esc(deviceLabel(c.selectedDevice,data))+'를 작동하세요</h2><p>컴퓨터의 명령을 확인하고 기기를 시작하세요.</p><div class="choices"><button onclick="act({type:\\'activate_device\\'})">'+esc(scene.startLabel)+'</button></div>'+hint(scene.startLabel+" 버튼을 누르세요. 농장 상태가 바뀌면 기기를 멈추는 단계가 나와요.")+'</div>'}
    return wait("⚙️","기기 작동 준비 중","자동 기기 담당자가 "+deviceLabel(c.selectedDevice,data)+"를 시작해야 합니다.");
  }
  if(c.kind==="fault"&&c.phase==="fault_alert"){
    if(c.faultId&&player.roles.includes("device_operator")){var fault=data.faults.find(function(f){return f.id===c.faultId});return '<div><div class="icon">⚠️</div><h2>'+esc(deviceLabel(c.targetDevice,data))+" "+esc(fault.label)+'</h2><p>'+esc(fault.detail)+'</p><p><strong>자동 기기 담당</strong>이 엔지니어에게 알려야 합니다.</p><div class="choices"><button class="danger" onclick="act({type:\\'report_fault\\'})">고장 신호 보내기</button></div>'+hint("기기가 고장 났어요. 고장 신호 보내기 버튼을 눌러 엔지니어에게 알려 주세요.")+'</div>'}
    return wait("⚙️","기기 점검 중","고장이 난 기기가 엔지니어에게 신호를 보내야 합니다.");
  }
  if(c.kind==="fault"&&c.phase==="repair"){
    if(player.roles.includes("engineer")){var fault2=data.faults.find(function(f){return f.id===c.faultId});return '<div><div class="icon">🛠️</div><h2>'+esc(fault2.label)+' 수리</h2><p>'+esc(fault2.detail)+'</p><div class="choices">'+data.faults.map(function(f){return '<button onclick="act({type:\\'repair\\',repairChoice:\\''+esc(f.repair)+'\\'})">'+esc(f.repair)+'</button>'}).join("")+'</div>'+hint(fault2.repair+" 버튼을 누르면 고칠 수 있어요.")+'</div>'}
    return wait("🛠️","엔지니어 수리 중","고장 신호를 받고 올바른 수리 방법을 찾고 있습니다.");
  }
  return wait("⌛","다른 역할의 차례","팀원의 선택을 기다려 주세요.");
}
if(auth)load();setInterval(function(){if(auth&&!document.hidden)load()},2000);
</script>`,
  );
}
