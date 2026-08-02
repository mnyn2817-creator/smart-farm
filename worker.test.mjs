import assert from "node:assert/strict";
import test from "node:test";

import { GameRoom } from "./worker.js";

function createRoom() {
  let saved;
  const storage = {
    get: async () => saved,
    put: async (_key, value) => {
      saved = structuredClone(value);
    },
  };
  return new GameRoom({ storage }, {});
}

async function responseJson(response) {
  const data = await response.json();
  assert.equal(response.ok, true, data.error);
  return data;
}

function request(path, options = {}) {
  return new Request(`https://test.local${path}`, options);
}

test("existing classroom state is upgraded without losing teams", async () => {
  const room = createRoom();
  const oldState = await room.state();
  delete oldState.session;
  delete oldState.classHistory;
  for (const team of Object.values(oldState.teams)) delete team.stats;
  oldState.signals.high_light = "old high light";
  oldState.signals.pest = "old pest";
  oldState.teams.A.players.push({
    id: "old-player",
    token: "old-token",
    name: "기존 참가자",
    grade: "4",
    roles: ["sensor_pest", "device_fan", "computer"],
    joinedAt: new Date().toISOString(),
  });
  oldState.teams.A.round = {
    challengeIndex: 0,
    challenges: [{ kind: "environment", issueId: "high_light", phase: "sensor" }],
  };
  const legacyRoles = [
    ["sensor_temp"],
    ["sensor_water"],
    ["sensor_light"],
    ["computer"],
    ["device_operator"],
    ["engineer"],
  ];
  oldState.teams.B.players = legacyRoles.map((roles, index) => ({
    id: `legacy-${index}`,
    token: `legacy-token-${index}`,
    name: `기존 참가자 ${index + 1}`,
    grade: "4",
    roles,
    joinedAt: new Date().toISOString(),
  }));
  await room.ctx.storage.put("game", oldState);

  const upgraded = await room.state();
  assert.ok(upgraded.session.id);
  assert.deepEqual(upgraded.classHistory, []);
  assert.equal(upgraded.teams.A.name, "새싹팀");
  assert.equal(upgraded.teams.A.stats.completed, 0);
  assert.deepEqual(Object.keys(upgraded.signals), ["heat", "drought", "low_light"]);
  assert.deepEqual(upgraded.teams.A.players[0].roles, ["device_fan", "computer"]);
  assert.equal(upgraded.teams.A.round, null);
  assert.deepEqual(
    upgraded.teams.B.players.map((player) => player.roles),
    [
      ["sensor_integrated"],
      ["computer"],
      ["device_fan"],
      ["device_sprinkler"],
      ["device_light"],
      ["engineer"],
    ],
  );
});

test("full classroom flow supports readiness, practice, recovery, scoring, and history", async () => {
  const room = createRoom();
  const state = await room.state();
  state.auth.adminToken = "admin-token";
  await room.save(state);

  const admin = async (action) =>
    responseJson(
      await room.fetch(
        request("/api/admin/action", {
          method: "POST",
          headers: {
            authorization: "Bearer admin-token",
            "content-type": "application/json",
          },
          body: JSON.stringify(action),
        }),
      ),
    );

  const authByPlayer = new Map();
  const teamSizes = { A: 6, B: 6, C: 5 };
  for (const team of Object.values(state.teams)) {
    for (let index = 1; index <= teamSizes[team.id]; index += 1) {
      const joined = await responseJson(
        await room.fetch(
          request("/api/join", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              code: team.joinCode,
              name: `${team.id}-${index}`,
              grade: "4",
            }),
          }),
        ),
      );
      authByPlayer.set(joined.playerId, joined);
    }
  }

  let adminData = await admin({ type: "recommend_all_roles" });
  for (const id of ["A", "B", "C"]) {
    assert.equal(adminData.readiness[id].ready, true);
    assert.equal(adminData.readiness[id].assignedPlayerCount, teamSizes[id]);
    assert.deepEqual(adminData.readiness[id].missingRoles, []);
  }
  assert.ok(
    adminData.state.teams.C.players.some(
      (player) => player.roles.includes("computer") && player.roles.includes("engineer"),
    ),
  );
  assert.ok(
    adminData.state.teams.A.players.every((player) => player.roles.length === 1),
  );

  const playerAction = async (playerId, action) => {
    const auth = authByPlayer.get(playerId);
    return responseJson(
      await room.fetch(
        request("/api/player/action", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-player-id": auth.playerId,
            "x-player-token": auth.playerToken,
          },
          body: JSON.stringify(action),
        }),
      ),
    );
  };

  const playerForRole = (team, role) => {
    const player = team.players.find((item) => item.roles.includes(role));
    assert.ok(player, `${team.id} missing ${role}`);
    return player.id;
  };

  await admin({ type: "start_practice", teamId: "A" });
  let liveState = await room.state();
  let team = liveState.teams.A;
  let challenge = team.round.challenges[0];
  assert.equal(team.round.practice, true);
  assert.equal(challenge.issueId, "heat");

  const practiceSensorId = playerForRole(team, "sensor_integrated");
  const practiceSensorAuth = authByPlayer.get(practiceSensorId);
  const earlyHintResponse = await room.fetch(
    request("/api/player/action", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-player-id": practiceSensorAuth.playerId,
        "x-player-token": practiceSensorAuth.playerToken,
      },
      body: JSON.stringify({ type: "use_hint" }),
    }),
  );
  assert.equal(earlyHintResponse.status, 400);

  await playerAction(practiceSensorId, {
    type: "send_signal",
    signal: liveState.signals.heat,
  });
  await playerAction(playerForRole(team, "computer"), {
    type: "computer_decision",
    deviceId: "device_fan",
  });
  const wrongDeviceId = playerForRole(team, "device_light");
  const wrongDeviceAuth = authByPlayer.get(wrongDeviceId);
  const wrongDeviceResponse = await room.fetch(
    request("/api/player/action", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-player-id": wrongDeviceAuth.playerId,
        "x-player-token": wrongDeviceAuth.playerToken,
      },
      body: JSON.stringify({ type: "activate_device" }),
    }),
  );
  assert.equal(wrongDeviceResponse.status, 409);
  liveState = await room.state();
  assert.equal(liveState.teams.A.round.challenges[0].deviceStartedAt, undefined);
  await playerAction(playerForRole(team, "device_fan"), { type: "activate_device" });
  await playerAction(playerForRole(team, "device_fan"), { type: "stop_device" });
  await admin({ type: "resume_round", teamId: "A" });

  liveState = await room.state();
  assert.equal(liveState.teams.A.round.status, "complete");
  assert.equal(liveState.teams.A.score, 0);
  assert.equal(liveState.teams.A.stats.completed, 0);

  await admin({ type: "start_round", teamId: "A", count: 1 });
  liveState = await room.state();
  team = liveState.teams.A;
  challenge = team.round.challenges[0];
  const initialRole = challenge.phase === "sensor"
    ? "sensor_integrated"
    : challenge.targetDevice;
  const handoffTarget = team.players.find(
    (player) => !player.roles.includes(initialRole),
  );
  await admin({
    type: "handoff_role",
    teamId: "A",
    playerId: handoffTarget.id,
  });
  liveState = await room.state();
  assert.deepEqual(
    liveState.teams.A.players
      .filter((player) => player.roles.includes(initialRole))
      .map((player) => player.id),
    [handoffTarget.id],
  );
  await admin({ type: "restart_challenge", teamId: "A" });
  await admin({ type: "skip_challenge", teamId: "A" });
  await admin({ type: "resume_round", teamId: "A" });
  liveState = await room.state();
  assert.equal(liveState.teams.A.round.status, "complete");

  await admin({ type: "start_all", count: 3 });

  liveState = await room.state();
  for (const id of ["A", "B", "C"]) {
    const usedDevices = liveState.teams[id].round.challenges.map((item) =>
      item.kind === "environment"
        ? {
            heat: "device_fan",
            drought: "device_sprinkler",
            low_light: "device_light",
          }[item.issueId]
        : item.targetDevice,
    );
    assert.deepEqual(
      [...usedDevices].sort(),
      ["device_fan", "device_light", "device_sprinkler"],
    );
  }

  const solveCurrentChallenge = async (
    teamId,
    useHint = false,
    elapsedMs = 0,
  ) => {
    let current = await room.state();
    const currentTeam = current.teams[teamId];
    const currentChallenge =
      currentTeam.round.challenges[currentTeam.round.challengeIndex];
    if (elapsedMs) {
      currentChallenge.startedAt = new Date(Date.now() - elapsedMs).toISOString();
      await room.save(current);
      current = await room.state();
    }

    if (currentChallenge.kind === "environment") {
      const issue = {
        heat: ["sensor_integrated", "device_fan"],
        drought: ["sensor_integrated", "device_sprinkler"],
        low_light: ["sensor_integrated", "device_light"],
      }[currentChallenge.issueId];
      const sensorPlayer = playerForRole(currentTeam, issue[0]);
      if (useHint) await playerAction(sensorPlayer, { type: "use_hint" });
      await playerAction(sensorPlayer, {
        type: "send_signal",
        signal: current.signals[currentChallenge.issueId],
      });
      current = await room.state();
      await playerAction(playerForRole(current.teams[teamId], "computer"), {
        type: "computer_decision",
        deviceId: issue[1],
      });
      current = await room.state();
      const devicePlayer = playerForRole(current.teams[teamId], issue[1]);
      await playerAction(devicePlayer, { type: "activate_device" });
      await playerAction(devicePlayer, { type: "stop_device" });
    } else {
      const devicePlayer = playerForRole(currentTeam, currentChallenge.targetDevice);
      if (useHint) await playerAction(devicePlayer, { type: "use_hint" });
      await playerAction(devicePlayer, { type: "report_fault" });
      current = await room.state();
      const engineer = playerForRole(current.teams[teamId], "engineer");
      const fault = [
        ["power", "전원 다시 연결하기"],
        ["connection", "네트워크 다시 연결하기"],
        ["stopped", "기기 재시작하기"],
      ].find(([id]) => id === currentChallenge.faultId);
      await playerAction(engineer, {
        type: "repair",
        repairChoice: fault[1],
      });
    }
    await admin({ type: "resume_round", teamId });
  };

  for (const id of ["A", "B", "C"]) {
    for (let index = 0; index < 3; index += 1) {
      const elapsedMs =
        id === "A" && index === 0
          ? 31_000
          : id === "B" && index === 0
          ? 11_000
          : id === "C" && index === 0
            ? 21_000
            : id === "C" && index === 1
              ? 31_000
              : 0;
      await solveCurrentChallenge(id, id === "A" && index === 0, elapsedMs);
    }
  }

  adminData = await responseJson(
    await room.fetch(
      request("/api/admin/state", {
        headers: { authorization: "Bearer admin-token" },
      }),
    ),
  );
  assert.equal(adminData.competition.complete, true);
  assert.equal(adminData.competition.leaderboard.length, 3);
  assert.equal(adminData.state.teams.A.score, 570);
  assert.equal(adminData.state.teams.B.score, 590);
  assert.equal(adminData.state.teams.C.score, 550);
  assert.deepEqual(
    adminData.state.teams.A.round.challenges.map((challenge) => challenge.points),
    [170, 200, 200],
  );
  assert.equal(adminData.state.teams.B.round.challenges[0].points, 190);
  assert.deepEqual(
    adminData.state.teams.C.round.challenges
      .slice(0, 2)
      .map((challenge) => challenge.points),
    [180, 170],
  );
  assert.equal(adminData.state.teams.A.round.summary.solved, 3);
  assert.ok(adminData.state.teams.A.stats.hintsUsed >= 1);

  adminData = await admin({ type: "new_class" });
  assert.equal(adminData.state.classHistory.length, 1);
  assert.equal(adminData.state.teams.A.players.length, 0);
  assert.equal(adminData.state.teams.A.score, 0);
  assert.equal(adminData.state.teams.A.stats.completed, 0);
});
