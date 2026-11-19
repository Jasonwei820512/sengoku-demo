export const STRATEGY_POOL = Object.fromEntries([
  ['hint', '献策', '消せる組を一つ教えてくれる', 30, 'hint'],
  ['monomi', '物見', '選んだ武将の見えている牌を約3秒照らす', 25, 'monomi'],
  ['shuffle', '陣替え', '残りの牌を並べ替える', 20, 'shuffle'],
  ['toki', '鬨の声', '通常モードで残り時間を15秒延ばす', 15, 'toki'],
  ['shinobi', '忍び', '同じ武将の牌を、つながらなくても二枚消す', 7, 'shinobi'],
  ['sougakari', '総掛かり', '選んだ武将の鎖のない牌をすべて消す。霧の牌からは選べない', 3, 'sougakari'],
].map(([id, name, help, weight, icon]) => [id, {name, help, weight, icon}]));

export function drawStrategy(chapter, stage, relaxed, rng = Math.random) {
  if (chapter === 1 && stage === 1) return 'hint';
  const pool = Object.entries(STRATEGY_POOL).filter(([id]) => !relaxed || id !== 'toki');
  let roll = rng() * pool.reduce((sum, [, item]) => sum + item.weight, 0);
  for (const [id, {weight}] of pool) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return pool.at(-1)[0];
}

export function openingStrategy(record, chapter, stage, relaxed, replay, rng) {
  // One recorded grant per stage. Failed runs never change the chapter's
  // carried stock. Cleared-stage replays start from their grant alone.
  const previous = record.grants[stage];
  const grant = Object.hasOwn(STRATEGY_POOL, previous) ? previous : drawStrategy(chapter, stage, relaxed, rng);
  const opening = replay ? {} : {...record.stock};
  opening[grant] = (opening[grant] || 0) + 1;
  return {grant, opening, stock: {...opening}, replay};
}

export function strategyCount(stock) {
  return Object.values(stock).reduce((sum, count) => sum + count, 0);
}

export function strategyTargets(board, ids, fog, locked, index, strategy) {
  const allowLocked = strategy === 'monomi';
  if (!board[index] || fog.includes(index) || (!allowLocked && locked.includes(ids[index]))) return [];
  return board.flatMap((value, i) =>
    value === board[index] && (strategy === 'sougakari' || !fog.includes(i)) && (allowLocked || !locked.includes(ids[i])) ? [i] : []);
}

export function battleStars(win, remaining, time, relaxed, used) {
  if (!win) return 0;
  if (relaxed) return used ? 1 : 2;
  return remaining >= time * .5 ? 3 : remaining >= time * .25 ? 2 : 1;
}

export function validStrategyRun(run) {
  const validStock = stock => stock && typeof stock === 'object' && !Array.isArray(stock) &&
    Object.entries(stock).every(([id, count]) => Object.hasOwn(STRATEGY_POOL, id) &&
      Number.isInteger(count) && count >= 0 && count <= 10);
  return run && Object.hasOwn(STRATEGY_POOL, run.grant) && typeof run.replay === 'boolean' &&
    validStock(run.opening) && validStock(run.stock) && run.opening[run.grant] > 0 &&
    strategyCount(run.opening) <= (run.replay ? 1 : 10) &&
    Object.entries(run.stock).every(([id, count]) => count <= (run.opening[id] || 0));
}
