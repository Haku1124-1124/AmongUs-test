import test from 'node:test';
import assert from 'node:assert/strict';
import { MAPS_DEF } from './maps';
import { extractMapWallSegments, computeVisibilityPolygon, hasLineOfSight } from './vision';
import {
  assignRoles,
  computePlayerVisionRadius,
  evaluateWinCondition,
  findSafeSpawnPosition,
  getPlayerTaskTargetCount,
  getRoleKillCooldown,
  isPointWalkable,
  resolveMovementWithWalls,
  tallyVotes,
  PlayerState
} from './rules';
import {
  ALL_TASKS,
  CHAT_STAMPS,
  CREW_COLORS,
  CREW_HATS,
  CREW_PETS,
  KILL_EFFECTS,
  QUICK_CHAT_PRESETS,
  SPECIAL_ROLE_KEYS
} from './constants';

test('all 20 tasks have distinct Among Us mechanics and all map taskSpots resolve cleanly', () => {
  assert.equal(ALL_TASKS.length, 20);
  const taskIds = new Set(ALL_TASKS.map((t) => t.id));
  const taskTypes = new Set(ALL_TASKS.map((t) => t.type));
  assert.equal(taskIds.size, 20, 'Every task ID must be unique');
  assert.equal(taskTypes.size, 20, 'Every task should use a distinct mini-game mechanic');

  for (const mapDef of Object.values(MAPS_DEF)) {
    assert.ok(mapDef.taskSpots.length >= 12, `Map ${mapDef.id} should provide at least 12 task spots`);
    for (const spot of mapDef.taskSpots) {
      assert.ok(taskIds.has(spot.taskId), `Map ${mapDef.id} references valid taskId ${spot.taskId}`);
    }
  }
});

test('all 40 hats, 15 crew colors, 9 pets, 6 kill effects, and chat stamps have unique valid metadata', () => {
  assert.equal(CREW_HATS.length, 40, 'Should expose exactly 40 hat cosmetics');
  const hatIds = new Set(CREW_HATS.map((h) => h.id));
  const hatNames = new Set(CREW_HATS.map((h) => h.name));
  assert.equal(hatIds.size, 40, 'Every hat ID must be unique');
  assert.equal(hatNames.size, 40, 'Every hat display name must be unique');
  for (const h of CREW_HATS) {
    assert.ok(h.id.length > 0 && h.name.length > 0 && h.icon.length > 0, `Hat ${h.id} must have valid metadata`);
  }

  assert.equal(CREW_COLORS.length, 15, 'Should expose 15 crew colors');
  const colorIds = new Set(CREW_COLORS.map((c) => c.id));
  assert.equal(colorIds.size, 15, 'Every color ID must be unique');

  assert.equal(CREW_PETS.length, 9, 'Should expose 9 mini-pet options');
  assert.equal(new Set(CREW_PETS.map((p) => p.id)).size, 9, 'Every pet ID must be unique');

  assert.equal(KILL_EFFECTS.length, 6, 'Should expose 6 kill effects');
  assert.equal(new Set(KILL_EFFECTS.map((e) => e.id)).size, 6, 'Every kill effect ID must be unique');

  assert.equal(CHAT_STAMPS.length, 6, 'Should expose 6 chat stamps');
  assert.equal(new Set(CHAT_STAMPS.map((s) => s.id)).size, 6, 'Every chat stamp ID must be unique');
  assert.ok(QUICK_CHAT_PRESETS.length >= 6, 'Should expose quick chat presets');
});


test('all 15 maps have valid walkable emergency spawns, task spots, vents, and balanced gimmicks', () => {
  const mapIds = Object.keys(MAPS_DEF);
  assert.equal(mapIds.length, 15, 'Should have exactly 15 maps');

  for (const id of mapIds) {
    const m = MAPS_DEF[id];
    assert.ok(m.gimmickSummary && m.gimmickSummary.length > 0, `${id} should have a gimmickSummary`);
    assert.ok(m.gimmicks.length >= 1, `${id} should have at least 1 map-specific gimmick`);

    // Narrow corridor check: corridors should be <= 90px wide (realistic choke points) and >= 56px (traversable)
    for (const c of m.corridors) {
      const minDim = Math.min(c.w, c.h);
      assert.ok(minDim >= 56 && minDim <= 90, `${id} corridor ${c.x},${c.y} width=${minDim} should be a balanced narrow corridor`);
    }

    // Emergency spawn area should find safe positions around the center table
    const safe = findSafeSpawnPosition(m.emergency.x + 70, m.emergency.y, m);
    assert.ok(isPointWalkable(safe.x, safe.y, m), `${id} safe emergency spawn must be walkable`);

    // Every task spot must be walkable
    for (const ts of m.taskSpots) {
      assert.ok(
        isPointWalkable(ts.x, ts.y, m),
        `${id} task spot ${ts.taskId} at (${ts.x}, ${ts.y}) must be walkable`
      );
    }

    // Every vent must be walkable
    for (const v of m.vents) {
      assert.ok(
        isPointWalkable(v.x, v.y, m),
        `${id} vent ${v.id} at (${v.x}, ${v.y}) must be walkable`
      );
    }

    // Sabotage repair spots must be walkable
    assert.ok(
      isPointWalkable(m.sabotageFix.lights.x, m.sabotageFix.lights.y, m),
      `${id} lights fix spot must be walkable`
    );
    assert.ok(
      isPointWalkable(m.sabotageFix.reactor.x, m.sabotageFix.reactor.y, m),
      `${id} reactor fix spot must be walkable`
    );

    // Interactive gimmicks must be walkable
    for (const g of m.gimmicks) {
      if (['teleport', 'sonar', 'camera', 'boost_vent', 'admin', 'vitals', 'doorlog', 'lockdown_door', 'crystal_beacon', 'emf_scanner', 'bell'].includes(g.type)) {
        assert.ok(
          isPointWalkable(g.x, g.y, m),
          `${id} gimmick ${g.type} (${g.label}) at (${g.x}, ${g.y}) must be walkable`
        );
      }
      // Verify rebalanced cooldowns on teleports / sonars / boost vents
      if (g.type === 'teleport') {
        assert.ok((g.cooldownSec ?? 0) >= 10, `${id} teleport must have a cooldown >= 10s`);
      }
      if (g.type === 'sonar') {
        assert.ok((g.cooldownSec ?? 0) >= 15, `${id} sonar must have a cooldown >= 15s`);
      }
      if (g.type === 'boost_vent') {
        assert.ok((g.cooldownSec ?? 0) >= 10 && (g.speedMult ?? 1) <= 1.3, `${id} boost_vent must be balanced`);
      }
      if (g.type === 'conveyor') {
        assert.ok((g.vx ?? 0) <= 150, `${id} conveyor speed must be balanced <= 150`);
      }
      if (g.type === 'low_gravity') {
        assert.ok((g.speedMult ?? 1) <= 1.22, `${id} low_gravity speed mult must be balanced <= 1.22`);
      }
    }
  }
});

test('2D wall segment extraction and line-of-sight raycasting block vision through walls', () => {
  const starship = MAPS_DEF.starship;
  const walls = extractMapWallSegments(starship);
  assert.ok(walls.length >= 20, 'Starship should produce clean outer/interior wall segments');

  // Cafeteria (990, 270) to Electrical (460, 820) has walls in between -> no LoS
  assert.equal(
    hasLineOfSight(990, 270, 460, 820, walls),
    false,
    'Line of sight should be blocked between Cafeteria and Electrical'
  );

  // Cafeteria (990, 270) to Medbay (550, 325) passes straight through open corridor at y=325 -> clear LoS
  assert.equal(
    hasLineOfSight(990, 325, 580, 325, walls),
    true,
    'Line of sight should pass cleanly through open hallway between Cafeteria and Medbay'
  );

  // Visibility polygon returns valid non-empty polygon capped within radius
  const poly = computeVisibilityPolygon(990, 270, 295, walls);
  assert.ok(poly.length >= 56, 'Visibility polygon should have sufficient vertices');
  for (const pt of poly) {
    const d = Math.hypot(pt.x - 990, pt.y - 270);
    assert.ok(d <= 295.5, 'Every visibility polygon vertex must respect vision radius');
  }
});

test('vision radius adjusts fairly for roles, sabotage, spore mist, and sandstorm', () => {
  const jungle = MAPS_DEF.jungle;
  const crewBase = computePlayerVisionRadius({
    role: 'crewmate',
    x: 995,
    y: 275,
    mapDef: jungle,
    sabotageType: null,
    crystalBeaconActive: false,
    sandstormActive: false
  });
  const crewInMist = computePlayerVisionRadius({
    role: 'crewmate',
    x: 995,
    y: 580, // inside spore_mist
    mapDef: jungle,
    sabotageType: null,
    crystalBeaconActive: false,
    sandstormActive: false
  });
  const impLightsOut = computePlayerVisionRadius({
    role: 'impostor',
    x: 995,
    y: 275,
    mapDef: jungle,
    sabotageType: 'lights',
    crystalBeaconActive: false,
    sandstormActive: false
  });
  const crewLightsOut = computePlayerVisionRadius({
    role: 'crewmate',
    x: 995,
    y: 275,
    mapDef: jungle,
    sabotageType: 'lights',
    crystalBeaconActive: false,
    sandstormActive: false
  });

  const impHaunted = computePlayerVisionRadius({
    role: 'impostor',
    x: 995,
    y: 275,
    mapDef: jungle,
    sabotageType: null,
    crystalBeaconActive: false,
    sandstormActive: false,
    hauntedActive: true
  });

  assert.equal(crewBase, 295);
  assert.ok(crewInMist < crewBase, 'Spore mist should reduce crew vision');
  assert.equal(impLightsOut, 410, 'Impostor retains full vision during Lights Out');
  assert.equal(crewLightsOut, 120, 'Crew vision shrinks during Lights Out');
  assert.ok(impHaunted < 410 && impHaunted >= 110, 'Ghost mischief mildly shrinks impostor vision');
});

test('smooth wall sliding collision allows walking along narrow corridors without getting stuck', () => {
  const starship = MAPS_DEF.starship;
  // Start in Cafeteria -> Weapons narrow corridor (y=230..304)
  let x = 1230;
  let y = 267;
  for (let i = 0; i < 30; i++) {
    const next = resolveMovementWithWalls(x, y, 245, 0, 1 / 60, starship, true, []);
    x = next.x;
    y = next.y;
  }
  assert.ok(x > 1340, 'Player should move smoothly rightwards through narrow corridor');
});

test('20 roles balance rules, Mayor 2x voting, and win conditions work properly', () => {
  assert.equal(getRoleKillCooldown('viper', 25), 30);
  assert.equal(getRoleKillCooldown('sheriff', 25), 28);
  assert.equal(getRoleKillCooldown('jackal', 25), 23);
  assert.equal(getPlayerTaskTargetCount({ role: 'mayor' }, 4), 5);
  assert.equal(getPlayerTaskTargetCount({ role: 'crewmate' }, 4), 4);

  const players: Record<string, PlayerState> = {
    p1: { id: 'p1', name: 'Mayor', color: 'red', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'mayor', alive: true, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: false, tasksDone: 0 },
    p2: { id: 'p2', name: 'Imp', color: 'cyan', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'impostor', alive: true, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: false, tasksDone: 0 },
    p3: { id: 'p3', name: 'Crew', color: 'lime', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'crewmate', alive: true, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: false, tasksDone: 0 }
  };

  // Mayor votes p2 (2 votes), p2 votes p1 (1 vote), p3 skips (1 vote) -> p2 ejected
  const res = tallyVotes({ p1: 'p2', p2: 'p1', p3: 'skip' }, players);
  assert.equal(res.ejectedId, 'p2');
  assert.equal(res.tie, false);

  // If p2 dies, crewmates win
  players.p2.alive = false;
  const win = evaluateWinCondition(players, 4);
  assert.equal(win?.winner, 'crewmates');

  // Role assignment assigns valid roles
  const enabledRoles = SPECIAL_ROLE_KEYS.reduce<Record<string, boolean>>((acc, k) => {
    acc[k] = true;
    return acc;
  }, {});
  const assigned = assignRoles(['a', 'b', 'c', 'd', 'e', 'f'], {
    mapId: 'starship',
    impostors: 1,
    killCooldown: 25,
    spawnKillCooldown: 10,
    meetingTime: 60,
    taskCount: 4,
    specialRolesCount: 3,
    enabledRoles
  });
  assert.equal(Object.keys(assigned).length, 6);

  // Regression check: 5-player 1-impostor games never spawn madscientist alongside the impostor
  for (let trial = 0; trial < 30; trial++) {
    const fiveRoleMap = assignRoles(
      ['p1', 'p2', 'p3', 'p4', 'p5'],
      {
        mapId: 'starship',
        impostors: 1,
        killCooldown: 25,
        spawnKillCooldown: 10,
        meetingTime: 60,
        taskCount: 4,
        specialRolesCount: 5,
        enabledRoles
      }
    );
    const values = Object.values(fiveRoleMap);
    assert.equal(values.includes('madscientist'), false, 'madscientist should not spawn in <= 6 player lobbies');
  }

  // With 1 impostor and 3 surviving non-impostors after 1st kill, match continues
  const afterFirstKill: Record<string, PlayerState> = {
    a: { id: 'a', name: 'A', color: 'red', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'shapeshifter', alive: true, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: true, tasksDone: 0 },
    b: { id: 'b', name: 'B', color: 'blue', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'crewmate', alive: true, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: true, tasksDone: 0 },
    c: { id: 'c', name: 'C', color: 'lime', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'doctor', alive: true, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: true, tasksDone: 0 },
    d: { id: 'd', name: 'D', color: 'cyan', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'detective', alive: true, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: true, tasksDone: 0 },
    e: { id: 'e', name: 'E', color: 'yellow', hat: 'none', x: 0, y: 0, targetX: 0, targetY: 0, facing: 1, role: 'engineer', alive: false, invisible: false, inVent: false, shielded: false, disguisedAs: null, isBot: true, tasksDone: 0 }
  };
  assert.equal(evaluateWinCondition(afterFirstKill, 4), null, 'Match must continue after 1st kill in 5-player game');
});
