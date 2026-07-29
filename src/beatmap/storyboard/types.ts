export enum Anchor {
  TopLeft,
  TopCentre,
  TopRight,
  CentreLeft,
  Centre,
  CentreRight,
  BottomLeft,
  BottomCentre,
  BottomRight,
}

export type StoryboardLayerName =
  | 'Video'
  | 'Background'
  | 'Fail'
  | 'Pass'
  | 'Foreground'
  | 'Overlay'
  | (string & {})

export enum Easing {
  None,
  Out,
  In,
  InQuad,
  OutQuad,
  InOutQuad,
  InCubic,
  OutCubic,
  InOutCubic,
  InQuart,
  OutQuart,
  InOutQuart,
  InQuint,
  OutQuint,
  InOutQuint,
  InSine,
  OutSine,
  InOutSine,
  InExpo,
  OutExpo,
  InOutExpo,
  InCirc,
  OutCirc,
  InOutCirc,
  InElastic,
  OutElastic,
  OutElasticHalf,
  OutElasticQuarter,
  InOutElastic,
  InBack,
  OutBack,
  InOutBack,
  InBounce,
  OutBounce,
  InOutBounce,
  InPow10,
  OutPow10,
  InOutPow10,
}

/** How an animation plays back its frames. */
export enum LoopType {
  LoopForever,
  LoopOnce,
}

/** Storyboard command property types. */
export enum CommandType {
  Fade = 'F',
  MoveX = 'MX',
  MoveY = 'MY',
  Scale = 'S',
  VectorScale = 'V',
  Rotation = 'R',
  Colour = 'C',
  FlipH = 'P,H',
  FlipV = 'P,V',
  Blending = 'P,A',
}

/** Whether the element comes from the .osu file or a shared .osb. */
export type StoryboardElementSource = 'beatmap' | 'shared'

/** A trigger event name. */
export type TriggerName =
  | 'Passing'
  | 'Failing'
  | (string & {})

/** Blending mode for the P,A (Blending) command. */
export type BlendingMode = 'Inherit' | 'Additive'

export type Vec2 = { x: number; y: number }

export type Colour4 = { r: number; g: number; b: number }
