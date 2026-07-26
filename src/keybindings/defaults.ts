import type { KeyBindingDef } from './types.js'
import { GlobalAction, OsuAction, TaikoAction, CatchAction } from './types.js'

export const GLOBAL_DEFAULTS: KeyBindingDef[] = [
  { action: GlobalAction.SelectPrevious, keyCombination: 'Up' },
  { action: GlobalAction.SelectNext, keyCombination: 'Down' },
  { action: GlobalAction.Select, keyCombination: 'Space' },
  { action: GlobalAction.Select, keyCombination: 'Enter' },
  { action: GlobalAction.Select, keyCombination: 'KeypadEnter' },
  { action: GlobalAction.Back, keyCombination: 'Escape' },
  { action: GlobalAction.Back, keyCombination: 'ExtraMouseButton1' },
  { action: GlobalAction.Home, keyCombination: 'Alt + Home' },
  { action: GlobalAction.ToggleFPSDisplay, keyCombination: 'None' },
  { action: GlobalAction.ToggleToolbar, keyCombination: 'Control + T' },
  { action: GlobalAction.ToggleSkinEditor, keyCombination: 'Control + Shift + S' },
  { action: GlobalAction.ResetInputSettings, keyCombination: 'Control + Alt + R' },
  { action: GlobalAction.RandomSkin, keyCombination: 'Control + Shift + R' },
  { action: GlobalAction.PreviousSkin, keyCombination: 'Control + Shift + E' },
  { action: GlobalAction.NextSkin, keyCombination: 'Control + Shift + T' },
  { action: GlobalAction.ToggleGameplayMouseButtons, keyCombination: 'F10' },
  { action: GlobalAction.TakeScreenshot, keyCombination: 'F12' },
  { action: GlobalAction.ToggleChat, keyCombination: 'F8' },
  { action: GlobalAction.ToggleNowPlaying, keyCombination: 'F6' },
  { action: GlobalAction.ToggleSocial, keyCombination: 'F9' },
  { action: GlobalAction.ToggleBeatmapListing, keyCombination: 'Control + B' },
  { action: GlobalAction.ToggleSettings, keyCombination: 'Control + O' },
  { action: GlobalAction.ToggleNotifications, keyCombination: 'Control + N' },
  { action: GlobalAction.ToggleProfile, keyCombination: 'Control + P' },
  { action: GlobalAction.EditorComposeMode, keyCombination: 'F1' },
  { action: GlobalAction.EditorDesignMode, keyCombination: 'F2' },
  { action: GlobalAction.EditorTimingMode, keyCombination: 'F3' },
  { action: GlobalAction.EditorSetupMode, keyCombination: 'F4' },
  { action: GlobalAction.EditorVerifyMode, keyCombination: 'Control + Shift + A' },
  { action: GlobalAction.EditorCloneSelection, keyCombination: 'Control + D' },
  { action: GlobalAction.EditorNudgeLeft, keyCombination: 'J' },
  { action: GlobalAction.EditorNudgeRight, keyCombination: 'K' },
  { action: GlobalAction.EditorCycleGridSpacing, keyCombination: 'G' },
  { action: GlobalAction.EditorCycleGridType, keyCombination: 'Shift + G' },
  { action: GlobalAction.EditorTestGameplay, keyCombination: 'F5' },
  { action: GlobalAction.EditorTapForBPM, keyCombination: 'T' },
  { action: GlobalAction.EditorFlipHorizontally, keyCombination: 'Control + H' },
  { action: GlobalAction.EditorFlipVertically, keyCombination: 'Control + J' },
  { action: GlobalAction.EditorDecreaseDistanceSpacing, keyCombination: 'Control + Alt + MouseWheelDown' },
  { action: GlobalAction.EditorIncreaseDistanceSpacing, keyCombination: 'Control + Alt + MouseWheelUp' },
  { action: GlobalAction.EditorCyclePreviousBeatSnapDivisor, keyCombination: 'Control + MouseWheelDown' },
  { action: GlobalAction.EditorCycleNextBeatSnapDivisor, keyCombination: 'Control + MouseWheelUp' },
  { action: GlobalAction.EditorToggleMoveControl, keyCombination: 'None' },
  { action: GlobalAction.EditorToggleRotateControl, keyCombination: 'Control + R' },
  { action: GlobalAction.EditorToggleScaleControl, keyCombination: 'Control + E' },
  { action: GlobalAction.EditorSeekToPreviousHitObject, keyCombination: 'Control + Left' },
  { action: GlobalAction.EditorSeekToNextHitObject, keyCombination: 'Control + Right' },
  { action: GlobalAction.EditorSeekToPreviousSamplePoint, keyCombination: 'Control + Shift + Left' },
  { action: GlobalAction.EditorSeekToNextSamplePoint, keyCombination: 'Control + Shift + Right' },
  { action: GlobalAction.EditorAddBookmark, keyCombination: 'Control + B' },
  { action: GlobalAction.EditorRemoveClosestBookmark, keyCombination: 'Control + Shift + B' },
  { action: GlobalAction.EditorSeekToPreviousBookmark, keyCombination: 'Alt + Left' },
  { action: GlobalAction.EditorSeekToNextBookmark, keyCombination: 'Alt + Right' },
  { action: GlobalAction.EditorDiscardUnsavedChanges, keyCombination: 'Control + L' },
  { action: GlobalAction.EditorSubmitBeatmap, keyCombination: 'Control + Shift + U' },
  { action: GlobalAction.EditorEditExternally, keyCombination: 'Control + Shift + O' },
  { action: GlobalAction.EditorTestPlayToggleAutoplay, keyCombination: 'Tab' },
  { action: GlobalAction.EditorTestPlayToggleQuickPause, keyCombination: 'Control + P' },
  { action: GlobalAction.EditorTestPlayQuickExitToInitialTime, keyCombination: 'F1' },
  { action: GlobalAction.EditorTestPlayQuickExitToCurrentTime, keyCombination: 'F2' },
  { action: GlobalAction.SkipCutscene, keyCombination: 'Space' },
  { action: GlobalAction.SkipCutscene, keyCombination: 'ExtraMouseButton2' },
  { action: GlobalAction.QuickRetry, keyCombination: 'Tilde' },
  { action: GlobalAction.QuickRetry, keyCombination: 'Control + R' },
  { action: GlobalAction.QuickExit, keyCombination: 'Control + Tilde' },
  { action: GlobalAction.DecreaseScrollSpeed, keyCombination: 'F3' },
  { action: GlobalAction.IncreaseScrollSpeed, keyCombination: 'F4' },
  { action: GlobalAction.ToggleInGameInterface, keyCombination: 'Shift + Tab' },
  { action: GlobalAction.ToggleInGameLeaderboard, keyCombination: 'Tab' },
  { action: GlobalAction.PauseGameplay, keyCombination: 'MouseMiddle' },
  { action: GlobalAction.HoldForHUD, keyCombination: 'Control' },
  { action: GlobalAction.ToggleChatFocus, keyCombination: 'Enter' },
  { action: GlobalAction.SaveReplay, keyCombination: 'F1' },
  { action: GlobalAction.ExportReplay, keyCombination: 'F2' },
  { action: GlobalAction.IncreaseOffset, keyCombination: 'Plus' },
  { action: GlobalAction.DecreaseOffset, keyCombination: 'Minus' },
  { action: GlobalAction.TogglePauseReplay, keyCombination: 'Space' },
  { action: GlobalAction.TogglePauseReplay, keyCombination: 'MouseMiddle' },
  { action: GlobalAction.FastForwardReplay, keyCombination: 'Shift' },
  { action: GlobalAction.SeekReplayBackward, keyCombination: 'Left' },
  { action: GlobalAction.SeekReplayForward, keyCombination: 'Right' },
  { action: GlobalAction.StepReplayBackward, keyCombination: 'Comma' },
  { action: GlobalAction.StepReplayForward, keyCombination: 'Period' },
  { action: GlobalAction.ToggleReplaySettings, keyCombination: 'Control + H' },
  { action: GlobalAction.ActivatePreviousSet, keyCombination: 'Left' },
  { action: GlobalAction.ActivateNextSet, keyCombination: 'Right' },
  { action: GlobalAction.ExpandPreviousGroup, keyCombination: 'Shift + Left' },
  { action: GlobalAction.ExpandNextGroup, keyCombination: 'Shift + Right' },
  { action: GlobalAction.ToggleCurrentGroup, keyCombination: 'Shift + Enter' },
  { action: GlobalAction.ToggleModSelection, keyCombination: 'F1' },
  { action: GlobalAction.SelectNextRandom, keyCombination: 'F2' },
  { action: GlobalAction.SelectPreviousRandom, keyCombination: 'Shift + F2' },
  { action: GlobalAction.ToggleBeatmapOptions, keyCombination: 'F3' },
  { action: GlobalAction.DeselectAllMods, keyCombination: 'BackSpace' },
  { action: GlobalAction.IncreaseModSpeed, keyCombination: 'Control + Up' },
  { action: GlobalAction.DecreaseModSpeed, keyCombination: 'Control + Down' },
  { action: GlobalAction.AbsoluteScrollSongList, keyCombination: 'None' },
  { action: GlobalAction.IncreaseVolume, keyCombination: 'Alt + Up' },
  { action: GlobalAction.DecreaseVolume, keyCombination: 'Alt + Down' },
  { action: GlobalAction.PreviousVolumeMeter, keyCombination: 'Alt + Left' },
  { action: GlobalAction.NextVolumeMeter, keyCombination: 'Alt + Right' },
  { action: GlobalAction.ToggleMute, keyCombination: 'Control + F4' },
  { action: GlobalAction.MusicPrev, keyCombination: 'TrackPrevious' },
  { action: GlobalAction.MusicPrev, keyCombination: 'F1' },
  { action: GlobalAction.MusicNext, keyCombination: 'TrackNext' },
  { action: GlobalAction.MusicNext, keyCombination: 'F5' },
  { action: GlobalAction.MusicPlay, keyCombination: 'PlayPause' },
  { action: GlobalAction.MusicPlay, keyCombination: 'F3' },
]

export const OSU_DEFAULTS: KeyBindingDef[] = [
  { action: OsuAction.LeftButton, keyCombination: 'Z' },
  { action: OsuAction.LeftButton, keyCombination: 'MouseLeft' },
  { action: OsuAction.RightButton, keyCombination: 'X' },
  { action: OsuAction.RightButton, keyCombination: 'MouseRight' },
  { action: OsuAction.Smoke, keyCombination: 'C' },
]

export const TAIKO_DEFAULTS: KeyBindingDef[] = [
  { action: TaikoAction.LeftRim, keyCombination: 'D' },
  { action: TaikoAction.LeftRim, keyCombination: 'MouseRight' },
  { action: TaikoAction.LeftCentre, keyCombination: 'F' },
  { action: TaikoAction.LeftCentre, keyCombination: 'MouseLeft' },
  { action: TaikoAction.RightCentre, keyCombination: 'J' },
  { action: TaikoAction.RightCentre, keyCombination: 'None' },
  { action: TaikoAction.RightRim, keyCombination: 'K' },
  { action: TaikoAction.RightRim, keyCombination: 'None' },
]

export const CATCH_DEFAULTS: KeyBindingDef[] = [
  { action: CatchAction.MoveLeft, keyCombination: 'Z' },
  { action: CatchAction.MoveLeft, keyCombination: 'Left' },
  { action: CatchAction.MoveRight, keyCombination: 'X' },
  { action: CatchAction.MoveRight, keyCombination: 'Right' },
  { action: CatchAction.Dash, keyCombination: 'Shift' },
  { action: CatchAction.Dash, keyCombination: 'MouseLeft' },
]

const MANIA_LEFT_KEYS = ['A', 'S', 'D', 'F']
const MANIA_LEFT_KEYS_10K = ['A', 'S', 'D', 'F', 'V']
const MANIA_RIGHT_KEYS = ['J', 'K', 'L', 'Semicolon']
const MANIA_RIGHT_KEYS_10K = ['N', 'J', 'K', 'L', 'Semicolon']
const MANIA_SPECIAL = 'Space'

function generateManiaKeys(variant: number): string[] {
  const cols = variant
  const left = variant === 10 ? MANIA_LEFT_KEYS_10K : MANIA_LEFT_KEYS
  const right = variant === 10 ? MANIA_RIGHT_KEYS_10K : MANIA_RIGHT_KEYS
  const half = Math.floor(cols / 2)
  const keys: string[] = []
  for (let i = left.length - half; i < left.length; i++) keys.push(left[i])
  if (cols % 2 === 1) keys.push(MANIA_SPECIAL)
  for (let i = 0; i < half; i++) keys.push(right[i])
  return keys
}

export function getManiaDefaults(variant: number): KeyBindingDef[] {
  const keys = generateManiaKeys(variant)
  const result: KeyBindingDef[] = []
  for (let action = 0; action < keys.length; action++) {
    result.push({ action, keyCombination: keys[action] })
    result.push({ action, keyCombination: 'None' })
  }
  return result
}
