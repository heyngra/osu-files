// Reference implementations (osu!lazer C# source):
// See: https://github.com/ppy/osu/blob/master/osu.Game/Database/StandardisedScoreMigrationTools.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Difficulty/OsuLegacyScoreSimulator.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game/Rulesets/Objects/SliderEventGenerator.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game/Rulesets/Objects/Legacy/LegacyRulesetExtensions.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game/Rulesets/Scoring/ScoreProcessor.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game/Scoring/ScoreInfo.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game/Scoring/Legacy/LegacyScoreDecoder.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Scoring/OsuScoreMultiplierCalculatorV2.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game/Beatmaps/WorkingBeatmap.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Mods/OsuModClassic.cs
// See: https://github.com/ppy/osu/blob/master/osu.Game.Rulesets.Osu/Objects/Slider.cs
// See: https://github.com/ppy/osu-queue-score-statistics/blob/master/osu.Server.Queues.ScoreStatisticsProcessor/Helpers/BatchInserter.cs

import type { OsuBeatmap, TimingPoint, HitSlider, HitSpinner } from '../beatmap/types.js'
import type { BeatmapDifficulty as LegacyBeatmapDifficulty } from '../schema/types.js'

const MAX_COMBO_PORTION = 500000
const MAX_ACCURACY_PORTION = 500000
const COMBO_EXPONENT = 0.5

// C# Math.Round uses round-half-to-even (banker's rounding).
/**
 * Banker's rounding (round-half-to-even). JS Math.round uses round-half-up.
 * @returns Rounded value (banker's rounding).
 * @example
 * roundHalfEven(2.5) // 2
 */
export function roundHalfEven(n: number): number {
  const abs = Math.abs(n)
  const sign = Math.sign(n)
  const int = Math.floor(abs)
  const frac = abs - int
  if (frac < 0.5) return sign * int
  if (frac > 0.5) return sign * (int + 1)
  return int % 2 === 0 ? sign * int : sign * (int + 1)
}

/** Attributes computed by the legacy score simulator. */
export type LegacyScoreAttributes = {
  AccuracyScore: number
  ComboScore: number
  BonusScoreRatio: number
  BonusScore: number
  MaxCombo: number
  ScoreMultiplier: number
}

/** Difficulty info required for legacy score conversion. */
export type LegacyBeatmapConversionDifficultyInfo = {
  DrainRate: number
  ApproachRate: number
  CircleSize: number
  OverallDifficulty: number
  EndTimeObjectCount: number
  TotalObjectCount: number
}

type BonusAccum = { legacy: number; standardised: number }

// C# uses decimal (28-digit) to emulate x87 80-bit FPU.
// See: https://github.com/ppy/osu/commit/7c9adc7ad3
function difficultyPeppyStars(diff: LegacyBeatmapDifficulty, objectCount: number, drainLength: number): number {
  const objectToDrainRatio = drainLength !== 0
    ? Math.max(0, Math.min(16, (objectCount * 8) / drainLength))
    : 16
  return roundHalfEven((diff.DrainRate + diff.OverallDifficulty + diff.CircleSize + objectToDrainRatio) / 38 * 5)
}

function simulateCircle(attrs: LegacyScoreAttributes, sm: number, c: number) {
  attrs.ComboScore += Math.max(0, c - 1) * ((300 / 25) | 0) * sm
  attrs.AccuracyScore += 300
}

function findTimingPointAt(points: TimingPoint[], time: number): TimingPoint | null {
  let best: TimingPoint | null = null
  for (const tp of points) {
    if (tp.uninherited && tp.time <= time + 1) best = tp
  }
  return best
}

function simulateSlider(
  obj: { extras: { pixelLength: number; repeats: number } },
  attrs: LegacyScoreAttributes,
  sm: number,
  diff: LegacyBeatmapDifficulty,
  combo: number,
  startTime: number,
  timingPoints: TimingPoint[],
  fileFormat: number,
): number {
  const { pixelLength, repeats } = obj.extras
  // C# ConvertHitObjectParser always subtracts 1 from .osu repeat field:
  //   int repeatCount = Parsing.ParseInt(split[6]); repeatCount = Math.Max(0, repeatCount - 1);
  // The .osu stores total passes (repeatCount+1). SpanCount = RepeatCount + 1 = raw value.
  const spanCount = repeats

  const tp = findTimingPointAt(timingPoints, startTime)
  let beatLength = tp ? tp.beatLength : 333.33

  let velocityMultiplier = 1
  for (const tp2 of timingPoints) {
    if (tp2.time <= startTime + 1) {
      if (tp2.uninherited) {
        beatLength = tp2.beatLength
        velocityMultiplier = 1
      } else {
        velocityMultiplier = 100 / tp2.beatLength
      }
    }
  }

  // C# Velocity uses GetPrecisionAdjustedBeatLength:
  //   bpmMultiplier = Math.Clamp(-sliderVelocityAsBeatLength, 10, 1000) / 100
  //   sliderVelocityAsBeatLength = -100 / SliderVelocityMultiplier
  const raw = Math.abs(-100 / velocityMultiplier)
  const clamped = Math.max(10, Math.min(1000, raw))
  const bpmMult = clamped / 100
  // C# Slider.Velocity is BASE_SCORING_DISTANCE * SM / adjustedBeatLength; no clockRate.
  // The C# OsuLegacyScoreSimulator does not multiply by clockRate either.
  const velocity = 100 * diff.SliderMultiplier / (beatLength * bpmMult)

  // C# scoringDistance = 100 * SM * speedAdjustedBL / timingPoint.BL
  //   speedAdjustedBL = beatLength * velocityMultiplier (unclamped)
  //   tickDistance = scoringDistance / tickRate = 100 * SM * velocityMultiplier / tickRate
  let tickDistance = 100 * diff.SliderMultiplier * velocityMultiplier / diff.SliderTickRate

  // C# OsuBeatmapConverter: when BeatmapVersion < 8,
  // TickDistanceMultiplier = 1 / controlPoint.DifficultyPoint.SliderVelocity
  if (fileFormat < 8 && velocityMultiplier !== 0) {
    tickDistance /= velocityMultiplier
  }
  const minDistanceFromEnd = velocity * 10

  let ticksPerSpan = 0
  if (tickDistance > 0) {
    for (let d = tickDistance; d <= pixelLength + 1e-9; d += tickDistance) {
      if (d >= pixelLength - minDistanceFromEnd - 1e-9) break
      ticksPerSpan++
    }
  }

  attrs.AccuracyScore += 30; combo++

  for (let span = 0; span < spanCount; span++) {
    for (let t = 0; t < ticksPerSpan; t++) {
      attrs.AccuracyScore += 10; combo++
    }
    if (span < spanCount - 1) {
      attrs.AccuracyScore += 30; combo++
    }
  }

  attrs.AccuracyScore += 30; combo++
  attrs.AccuracyScore += 300
  attrs.ComboScore += Math.max(0, combo - 1) * ((300 / 25) | 0) * sm
  return combo
}

function simulateSpinner(
  obj: { time: number; extras: { endTime: number } },
  attrs: LegacyScoreAttributes,
  sm: number,
  combo: number,
  bonus: BonusAccum,
): number {
  const MAXIMUM_ROTATIONS_PER_SECOND = 477.0 / 60
  const MINIMUM_ROTATIONS_PER_SECOND = 3
  const duration = obj.extras.endTime - obj.time
  const secDuration = duration / 1000

  const totalHalfSpinsPossible = Math.floor(secDuration * MAXIMUM_ROTATIONS_PER_SECOND * 2)
  const halfSpinsRequiredForCompletion = Math.floor(secDuration * MINIMUM_ROTATIONS_PER_SECOND)
  const halfSpinsRequiredBeforeBonus = halfSpinsRequiredForCompletion + 3

  for (let i = 0; i <= totalHalfSpinsPossible; i++) {
    if (i > halfSpinsRequiredBeforeBonus && (i - halfSpinsRequiredBeforeBonus) % 2 === 0) {
      bonus.legacy += 1100; bonus.standardised += 50
    } else if (i > 1 && i % 2 === 0) {
      bonus.legacy += 100; bonus.standardised += 10
    }
  }

  attrs.AccuracyScore += 300
  attrs.ComboScore += Math.max(0, combo - 1) * ((300 / 25) | 0) * sm
  return combo + 1
}

/**
 * Simulates legacy score attributes from a beatmap and difficulty settings.
 * @returns Simulated legacy score attributes.
 * @example
 * computeLegacyScoreAttributes(osuBeatmap, diff, ['HD', 'DT']) // LegacyScoreAttributes
 */
export function computeLegacyScoreAttributes(
  beatmap: OsuBeatmap,
  diff: LegacyBeatmapDifficulty,
  _modAcronyms: string[],
): LegacyScoreAttributes {
  let countNormal = 0, countSlider = 0, countSpinner = 0
  for (const obj of beatmap.hitObjects) {
    switch (obj.objectType) {
      case 'circle': countNormal++; break
      case 'slider': countSlider++; break
      case 'spinner': countSpinner++; break
    }
  }

  const objectCount = countNormal + countSlider + countSpinner

  let drainLength = 0
  let breakLength = 0
  if (beatmap.hitObjects.length > 0) {
    for (const ev of beatmap.events) {
      if (ev.type === 'break' && ev.startTime !== undefined && ev.endTime !== undefined) {
        breakLength += roundHalfEven(ev.endTime) - roundHalfEven(ev.startTime)
      }
    }
    const firstT = roundHalfEven(beatmap.hitObjects[0].time)
    const lastT = roundHalfEven(beatmap.hitObjects[beatmap.hitObjects.length - 1].time)
    drainLength = Math.trunc((lastT - firstT - breakLength) / 1000)
  }

  const sm = difficultyPeppyStars(diff, objectCount, drainLength)
  const attrs: LegacyScoreAttributes = { AccuracyScore: 0, ComboScore: 0, BonusScoreRatio: 0, BonusScore: 0, MaxCombo: 0, ScoreMultiplier: sm }
  const bonus: BonusAccum = { legacy: 0, standardised: 0 }
  let combo = 0

  for (const obj of beatmap.hitObjects) {
    switch (obj.objectType) {
      case 'circle':
        simulateCircle(attrs, sm, combo)
        combo++
        break
      case 'slider':
        combo = simulateSlider(obj as HitSlider, attrs, sm, diff, combo, obj.time, beatmap.timingPoints, beatmap.fileFormat)
        break
      case 'spinner':
        combo = simulateSpinner(obj as HitSpinner, attrs, sm, combo, bonus)
        break
    }
  }

  attrs.BonusScoreRatio = bonus.legacy === 0 ? 0 : bonus.standardised / bonus.legacy
  attrs.BonusScore = bonus.legacy
  attrs.MaxCombo = combo
  return attrs
}

/**
 * Computes the legacy score multiplier from a list of mod acronyms.
 * @returns Score multiplier (0 disables scoring).
 * @example
 * getLegacyScoreMultiplier(['HD', 'DT']) // 1.1872
 */
export function getLegacyScoreMultiplier(
  modAcronyms: string[],
): number {
  const scoreV2 = modAcronyms.includes('SV2')
  let multiplier = 1

  for (const mod of modAcronyms) {
    switch (mod) {
      case 'NF': multiplier *= scoreV2 ? 1.0 : 0.5; break
      case 'EZ': multiplier *= 0.5; break
      case 'HT': case 'DC': multiplier *= 0.3; break
      case 'HD': multiplier *= 1.06; break
      case 'HR': multiplier *= scoreV2 ? 1.10 : 1.06; break
      case 'DT': case 'NC': multiplier *= scoreV2 ? 1.20 : 1.12; break
      case 'FL': multiplier *= 1.12; break
      case 'SO': multiplier *= 0.9; break
      case 'RX': case 'AP': return 0
    }
  }

  return multiplier
}

/**
 * Converts a legacy total score to standardised score format.
 * @returns Standardised score (with and without mods).
 * @example
 * convertFromLegacyTotalScore(1000000, 0.97, 500, 0, ['HD'], attributes) // { totalScoreWithoutMods: ..., totalScore: ... }
 */
export function convertFromLegacyTotalScore(
  legacyTotalScore: number,
  accuracy: number,
  maxCombo: number,
  missCount: number,
  modAcronyms: string[],
  attributes: LegacyScoreAttributes,
  count300?: number,
  count100?: number,
  count50?: number,
): { totalScoreWithoutMods: number; totalScore: number } {
  const legacyModMultiplier = getLegacyScoreMultiplier(modAcronyms)

  const maximumLegacyAccuracyScore = attributes.AccuracyScore
  const maximumLegacyComboScore = roundHalfEven(attributes.ComboScore * legacyModMultiplier)
  const maximumLegacyBonusRatio = attributes.BonusScoreRatio
  const maximumLegacyBonusScore = attributes.BonusScore

  const legacyAccScore = maximumLegacyAccuracyScore * accuracy

  const maxComboPlusBonus = maximumLegacyComboScore + maximumLegacyBonusScore
  const comboProportion = maxComboPlusBonus > 0
    ? Math.max((legacyTotalScore - legacyAccScore) / maxComboPlusBonus, 0)
    : (legacyModMultiplier === 0 ? 0 : 1)

  const maximumLegacyBaseScore = maximumLegacyAccuracyScore + maximumLegacyComboScore
  const bonusProportion = Math.max(0, (legacyTotalScore - maximumLegacyBaseScore) * maximumLegacyBonusRatio)

  const accuracyPortion = count300 != null && count100 != null && count50 != null && missCount != null
    ? computeAccuracyPortion(count300, count100, count50, missCount)
    : roundHalfEven(MAX_ACCURACY_PORTION * Math.pow(accuracy, 5))

  let convertedTotalScoreWithoutMods: number

  if (maxCombo === 0 || accuracy === 0) {
    convertedTotalScoreWithoutMods = roundHalfEven(
      0 + accuracyPortion + bonusProportion,
    )
  } else if (maxComboPlusBonus === 0) {
    convertedTotalScoreWithoutMods = roundHalfEven(
      MAX_COMBO_PORTION * comboProportion
      + accuracyPortion
      + bonusProportion,
    )
  } else {
    const maximumLegacyCombo = attributes.MaxCombo

    const maximumAchievableComboPortionInScoreV1 = Math.pow(maximumLegacyCombo, 2)
    const maximumAchievableComboPortionInStandardisedScore = Math.pow(maximumLegacyCombo, 1 + COMBO_EXPONENT)

    const comboPortionFromLongestComboInScoreV1 = Math.pow(maxCombo, 2)
    const comboPortionFromLongestComboInStandardisedScore = Math.pow(maxCombo, 1 + COMBO_EXPONENT)

    const comboPortionInScoreV1 = Math.max(
      maximumAchievableComboPortionInScoreV1 * comboProportion / accuracy,
      comboPortionFromLongestComboInScoreV1,
    )

    const maximumOccurrencesOfLongestCombo = Math.floor(
      comboPortionInScoreV1 / comboPortionFromLongestComboInScoreV1,
    )
    const comboPortionFromRepeatedLongestCombosInScoreV1 = maximumOccurrencesOfLongestCombo * comboPortionFromLongestComboInScoreV1
    const remainingComboPortionInScoreV1 = comboPortionInScoreV1 - comboPortionFromRepeatedLongestCombosInScoreV1

    const remainingCombo = Math.sqrt(remainingComboPortionInScoreV1)
    const remainingComboPortionInStandardisedScore = Math.pow(remainingCombo, 1 + COMBO_EXPONENT)

    const scoreBasedEstimate = maximumOccurrencesOfLongestCombo * comboPortionFromLongestComboInStandardisedScore
      + remainingComboPortionInStandardisedScore

    let remainingComboPortionInScoreV1_2 = comboPortionInScoreV1 - comboPortionFromLongestComboInScoreV1
    const remainingCountOfObjectsGivingCombo = maximumLegacyCombo - maxCombo - missCount

    const lengthOfRemainingCombos = remainingCountOfObjectsGivingCombo > 0
      ? remainingComboPortionInScoreV1_2 / remainingCountOfObjectsGivingCombo
      : 0

    const remainingComboPortionInStandardisedScore2 = remainingCountOfObjectsGivingCombo * Math.pow(lengthOfRemainingCombos, COMBO_EXPONENT)

    const objectCountBasedEstimate = comboPortionFromLongestComboInStandardisedScore
      + remainingComboPortionInStandardisedScore2

    const clampedScore = Math.max(0, Math.min(scoreBasedEstimate, maximumAchievableComboPortionInStandardisedScore))
    const clampedObject = Math.max(0, Math.min(objectCountBasedEstimate, maximumAchievableComboPortionInStandardisedScore))

    const lowerEstimate = Math.min(clampedScore, clampedObject)
    const upperEstimate = Math.max(clampedScore, clampedObject)

    const estimatedComboPortionInStandardisedScore = Math.min(
      0.3 * lowerEstimate + 0.7 * upperEstimate,
      1.2 * (lowerEstimate + upperEstimate) / 2,
    )

    const newComboScoreProportion = estimatedComboPortionInStandardisedScore / maximumAchievableComboPortionInStandardisedScore

    convertedTotalScoreWithoutMods = roundHalfEven(
      MAX_COMBO_PORTION * newComboScoreProportion * accuracy
      + accuracyPortion
      + bonusProportion,
    )
  }

  const modMultiplier = getStandardisedModMultiplier(modAcronyms)
  const convertedTotalScore = roundHalfEven(convertedTotalScoreWithoutMods * modMultiplier)

  return { totalScoreWithoutMods: convertedTotalScoreWithoutMods, totalScore: convertedTotalScore }
}

function computeAccuracyPortion(count300: number, count100: number, count50: number, countMiss: number): number {
  const num = BigInt(300 * count300 + 100 * count100 + 50 * count50)
  const den = BigInt(300 * (count300 + count100 + count50 + countMiss))
  const num5 = num ** 5n
  const den5 = den ** 5n
  const q = 500000n * num5 / den5
  const r = 500000n * num5 % den5
  if (2n * r > den5 || (2n * r === den5 && q % 2n === 1n)) return Number(q + 1n)
  return Number(q)
}

const MOD_SCORE_MULTIPLIER_V2: Record<string, number> = {
  NF: 0.5, EZ: 0.8, TD: 1, HD: 1.04, HR: 1.09, SD: 1, DT: 1.23,
  RX: 0.1, HT: 0.55, NC: 1.23, FL: 1.2, AU: 1, SO: 0.95, AP: 0.1,
  PF: 1, CL: 0.985, SV2: 1, MR: 1, RD: 0.7,
}

function getStandardisedModMultiplier(modAcronyms: string[]): number {
  let m = 1
  for (const mod of modAcronyms) {
    const v = MOD_SCORE_MULTIPLIER_V2[mod]
    if (v !== undefined) m *= v
  }
  return m
}
