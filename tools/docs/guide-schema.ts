export type GuideGroup = 'beatmaps' | 'collections' | 'replays' | 'skins' | 'keybindings'

export type KnownGuideApiTarget =
  | 'init'
  | 'OsuFilesAPI.beatmap'
  | 'OsuFilesAPI.beatmaps'
  | 'OsuFilesAPI.collections'
  | 'OsuFilesAPI.files'
  | 'OsuFilesAPI.keybindings'
  | 'OsuFilesAPI.osk'
  | 'OsuFilesAPI.osr'
  | 'OsuFilesAPI.osz'
  | 'OsuFilesAPI.scores'
  | 'OsuFilesAPI.sets'
  | 'OsuFilesAPI.skins'
  | 'Anchor'
  | 'BeatmapSetData'
  | 'Easing'
  | 'ImportedSkinData'
  | 'InputKey'
  | 'OsuBeatmap'
  | 'RulesetName'
  | 'Storyboard'
  | 'StoryboardCommandGroup'
  | 'StoryboardLayer'
  | 'StoryboardLoopingGroup'
  | 'StoryboardSprite'

export type GuideApiTarget = KnownGuideApiTarget | (string & {})

export interface GuideMetadata {
  /** Route and sidebar group for this example. */
  group: GuideGroup
  /** Heading for the group page. Set this on one example in the group. */
  groupTitle?: string
  /** Sidebar position for the group. Set this with groupTitle. */
  groupOrder?: number
  /** Description used on the group page and examples overview. */
  groupSummary?: string
  /** Heading shown for this example. */
  title: string
  /** Position of the example within its group. */
  order: number
  /** Short description shown below the example heading. */
  summary: string
  /** Public API entries linked below the generated example. */
  api?: readonly GuideApiTarget[]
}
