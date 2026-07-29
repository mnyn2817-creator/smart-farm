const ROLE_DEFINITIONS = [
  { id: "sensor_temp", group: "센서", label: "온도 센서", symbol: "℃", description: "농장의 온도가 너무 높거나 낮은지 살펴봅니다." },
  { id: "sensor_water", group: "센서", label: "물 센서", symbol: "💧", description: "흙에 물이 충분한지 살펴봅니다." },
  { id: "sensor_light", group: "센서", label: "햇빛 센서", symbol: "☀", description: "햇빛이 부족하거나 너무 강한지 살펴봅니다." },
  { id: "sensor_pest", group: "센서", label: "병충해 센서", symbol: "!", description: "작물에 해충이나 병의 흔적이 있는지 살펴봅니다." },
  { id: "computer", group: "컴퓨터", label: "메인 컴퓨터", symbol: "▣", description: "센서의 신호를 읽고 어떤 기기를 움직일지 결정합니다." },
  { id: "device_fan", group: "기기", label: "환풍기", symbol: "↻", description: "더운 공기를 밖으로 보내 농장의 온도를 낮춥니다." },
  { id: "device_sprinkler", group: "기기", label: "스프링클러", symbol: "≋", description: "물이 부족한 작물과 흙에 물을 뿌립니다." },
  { id: "device_shade", group: "기기", label: "햇빛 차단막", symbol: "▰", description: "너무 강한 햇빛을 가려 작물을 보호합니다." },
  { id: "device_light", group: "기기", label: "생장 조명", symbol: "✦", description: "햇빛이 부족할 때 작물에 필요한 빛을 비춥니다." },
  { id: "device_pest", group: "기기", label: "방제기", symbol: "◎", description: "병충해가 퍼지지 않도록 작물을 보호합니다." },
  { id: "engineer", group: "기술", label: "엔지니어", symbol: "🔧", description: "고장 신호를 받은 뒤 알맞은 방법으로 기기를 고칩니다." },
];

const ISSUE_DEFINITIONS = {
  heat: {
    label: "온도 상승",
    sensorRole: "sensor_temp",
    deviceRole: "device_fan",
    message: "농장 온도가 36°C까지 올라갔어요. 잎이 축 늘어지고 있습니다.",
  },
  drought: {
    label: "가뭄",
    sensorRole: "sensor_water",
    deviceRole: "device_sprinkler",
    message: "토양 수분이 18%까지 떨어졌어요. 땅이 바싹 말랐습니다.",
  },
  low_light: {
    label: "햇빛 부족",
    sensorRole: "sensor_light",
    deviceRole: "device_light",
    message: "빛의 양이 너무 적어요. 작물이 충분히 자라지 못하고 있습니다.",
  },
  high_light: {
    label: "햇빛 과다",
    sensorRole: "sensor_light",
    deviceRole: "device_shade",
    message: "강한 햇빛이 오래 비치고 있어요. 잎이 타기 시작했습니다.",
  },
  pest: {
    label: "병충해",
    sensorRole: "sensor_pest",
    deviceRole: "device_pest",
    message: "잎에서 해충 흔적이 발견됐어요. 빠르게 번질 수 있습니다.",
  },
};

const DEFAULT_SIGNALS = {
  heat: "빨간 신호 3번",
  drought: "파란 신호 2번",
  low_light: "노란 신호 1번",
  high_light: "노란 신호 2번",
  pest: "보라 신호 3번",
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
const DEVICE_ROLES = ROLE_DEFINITIONS.filter((role) => role.group === "기기");

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function newCode(prefix) {
  return prefix + "-" + crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
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
  });

  return {
    auth: { salt: null, passwordHash: null, adminToken: null },
    activeCycleId: null,
    signals: { ...DEFAULT_SIGNALS },
    teams: {
      A: team("A", "새싹팀", "#287a4b"),
      B: team("B", "햇살팀", "#c97b0b"),
      C: team("C", "물방울팀", "#2275a5"),
    },
    updatedAt: new Date().toISOString(),
  };
}

function currentChallenge(team) {
  return team.round?.challenges[team.round.challengeIndex] ?? null;
}

function roleLabel(roleId) {
  return ROLE_DEFINITIONS.find((role) => role.id === roleId)?.label ?? roleId;
}

function missionCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(10, Math.max(1, parsed)) : 1;
}

function makeRound(team, requestedCount, cycleId = crypto.randomUUID()) {
  const count = missionCount(requestedCount);
  const assigned = new Set(team.players.flatMap((player) => player.roles));
  const availableIssues = Object.keys(ISSUE_DEFINITIONS).filter((issueId) => {
    const issue = ISSUE_DEFINITIONS[issueId];
    return (
      assigned.has("computer") &&
      assigned.has(issue.sensorRole) &&
      assigned.has(issue.deviceRole)
    );
  });
  const availableDevices = DEVICE_ROLES.filter((role) => assigned.has(role.id)).map(
    (role) => role.id,
  );
  const canEnvironment = availableIssues.length > 0;
  const canFault = assigned.has("engineer") && availableDevices.length > 0;

  if (!canEnvironment && !canFault) {
    throw new Error("센서-컴퓨터-기기 또는 기기-엔지니어 역할을 먼저 배정해 주세요.");
  }
  if (!canEnvironment || !canFault) {
    throw new Error("미션에는 센서·컴퓨터·기기·엔지니어 역할이 모두 필요합니다.");
  }

  const environment = () => ({
    id: crypto.randomUUID(),
    kind: "environment",
    issueId: randomItem(availableIssues),
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
  const challenges = Array.from({ length: count }, (_, index) =>
    (index + (faultFirst ? 1 : 0)) % 2 === 0 ? environment() : fault(),
  );

  return {
    id: crypto.randomUUID(),
    cycleId,
    status: "playing",
    challengeIndex: 0,
    challenges,
    completedCount: 0,
    startedAt: new Date().toISOString(),
    message: "",
  };
}

function completeChallenge(team, success) {
  const challenge = currentChallenge(team);
  if (!team.round || !challenge) return;
  challenge.success = success;
  challenge.phase = "result";
  challenge.completedAt = new Date().toISOString();
  team.round.completedCount += 1;
  team.round.message = success ? "문제를 해결했어요!" : "이번 문제는 해결하지 못했어요.";
}

function advanceRound(team) {
  const round = team.round;
  if (!round || round.status === "complete") return;
  if (round.challengeIndex < round.challenges.length - 1) {
    round.challengeIndex += 1;
    round.message = "";
    return;
  }
  round.status = "complete";
  const successCount = round.challenges.filter((challenge) => challenge.success).length;
  const points = successCount * 100;
  round.points = points;
  team.score += points;
  round.message = `${round.challenges.length}문제 중 ${successCount}문제 성공! ${points}점을 획득했습니다.`;
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
    sameCycle && TEAM_IDS.every((id) => state.teams[id].round?.status === "complete");
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
        return new Response(adminPage(), { headers: { "content-type": "text/html; charset=utf-8" } });
      }
      if (request.method === "GET" && url.pathname.startsWith("/play/")) {
        const code = decodeURIComponent(url.pathname.slice(6));
        return new Response(playerPage(code), {
          headers: { "content-type": "text/html; charset=utf-8" },
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
      for (const issueId of Object.keys(ISSUE_DEFINITIONS)) {
        const value = String(action.signals?.[issueId] ?? "").trim();
        if (value) state.signals[issueId] = value.slice(0, 30);
      }
    } else if (action.type === "start_all") {
      const cycleId = crypto.randomUUID();
      state.activeCycleId = cycleId;
      const rounds = Object.fromEntries(
        TEAM_IDS.map((id) => [id, makeRound(state.teams[id], action.count, cycleId)]),
      );
      for (const id of TEAM_IDS) state.teams[id].round = rounds[id];
    } else if (action.type === "reset_all") {
      state.activeCycleId = null;
      for (const id of TEAM_IDS) {
        state.teams[id].score = 0;
        state.teams[id].round = null;
      }
    } else {
      const team = state.teams[action.teamId];
      if (!team) throw new Error("팀을 찾을 수 없습니다.");

      if (action.type === "assign_roles") {
        const player = team.players.find((item) => item.id === action.playerId);
        if (!player) throw new Error("참가자를 찾을 수 없습니다.");
        player.roles = [...new Set((action.roles ?? []).filter((role) => VALID_ROLES.has(role)))];
      } else if (action.type === "start_round") {
        if (!state.activeCycleId || competitionResult(state).complete) {
          state.activeCycleId = crypto.randomUUID();
        }
        team.round = makeRound(team, action.count, state.activeCycleId);
      } else if (action.type === "reset_team") {
        team.score = 0;
        team.round = null;
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
        !player.roles.includes(challenge.targetDevice) &&
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
      competition: competitionResult(state),
    };
  }

  async playerState(request) {
    const state = await this.state();
    const found = this.findPlayer(request, state);
    if (!found) return json({ error: "참가 정보를 찾을 수 없습니다." }, 401);
    const challenge = currentChallenge(found.team);
    if (
      challenge?.phase === "result" &&
      challenge.completedAt &&
      Date.now() - new Date(challenge.completedAt).getTime() >= 900
    ) {
      advanceRound(found.team);
      await this.save(state);
    }
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

    if (
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
      challenge.selectedDevice = action.deviceRole;
      challenge.phase = "device";
    } else if (
      action.type === "activate_device" &&
      challenge.kind === "environment" &&
      challenge.phase === "device" &&
      challenge.selectedDevice &&
      player.roles.includes(challenge.selectedDevice)
    ) {
      const issue = ISSUE_DEFINITIONS[challenge.issueId];
      completeChallenge(
        team,
        challenge.selectedSignal === state.signals[challenge.issueId] &&
          challenge.selectedDevice === issue.deviceRole,
      );
    } else if (
      action.type === "report_fault" &&
      challenge.kind === "fault" &&
      challenge.phase === "fault_alert" &&
      challenge.targetDevice &&
      player.roles.includes(challenge.targetDevice)
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
.auth{width:min(440px,100%);margin:8vh auto}.notice{padding:12px 14px;border-radius:7px;background:#eef4f0;color:#365141;margin-bottom:14px}.error{background:#fdecec;color:#8f2929}
.scorebar{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}.score{border-top:5px solid var(--team);background:#fff;padding:14px;border-radius:7px;border-right:1px solid var(--line);border-bottom:1px solid var(--line);border-left:1px solid var(--line)}
.score strong{display:block;font-size:24px;margin-top:4px}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.section-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.team{border-top:6px solid var(--team)}.team-meta{display:flex;gap:15px;flex-wrap:wrap;color:#56635b}.qr-wrap{display:flex;gap:14px;align-items:center}.qr{width:122px;height:122px;background:#fff}.qr img,.qr canvas{display:block;width:122px;height:122px}
.player-row{border-top:1px solid var(--line);padding:14px 0}.player-row:first-child{border-top:0}.player-head{display:flex;justify-content:space-between;gap:10px;align-items:center}
.role-list{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.role-check{display:flex;align-items:center;gap:5px;background:#edf3ef;border-radius:6px;padding:8px 9px;font-size:13px}.role-check input{width:17px;height:17px}
.signals{grid-template-columns:repeat(5,minmax(0,1fr))}.signal-item label{display:block;font-size:13px;font-weight:700;margin-bottom:6px}.signal-item input{width:100%;min-height:42px;border:1px solid #bdc9c1;border-radius:6px;padding:8px}
.count-control{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:700;color:#405047}.count-control input{width:68px;min-height:46px;border:1px solid #bdc9c1;border-radius:7px;padding:8px;text-align:center;background:#fff}
.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 9px;background:#e9f0eb;color:#33473a;font-size:13px;font-weight:700}.pills{display:flex;gap:7px;flex-wrap:wrap}
.mission{min-height:340px;display:grid;align-content:center;text-align:center}.mission .icon{font-size:54px;margin-bottom:14px}.mission h2{font-size:28px}.choices{display:grid;gap:10px;margin-top:18px}.choices button{width:100%;min-height:54px}
.status-row{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:14px}.phase{color:#496156;font-size:13px;font-weight:700;text-transform:uppercase}
.round-progress{display:flex;justify-content:center;gap:7px;margin-bottom:18px}.dot{width:11px;height:11px;border-radius:50%;background:#cbd6ce}.dot.on{background:#287a4b}.dot.done{background:#e0a127}
.team-banner{display:flex;align-items:center;justify-content:space-between;gap:14px;background:var(--team);color:#fff;padding:16px 18px;border-radius:8px;margin-bottom:14px}.team-banner-symbol{font-size:34px}.team-banner strong{display:block;font-size:22px}.team-banner span{font-size:13px}
.player-tools{display:flex;justify-content:flex-end;margin-bottom:14px}.role-focus{display:flex;align-items:center;gap:14px;background:#fff;border:1px solid var(--line);border-left:7px solid var(--team);padding:16px;margin-bottom:14px}.role-focus-symbol{display:grid;place-items:center;width:54px;height:54px;flex:0 0 54px;border-radius:50%;background:var(--team);color:#fff;font-size:24px;font-weight:700}.role-focus h2{margin-bottom:4px}.role-focus p{margin-bottom:0}
.role-guide{margin-bottom:16px}.role-guide h3{margin-bottom:10px}.role-guide-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.role-guide-item{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--line);border-radius:7px;padding:12px}.role-guide-item.active{border:2px solid var(--team);padding:11px}.role-symbol{display:grid;place-items:center;width:34px;height:34px;flex:0 0 34px;border-radius:50%;background:#e7eee9;color:#26352b;font-weight:700}.role-guide-item strong{display:block;margin-bottom:3px}.role-guide-item p{font-size:13px;margin-bottom:0;color:var(--muted)}
.hint-area{margin-top:16px}.hint-box{margin-top:10px;padding:13px;border:2px solid #e0a127;border-radius:7px;background:#fff8df;color:#5b4200;font-weight:700}.signal-dialog{width:min(540px,calc(100% - 28px));border:0;border-radius:8px;padding:0;box-shadow:0 18px 50px rgba(0,0,0,.22)}.signal-dialog::backdrop{background:rgba(20,30,24,.55)}.dialog-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line)}.dialog-head h2{margin:0}.icon-button{display:grid;place-items:center;width:42px;height:42px;min-height:42px;padding:0;border-radius:50%;background:#e7eee9;color:#26352b;font-size:24px}.signal-rule-list{display:grid;gap:0;padding:8px 18px 18px}.signal-rule{display:flex;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid var(--line)}.signal-rule:last-child{border-bottom:0}.signal-rule strong{text-align:right;color:var(--team)}
.competition-result{background:#fff;border:2px solid #e0a127;border-radius:8px;padding:18px;margin-bottom:16px}.competition-result h2{margin-bottom:4px}.ranking{display:grid;gap:8px;margin-top:14px}.rank-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;border-left:5px solid var(--rank-color);background:#f7f9f7;padding:11px 12px;border-radius:6px}.rank-number{font-size:20px;font-weight:700}.rank-score{text-align:right}.rank-score strong{display:block}.rank-score span{font-size:12px;color:var(--muted)}
.footer-note{text-align:center;color:#718078;font-size:12px;margin-top:16px}
@media(max-width:850px){.grid3,.signals,.role-guide-list{grid-template-columns:1fr}.scorebar{grid-template-columns:1fr}.shell{padding:15px}.topbar{align-items:flex-start}.section-head{align-items:flex-start;flex-direction:column}.qr-wrap{align-items:flex-start}.team{padding:16px}}
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
          <div class="section-head"><div><h2>게임 운영</h2><p class="muted">전체 팀을 동시에 시작하거나 초기화합니다.</p></div>
          <div class="toolbar"><label class="count-control">문제 수 <input id="missionCount" type="number" min="1" max="10" value="3" inputmode="numeric"></label><button onclick="startAll()">전체 미션 시작</button><button class="danger" onclick="resetAll()">전체 점수 초기화</button></div></div>
          <div id="signals" class="grid signals"></div>
          <button class="secondary" style="margin-top:12px" onclick="saveSignals()">신호 규칙 저장</button>
        </section>
        <div id="teams" class="grid"></div>
      </section>
    </main>`,
    `<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>
<script>
var token=localStorage.getItem("farm-admin-token")||"";
var setupRequired=false;
var game=null;
var roles=[];
var issues={};
var competition={complete:false};
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
    var data=await api("/api/admin/state");game=data.state;roles=data.roles;issues=data.issues;competition=data.competition;
    document.getElementById("auth").hidden=true;document.getElementById("dashboard").hidden=false;render();
  }catch(error){localStorage.removeItem("farm-admin-token");token="";document.getElementById("auth").hidden=false;document.getElementById("dashboard").hidden=true}
}
function render(){
  document.getElementById("scores").innerHTML=["A","B","C"].map(function(id){var t=game.teams[id];return '<div class="score" style="--team:'+t.color+'"><span>'+esc(t.symbol)+' '+esc(t.name)+'</span><strong>'+t.score+'점</strong><span class="muted">참가 '+t.players.length+'명</span></div>'}).join("");
  var result=document.getElementById("competitionResult");result.hidden=!competition.complete;result.innerHTML=competition.complete?competitionHtml(competition):"";
  document.getElementById("signals").innerHTML=Object.keys(issues).map(function(id){return '<div class="signal-item"><label>'+esc(issues[id].label)+'</label><input data-signal="'+id+'" value="'+esc(game.signals[id])+'"></div>'}).join("");
  document.getElementById("teams").innerHTML=["A","B","C"].map(teamHtml).join("");
  ["A","B","C"].forEach(function(id){var t=game.teams[id],box=document.getElementById("qr-"+id);if(box&&window.QRCode)new QRCode(box,{text:location.origin+"/play/"+encodeURIComponent(t.joinCode),width:122,height:122,correctLevel:QRCode.CorrectLevel.M})});
}
function teamHtml(id){
  var t=game.teams[id],round=t.round;
  var roundText=!round?"대기 중":(round.status==="complete"?round.message:"미션 "+(round.challengeIndex+1)+"/"+round.challenges.length);
  var players=t.players.length?t.players.map(function(p){return '<div class="player-row"><div class="player-head"><div><strong>'+esc(p.name)+'</strong> <span class="muted">'+esc(p.grade)+'학년</span></div><button class="danger" onclick="removePlayer(\\''+id+'\\',\\''+p.id+'\\')">삭제</button></div><div class="role-list">'+roles.map(function(r){var checked=p.roles.includes(r.id)?" checked":"";return '<label class="role-check"><input type="checkbox"'+checked+' onchange="setRole(\\''+id+'\\',\\''+p.id+'\\',\\''+r.id+'\\',this.checked)"> '+esc(r.label)+'</label>'}).join("")+'</div></div>'}).join(""):'<p class="muted">아직 참가한 학생이 없습니다.</p>';
  return '<section class="card team" style="--team:'+t.color+'"><div class="section-head"><div><h2>'+esc(t.symbol)+' '+esc(t.name)+'</h2><div class="team-meta"><span>'+roundText+'</span><span>총점 '+t.score+'점</span></div></div><div class="toolbar"><button onclick="startTeam(\\''+id+'\\')">이 팀 미션 시작</button><button class="danger" onclick="resetTeam(\\''+id+'\\')">팀 점수 초기화</button></div></div><div class="qr-wrap"><div id="qr-'+id+'" class="qr"></div><div><strong>팀 참가 QR</strong><p class="muted">'+esc(t.joinCode)+'</p><a href="/play/'+encodeURIComponent(t.joinCode)+'" target="_blank">참가 화면 열기</a></div></div><h3 style="margin-top:20px">참가자와 역할</h3>'+players+'</section>';
}
function competitionHtml(data){return '<h2>'+esc(data.message)+'</h2><p class="muted">세 팀이 모두 미션을 마쳐 총점을 비교했습니다.</p><div class="ranking">'+data.leaderboard.map(function(t){return '<div class="rank-row" style="--rank-color:'+t.color+'"><div class="rank-number">'+t.rank+'위</div><div><strong>'+esc(t.symbol)+' '+esc(t.name)+'</strong></div><div class="rank-score"><strong>'+t.score+'점</strong><span>이번 +'+t.cycleScore+'점</span></div></div>'}).join("")+'</div>'}
async function act(action){try{var data=await api("/api/admin/action",{method:"POST",body:JSON.stringify(action)});game=data.state;roles=data.roles;issues=data.issues;competition=data.competition;render()}catch(error){alert(error.message)}}
function setRole(teamId,playerId,role,checked){var p=game.teams[teamId].players.find(function(x){return x.id===playerId});var next=p.roles.filter(function(x){return x!==role});if(checked)next.push(role);act({type:"assign_roles",teamId:teamId,playerId:playerId,roles:next})}
function selectedCount(){return Math.min(10,Math.max(1,parseInt(document.getElementById("missionCount").value,10)||1))}
function startTeam(teamId){act({type:"start_round",teamId:teamId,count:selectedCount()})}
function startAll(){act({type:"start_all",count:selectedCount()})}
function resetTeam(teamId){if(confirm("이 팀의 점수를 초기화할까요?"))act({type:"reset_team",teamId:teamId})}
function resetAll(){if(confirm("모든 팀의 점수를 초기화할까요?"))act({type:"reset_all"})}
function removePlayer(teamId,playerId){if(confirm("이 참가자를 삭제할까요?"))act({type:"remove_player",teamId:teamId,playerId:playerId})}
function saveSignals(){var signals={};document.querySelectorAll("[data-signal]").forEach(function(input){signals[input.dataset.signal]=input.value});act({type:"save_signals",signals:signals})}
setInterval(function(){if(token&&!document.hidden)load()},2000);boot();
</script>`,
  );
}

function playerPage(code) {
  const encodedCode = JSON.stringify(code);
  return layout(
    "플레이어 | 스마트 농장",
    `<main id="playerShell" class="shell">
      <header class="topbar"><div class="brand"><div id="teamMark" class="logo">♧</div><div><strong>스마트 농장 구조대</strong><div id="teamLabel" class="muted">팀 참가</div></div></div><div id="miniScore"></div></header>
      <section id="join" class="card auth">
        <h1>팀 참가</h1><p class="muted">이름과 학년을 입력하면 바로 참가합니다.</p>
        <form id="joinForm"><div class="field"><label for="name">이름</label><input id="name" maxlength="20" required></div>
        <div class="field"><label for="grade">학년</label><select id="grade" required><option value="">선택</option><option value="1">1학년</option><option value="2">2학년</option><option value="3">3학년</option><option value="4">4학년</option><option value="5">5학년</option><option value="6">6학년</option></select></div>
        <button type="submit" style="width:100%">게임 참가</button></form><div id="joinMessage" class="notice error" hidden></div>
      </section>
      <section id="game" hidden>
        <div id="teamBanner" class="team-banner"></div>
        <div class="player-tools"><button class="secondary" onclick="openSignals()">신호 규칙 확인</button></div>
        <section id="competitionResult" class="competition-result" hidden></section>
        <section id="currentRole" class="role-focus"></section>
        <section class="role-guide"><h3>내가 맡은 역할과 하는 일</h3><div id="roleGuide" class="role-guide-list"></div></section>
        <div class="status-row"><div><div class="phase" id="phase">WAITING</div><div id="roles" class="pills"></div></div></div>
        <div id="progress" class="round-progress"></div>
        <section id="mission" class="card mission"></section>
        <p class="footer-note">팀원의 선택과 다음 문제는 자동으로 업데이트됩니다.</p>
      </section>
      <dialog id="signalDialog" class="signal-dialog"><div class="dialog-head"><h2>우리 팀 신호 규칙</h2><button type="button" class="icon-button" aria-label="닫기" onclick="closeSignals()">×</button></div><div id="signalRules" class="signal-rule-list"></div></dialog>
    </main>`,
    `<script>
var TEAM_CODE=${encodedCode};
var KEY="farm-player-"+TEAM_CODE;
var auth=JSON.parse(localStorage.getItem(KEY)||"null");
var last=null;
var hintVisible=localStorage.getItem(KEY+"-hint")==="1";
var resultTimer=null;
function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,function(ch){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[ch]})}
async function responseData(response){
  var text=await response.text();
  try{return text?JSON.parse(text):{}}
  catch(error){throw new Error("서버가 올바르지 않은 응답을 보냈습니다. 잠시 후 다시 시도해 주세요. ("+response.status+")")}
}
function headers(){return {"content-type":"application/json","x-player-id":auth.playerId,"x-player-token":auth.playerToken}}
async function load(){
  if(!auth)return;
  try{var response=await fetch("/api/player/state",{headers:headers(),cache:"no-store"});var data=await responseData(response);if(!response.ok)throw new Error(data.error);last=data;showGame(data)}
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
function activeRoleId(data,c){
  if(!c||c.phase==="result")return null;
  if(c.kind==="environment"&&c.phase==="sensor"&&c.issueId)return data.issues[c.issueId].sensorRole;
  if(c.kind==="environment"&&c.phase==="computer")return "computer";
  if(c.kind==="environment"&&c.phase==="device")return c.selectedDevice||null;
  if(c.kind==="fault"&&c.phase==="fault_alert")return c.targetDevice||null;
  if(c.kind==="fault"&&c.phase==="repair")return "engineer";
  return null;
}
function openSignals(){var dialog=document.getElementById("signalDialog");if(dialog.showModal)dialog.showModal();else dialog.setAttribute("open","")}
function closeSignals(){var dialog=document.getElementById("signalDialog");if(dialog.close)dialog.close();else dialog.removeAttribute("open")}
function toggleHint(){hintVisible=!hintVisible;localStorage.setItem(KEY+"-hint",hintVisible?"1":"0");var box=document.getElementById("hintBox"),button=document.getElementById("hintToggle");if(box)box.hidden=!hintVisible;if(button)button.textContent=hintVisible?"힌트 닫기":"힌트 보기"}
function hint(text){return '<div class="hint-area"><button id="hintToggle" class="secondary" onclick="toggleHint()">'+(hintVisible?"힌트 닫기":"힌트 보기")+'</button><div id="hintBox" class="hint-box"'+(hintVisible?"":" hidden")+'>'+esc(text)+'</div></div>'}
function scheduleResultAdvance(c){if(resultTimer){clearTimeout(resultTimer);resultTimer=null}if(!c||c.phase!=="result"||!c.completedAt)return;var elapsed=Date.now()-new Date(c.completedAt).getTime(),delay=Math.max(50,950-elapsed);resultTimer=setTimeout(function(){resultTimer=null;if(auth&&!document.hidden)load()},delay)}
function showGame(data){
  var team=data.team,player=data.player,round=team.round,challenge=round&&round.challenges[round.challengeIndex];
  var activeId=activeRoleId(data,challenge),isMyTurn=activeId&&player.roles.includes(activeId);
  document.getElementById("join").hidden=true;document.getElementById("game").hidden=false;
  document.getElementById("playerShell").style.setProperty("--team",team.color);
  document.getElementById("teamMark").style.background=team.color;
  document.getElementById("teamMark").textContent=team.symbol;
  document.getElementById("teamLabel").textContent=team.name+" · "+player.name;
  document.getElementById("miniScore").innerHTML="<strong>"+team.score+"점</strong>";
  document.getElementById("teamBanner").innerHTML='<div><strong>'+esc(team.symbol)+' '+esc(team.name)+'</strong><span>'+esc(player.name)+' 구조대원</span></div><div class="team-banner-symbol">'+esc(team.symbol)+'</div>';
  var result=document.getElementById("competitionResult");result.hidden=!data.competition.complete;result.innerHTML=data.competition.complete?competitionHtml(data.competition):"";
  document.getElementById("roles").innerHTML=player.roles.length?player.roles.map(function(id){return '<span class="pill">'+esc(roleLabel(id,data))+'</span>'}).join(""):'<span class="pill">역할 배정 대기</span>';
  if(isMyTurn){
    var active=roleInfo(activeId,data);
    document.getElementById("currentRole").innerHTML='<div class="role-focus-symbol">'+esc(active.symbol)+'</div><div><p class="phase">지금은 내가 움직일 차례</p><h2>'+esc(active.label)+'</h2><p>'+esc(active.description)+'</p></div>';
  }else{
    var waitingTitle=!player.roles.length?"역할 배정을 기다려요":!round?"미션 시작을 기다려요":round.status==="complete"?"미션을 마쳤어요":"팀원의 선택을 기다려요";
    document.getElementById("currentRole").innerHTML='<div class="role-focus-symbol">…</div><div><p class="phase">현재 수행 역할</p><h2>'+waitingTitle+'</h2><p>'+(player.roles.length?"내 역할 차례가 오면 이곳에 크게 표시됩니다.":"선생님이 역할을 배정하면 역할 이름과 하는 일이 표시됩니다.")+'</p></div>';
  }
  document.getElementById("roleGuide").innerHTML=player.roles.length?player.roles.map(function(id){var role=roleInfo(id,data),activeClass=id===activeId?" active":"";return '<div class="role-guide-item'+activeClass+'"><div class="role-symbol">'+esc(role.symbol)+'</div><div><strong>'+esc(role.label)+'</strong><p>'+esc(role.description)+'</p></div></div>'}).join(""):'<p class="muted">아직 배정된 역할이 없습니다.</p>';
  document.getElementById("signalRules").innerHTML=Object.keys(data.issues).map(function(id){return '<div class="signal-rule"><span>'+esc(data.issues[id].label)+'</span><strong>'+esc(data.signals[id])+'</strong></div>'}).join("");
  document.getElementById("progress").innerHTML=round?round.challenges.map(function(item,index){var cls=index<round.challengeIndex?"dot done":index===round.challengeIndex?"dot on":"dot";return '<span class="'+cls+'"></span>'}).join(""):"";
  document.getElementById("phase").textContent=round?"미션 "+(round.challengeIndex+1)+"/"+round.challenges.length:"WAITING";
  document.getElementById("mission").innerHTML=missionHtml(data,challenge);
  scheduleResultAdvance(challenge);
}
function competitionHtml(data){return '<h2>'+esc(data.message)+'</h2><p class="muted">세 팀의 총점 비교 결과입니다.</p><div class="ranking">'+data.leaderboard.map(function(t){return '<div class="rank-row" style="--rank-color:'+t.color+'"><div class="rank-number">'+t.rank+'위</div><div><strong>'+esc(t.symbol)+' '+esc(t.name)+'</strong></div><div class="rank-score"><strong>'+t.score+'점</strong><span>이번 +'+t.cycleScore+'점</span></div></div>'}).join("")+'</div>'}
function wait(icon,title,text){return '<div><div class="icon">'+icon+'</div><h2>'+esc(title)+'</h2><p class="muted">'+esc(text)+'</p></div>'}
function missionHtml(data,c){
  var team=data.team,player=data.player,round=team.round;
  if(!player.roles.length)return wait("⌛","역할을 기다리는 중","선생님이 역할을 배정하면 여기에 표시됩니다.");
  if(!round)return wait("🌿","농장 시스템 대기 중","모든 역할을 확인하고 미션 시작을 기다리세요.");
  if(round.status==="complete")return wait(round.challenges.every(function(x){return x.success})?"🏆":"🌱",round.message,round.challenges.every(function(x){return x.success})?"팀이 농장을 지켜냈습니다.":"다음 미션에서 다시 도전하세요.");
  if(!c)return wait("⌛","문제를 불러오는 중","잠시 기다려 주세요.");
  if(c.phase==="result")return wait(c.success?"✅":"❌",c.success?"문제 해결 성공!":"문제 해결 실패",round.message||"결과를 확인하고 다음 문제를 준비하세요.");
  if(c.kind==="environment"&&c.phase==="sensor"){
    if(c.issueId){var issue=data.issues[c.issueId];return '<div><div class="icon">📡</div><h2>'+esc(issue.label)+' 감지</h2><p>'+esc(issue.message)+'</p><div class="choices">'+Object.keys(data.signals).map(function(id){return '<button onclick="act({type:\\'send_signal\\',signal:\\''+esc(data.signals[id])+'\\'})">'+esc(data.signals[id])+'</button>'}).join("")+'</div>'+hint("지금 문제는 "+issue.label+"이에요. "+data.signals[c.issueId]+" 버튼을 누르세요.")+'</div>'}
    return wait("🙈","센서가 확인 중","문제 상황은 담당 센서에게만 보입니다.");
  }
  if(c.kind==="environment"&&c.phase==="computer"){
    if(player.roles.includes("computer")){var signalIssueId=Object.keys(data.signals).find(function(id){return data.signals[id]===c.selectedSignal}),signalIssue=signalIssueId&&data.issues[signalIssueId],computerHint=signalIssue?"이 신호는 "+signalIssue.label+"을 뜻해요. "+roleLabel(signalIssue.deviceRole,data)+"를 선택하세요.":"신호 규칙 창에서 같은 신호를 찾아 알맞은 기기를 선택하세요.";return '<div><div class="icon">🧠</div><h2>신호를 해석하세요</h2><p>전달된 신호: <strong>'+esc(c.selectedSignal)+'</strong></p><div class="choices">'+data.roles.filter(function(r){return r.group==="기기"}).map(function(r){return '<button onclick="act({type:\\'computer_decision\\',deviceRole:\\''+r.id+'\\'})">'+esc(r.label)+' 선택</button>'}).join("")+'</div>'+hint(computerHint)+'</div>'}
    return wait("🔄","컴퓨터가 판단 중","전달된 신호를 바탕으로 작동할 기기를 고르고 있습니다.");
  }
  if(c.kind==="environment"&&c.phase==="device"){
    if(player.roles.includes(c.selectedDevice))return '<div><div class="icon">⚙️</div><h2>'+esc(roleLabel(c.selectedDevice,data))+' 작동</h2><p>컴퓨터의 명령을 실행하세요.</p><div class="choices"><button onclick="act({type:\\'activate_device\\'})">기기 작동하기</button></div>'+hint(roleLabel(c.selectedDevice,data)+" 담당 차례예요. 기기 작동하기 버튼을 누르세요.")+'</div>';
    return wait("⚙️","기기가 작동 중",roleLabel(c.selectedDevice,data)+" 담당자가 명령을 실행하고 있습니다.");
  }
  if(c.kind==="fault"&&c.phase==="fault_alert"){
    if(c.faultId&&player.roles.includes(c.targetDevice)){var fault=data.faults.find(function(f){return f.id===c.faultId});return '<div><div class="icon">⚠️</div><h2>'+esc(fault.label)+'</h2><p>'+esc(fault.detail)+'</p><p><strong>'+esc(roleLabel(c.targetDevice,data))+'</strong> 담당자가 엔지니어에게 알려야 합니다.</p><div class="choices"><button class="danger" onclick="act({type:\\'report_fault\\'})">고장 신호 보내기</button></div>'+hint("기기가 고장 났어요. 고장 신호 보내기 버튼을 눌러 엔지니어에게 알려 주세요.")+'</div>'}
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
