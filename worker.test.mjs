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
  await room.ctx.storage.put("game", oldState);

  const upgraded = await room.state();
  assert.ok(upgraded.session.id);
  assert.deepEqual(upgraded.classHistory, []);
  assert.equal(upgraded.teams.A.name, "새싹팀");
  assert.equal(upgraded.teams.A.stats.completed, 0);
  assert.deepEqual(Object.keys(upgraded.signals), ["heat", "drought", "low_light"]);
  assert.deepEqual(upgraded.teams.A.players[0].roles, ["computer", "device_operator"]);
  assert.equal(upgraded.teams.A.round, null);
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

  await playerAction(playerForRole(team, "sensor_temp"), {
    type: "send_signal",
    signal: liveState.signals.heat,
  });
  await playerAction(playerForRole(team, "computer"), {
    type: "computer_decision",
    deviceId: "device_fan",
  });
  await playerAction(playerForRole(team, "device_operator"), { type: "activate_device" });
  await playerAction(playerForRole(team, "device_operator"), { type: "stop_device" });
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
    ? challenge.issueId === "heat"
      ? "sensor_temp"
      : challenge.issueId === "drought"
        ? "sensor_water"
        : "sensor_light"
    : "device_operator";
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
        heat: ["sensor_temp", "device_fan"],
        drought: ["sensor_water", "device_sprinkler"],
        low_light: ["sensor_light", "device_light"],
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
      const devicePlayer = playerForRole(current.teams[teamId], "device_operator");
      await playerAction(devicePlayer, { type: "activate_device" });
      await playerAction(devicePlayer, { type: "stop_device" });
    } else {
      const devicePlayer = playerForRole(currentTeam, "device_operator");
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
        id === "B" && index === 0
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
  assert.equal(adminData.state.teams.A.score, 600);
  assert.equal(adminData.state.teams.B.score, 590);
  assert.equal(adminData.state.teams.C.score, 550);
  assert.deepEqual(
    adminData.state.teams.A.round.challenges.map((challenge) => challenge.points),
    [200, 200, 200],
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
