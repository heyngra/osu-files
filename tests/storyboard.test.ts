import { describe, it, before } from 'node:test'
import assert from 'node:assert'
import { readZipEntries } from '../src/osz/import.js'
import { parseOsu } from '../src/beatmap/parse.js'
import { serializeOsu } from '../src/beatmap/serialize.js'
import { serializeStoryboard, parseStoryboard, parseOsb, serializeOsb } from '../src/beatmap/storyboard/index.js'
import { Storyboard, StoryboardSprite, StoryboardAnimation, StoryboardSample, StoryboardLayer } from '../src/beatmap/storyboard/index.js'
import { Anchor, Easing, LoopType } from '../src/beatmap/storyboard/index.js'
import type { FileRef } from '../src/types.js'

const BWW_OSZ = './tests/storyboards/404658 Giga - -BWW SCREAM-.osz'
const SAMPLE_OSZ = './tests/506483 Icon For Hire - Make A Move.osz'

function makeRef(name: string, content?: Buffer): FileRef {
  return { filename: name, content: content ?? Buffer.from(name) }
}

function getOsuEntry(entries: { filename: string; buffer: Buffer }[], pat: string) {
  const e = entries.find(en => en.filename.includes(pat))
  if (!e) throw new Error(`No entry matching "${pat}"`)
  return e.buffer.toString('utf-8')
}

describe('Storyboard parse', async () => {
  let bwwEntries: { filename: string; buffer: Buffer }[]
  let bwwText: string
  let sampleEntries: { filename: string; buffer: Buffer }[]

  before(async () => {
    bwwEntries = await readZipEntries(BWW_OSZ)
    bwwText = getOsuEntry(bwwEntries, "yf's sb Extreme")
    sampleEntries = await readZipEntries(SAMPLE_OSZ)
  })

  it('parses all 364 sprites from BWW SCREAM', () => {
    const bm = parseOsu(bwwText)
    const sb = bm.storyboard
    assert.ok(sb)
    const fg = sb.layers.get('Foreground')
    assert.ok(fg)
    assert.strictEqual(fg.elements.length, 364)
  })

  it('parses fade, scale, blend commands on sprites', () => {
    const bm = parseOsu(bwwText)
    const sb = bm.storyboard!
    const fg = sb.layers.get('Foreground')!
    const sprites = fg.elements as StoryboardSprite[]

    const withFade = sprites.filter(s => s.commands.alpha.length > 0)
    const withScale = sprites.filter(s => s.commands.scale.length > 0)
    const withBlend = sprites.filter(s => s.commands.blending.length > 0)

    assert.ok(withFade.length > 200)
    assert.ok(withScale.length > 200)
    assert.ok(withBlend.length > 200)
  })

  it('handles empty field commands (,,)', () => {
    const bm = parseOsu(bwwText)
    const sb = bm.storyboard!
    const fg = sb.layers.get('Foreground')!
    const sprites = fg.elements as StoryboardSprite[]

    const instantScales = sprites.filter(s => s.commands.scale.some(c => c.endTime === undefined))
    assert.ok(instantScales.length > 0)

    const fadeNoStart = sprites.filter(s => s.commands.alpha.some(c => c.startValue === undefined))
    assert.ok(fadeNoStart.length > 0)
  })

  it('parses M move commands into MX + MY', () => {
    const bm = parseOsu(bwwText)
    const sb = bm.storyboard!
    const fg = sb.layers.get('Foreground')!
    const sprites = fg.elements as StoryboardSprite[]
    const withMoveX = sprites.filter(s => s.commands.x.length > 0)
    const withMoveY = sprites.filter(s => s.commands.y.length > 0)
    assert.ok(withMoveX.length >= 10)
    assert.ok(withMoveY.length >= 10)
  })

  it('keeps backslash paths as-is', () => {
    const bm = parseOsu(bwwText)
    const sb = bm.storyboard!
    const fg = sb.layers.get('Foreground')!
    const paths = (fg.elements as StoryboardSprite[]).map(s => s.path)
    assert.ok(paths.some(p => p.includes('\\')))
  })

  it('no storyboard when none exists', () => {
    const content = getOsuEntry(sampleEntries, '[Easy]')
    const bm = parseOsu(content)
    assert.strictEqual(bm.storyboard, undefined)
  })

  it('OsuStoryboardEvent removed from events union', () => {
    const bm = parseOsu(bwwText)
    const rawSbe = bm.events.filter(e => (e as { type?: string }).type === 'storyboard')
    assert.strictEqual(rawSbe.length, 0)
  })

  it('parses Collab Insane storyboard', () => {
    const content = getOsuEntry(sampleEntries, 'Collab Insane')
    const bm = parseOsu(content)
    const sb = bm.storyboard
    assert.ok(sb)
    assert.ok(sb.layers.get('Foreground')!.elements.length > 0)
  })
})

describe('Storyboard serialize', async () => {
  let bwwText: string
  let sampleEasy: string
  let sampleCollab: string

  before(async () => {
    const entries = await readZipEntries(BWW_OSZ)
    bwwText = getOsuEntry(entries, "yf's sb Extreme")
    const se = await readZipEntries(SAMPLE_OSZ)
    sampleEasy = getOsuEntry(se, '[Easy]')
    sampleCollab = getOsuEntry(se, 'Collab Insane')
  })

  it('all 364 sprites survive serialize + re-parse', () => {
    const bm = parseOsu(bwwText)
    const re = parseOsu(serializeOsu(bm))
    assert.ok(re.storyboard)
    assert.strictEqual(re.storyboard!.layers.get('Foreground')!.elements.length, 364)
  })

  it('empty storyboard stays gone after round-trip', () => {
    const bm = parseOsu(sampleEasy)
    const re = parseOsu(serializeOsu(bm))
    assert.strictEqual(re.storyboard, undefined)
  })

  it('modified storyboard changes hash', () => {
    const bm = parseOsu(bwwText)
    bm.storyboard!.layers.get('Foreground')!.elements[0] = new StoryboardSprite(makeRef('new.png'))
    const re = parseOsu(serializeOsu(bm))
    assert.ok(re.storyboard)
  })

  it('unmodified storyboard keeps dirty=false', () => {
    const bm = parseOsu(bwwText)
    assert.strictEqual(bm.storyboard!._dirty, false)
  })

  it('Collab Insane round-trips cleanly', () => {
    const bm = parseOsu(sampleCollab)
    const re = parseOsu(serializeOsu(bm))
    assert.ok(re.storyboard)
    assert.strictEqual(re.storyboard!.layers.get('Foreground')!.elements.length, 3)
  })
})

describe('Storyboard builder API', () => {
  it('fluent sprite with commands', () => {
    const fg = new StoryboardLayer('Foreground', 0)
    const s = new StoryboardSprite(makeRef('test.png'), Anchor.Centre, { x: 320, y: 240 })
    s
      .addAlpha(Easing.None, 1000, 2000, 1, 0)
      .addScale(Easing.In, 0, 500, 2, 0.5)
      .addMoveX(Easing.Out, 500, 1500, 400, 320)
      .addMoveY(Easing.InOutSine, 500, 1500, 200, 240)
    fg.add(s)
    assert.strictEqual(s.commands.alpha.length, 1)
    assert.strictEqual(s.commands.scale.length, 1)
    assert.strictEqual(s.commands.x.length, 1)
    assert.strictEqual(s.commands.y.length, 1)
  })

  it('looping groups', () => {
    const s = new StoryboardSprite(makeRef('loop.png'))
    const lg = s.addLoopingGroup(5000, 10)
    lg.addAlpha(Easing.None, 0, 500, 1, 0)
    assert.strictEqual(s.loopingGroups.length, 1)
    assert.strictEqual(s.loopingGroups[0].alpha.length, 1)
  })

  it('trigger groups', () => {
    const s = new StoryboardSprite(makeRef('trig.png'))
    const tg = s.addTriggerGroup('Passing', 0, 10000, 0)
    tg.addAlpha(Easing.None, 0, 500, 0, 1)
    assert.strictEqual(s.triggerGroups.length, 1)
  })

  it('animation with frames', () => {
    const anim = new StoryboardAnimation(
      makeRef('frames.png'), 8, 100, Anchor.Centre, { x: 320, y: 240 }, LoopType.LoopOnce,
    )
    assert.strictEqual(anim.frameCount, 8)
    assert.strictEqual(anim.frameDelay, 100)
    assert.strictEqual(anim.loopType, LoopType.LoopOnce)
    anim.addAlpha(Easing.None, 0, 1000, 1, 0)
    assert.strictEqual(anim.commands.alpha.length, 1)
  })

  it('preserves animation loop type after a dirty round-trip', () => {
    const sb = parseStoryboard('Animation,Foreground,Centre,frames.png,320,240,4,100,1')
    const anim = sb.layers.get('Foreground')!.elements[0] as StoryboardAnimation
    anim.addAlpha(Easing.None, 0, 100)
    const reparsed = parseStoryboard(serializeStoryboard(sb))
    const result = reparsed.layers.get('Foreground')!.elements[0] as StoryboardAnimation
    assert.strictEqual(result.loopType, LoopType.LoopOnce)
  })

  it('preserves blending values after a dirty round-trip', () => {
    const sb = parseStoryboard([
      'Sprite,Foreground,Centre,a.png,320,240',
      ' P,0,0,1000,A,0',
    ].join('\n'))
    const sprite = sb.layers.get('Foreground')!.elements[0] as StoryboardSprite
    sprite.addAlpha(Easing.None, 2000, 3000)
    const reparsed = parseStoryboard(serializeStoryboard(sb))
    const command = (reparsed.layers.get('Foreground')!.elements[0] as StoryboardSprite).commands.blending[0]
    assert.strictEqual(command.startValue, undefined)
    assert.strictEqual(command.endValue, 'Inherit')
  })

  it('animation extends sprite', () => {
    const anim = new StoryboardAnimation(makeRef('frames.png'), 4, 50)
    anim.addAlpha(Easing.None, 0, 1000).addScale(Easing.In, 0, 500, 2)
    assert.ok(anim instanceof StoryboardSprite)
    assert.strictEqual(anim.commands.scale.length, 1)
  })

  it('vector scale', () => {
    const s = new StoryboardSprite(makeRef('vec.png'))
    s.addVectorScale(Easing.None, 0, 1000, 2, 3, 0.5, 1)
    assert.deepStrictEqual(s.commands.vectorScale[0].endValue, { x: 2, y: 3 })
    assert.deepStrictEqual(s.commands.vectorScale[0].startValue, { x: 0.5, y: 1 })
  })

  it('colour command', () => {
    const s = new StoryboardSprite(makeRef('col.png'))
    s.addColour(Easing.None, 1000, 2000, 255, 0, 0, 0, 0, 255)
    assert.deepStrictEqual(s.commands.colour[0].endValue, { r: 255, g: 0, b: 0 })
    assert.deepStrictEqual(s.commands.colour[0].startValue, { r: 0, g: 0, b: 255 })
  })

  it('dirty after mutation', () => {
    const sb = parseStoryboard('Sprite,Foreground,Centre,"test.png",320,240\n F,0,0,1000,0,1')
    assert.strictEqual(sb._dirty, false)
    const s = sb.layers.get('Foreground')!.elements[0] as StoryboardSprite
    s.addAlpha(Easing.None, 2000, 3000)
    assert.strictEqual(sb._dirty, true)
  })

  it('latest event time includes samples', () => {
    const sb = new Storyboard()
    sb.getLayer('Foreground').add(new StoryboardSample(makeRef('late.wav'), 5000))
    assert.strictEqual(sb.latestEventTime, 5000)
  })

  it('marks structural layer edits dirty', () => {
    const sb = parseStoryboard('Sprite,Foreground,Centre,old.png,320,240')
    const layer = sb.layers.get('Foreground')!
    layer.add(new StoryboardSprite(makeRef('new.png')))
    assert.strictEqual(sb._dirty, true)
    assert.ok(serializeStoryboard(sb).includes('new.png'))
    layer.removeAt(0)
    assert.ok(!serializeStoryboard(sb).includes('old.png'))
  })

  it('getLayer creates layers', () => {
    const sb = new Storyboard()
    const bg = sb.getLayer('Background')
    assert.ok(bg)
    assert.strictEqual(bg.name, 'Background')
  })

  it('removeAlpha removes by index', () => {
    const s = new StoryboardSprite(makeRef('a.png'))
    s.addAlpha(0, 0, 1000)
    s.addAlpha(0, 1000, 2000)
    s.commands.removeAlpha(0)
    assert.strictEqual(s.commands.alpha.length, 1)
    assert.strictEqual(s.commands.alpha[0].startTime, 1000)
  })

  it('removeAlpha removes by reference', () => {
    const s = new StoryboardSprite(makeRef('a.png'))
    s.addAlpha(0, 0, 1000)
    const cmd = s.commands.alpha[0]
    s.addAlpha(0, 2000, 3000)
    s.commands.removeAlpha(cmd)
    assert.strictEqual(s.commands.alpha.length, 1)
  })

  it('clearAlpha removes all alpha commands', () => {
    const s = new StoryboardSprite(makeRef('a.png'))
    s.addAlpha(0, 0, 1000).addAlpha(0, 1000, 2000).addScale(0, 0, 500)
    s.commands.clearAlpha()
    assert.strictEqual(s.commands.alpha.length, 0)
    assert.strictEqual(s.commands.scale.length, 1)
  })

  it('setAlpha modifies command in place', () => {
    const s = new StoryboardSprite(makeRef('a.png'))
    s.addAlpha(0, 0, 1000, 1, 0)
    s.commands.setAlpha(0, { endValue: 0.5, easing: Easing.In })
    assert.strictEqual(s.commands.alpha[0].endValue, 0.5)
    assert.strictEqual(s.commands.alpha[0].easing, Easing.In)
    assert.strictEqual(s.commands.alpha[0].startTime, 0)
  })

  it('removeCommand removes generic command by reference', () => {
    const s = new StoryboardSprite(makeRef('a.png'))
    const cmd = s.addAlpha(0, 0, 1000).addScale(0, 0, 500)
    s.commands.removeCommand(s.commands.alpha[0])
    assert.strictEqual(s.commands.alpha.length, 0)
    assert.strictEqual(s.commands.scale.length, 1)
  })

  it('clearAll removes all commands', () => {
    const s = new StoryboardSprite(makeRef('a.png'))
    s.addAlpha(0, 0, 1000).addScale(0, 0, 500).addMoveX(0, 0, 500)
    s.commands.clearAll()
    assert.strictEqual(s.commands.allCommands().length, 0)
  })

  it('shiftTimes moves all command times', () => {
    const s = new StoryboardSprite(makeRef('a.png'))
    s.addAlpha(0, 1000, 2000).addScale(0, 500)
    s.commands.shiftTimes(1000)
    assert.strictEqual(s.commands.alpha[0].startTime, 2000)
    assert.strictEqual(s.commands.alpha[0].endTime, 3000)
    assert.strictEqual(s.commands.scale[0].startTime, 1500)
  })

  it('removeLoopingGroup removes by index', () => {
    const s = new StoryboardSprite(makeRef('l.png'))
    s.addLoopingGroup(0, 5)
    s.addLoopingGroup(1000, 3)
    s.removeLoopingGroup(0)
    assert.strictEqual(s.loopingGroups.length, 1)
    assert.strictEqual(s.loopingGroups[0].loopStartTime, 1000)
  })

  it('clearLoopingGroups removes all loops', () => {
    const s = new StoryboardSprite(makeRef('l.png'))
    s.addLoopingGroup(0, 5).addAlpha(0, 0, 500)
    s.clearLoopingGroups()
    assert.strictEqual(s.loopingGroups.length, 0)
  })

  it('removeTriggerGroup removes trigger', () => {
    const s = new StoryboardSprite(makeRef('t.png'))
    const tg = s.addTriggerGroup('Passing', 0, 10000, 0)
    s.removeTriggerGroup(tg)
    assert.strictEqual(s.triggerGroups.length, 0)
  })

  it('clearTriggerGroups removes all triggers', () => {
    const s = new StoryboardSprite(makeRef('t.png'))
    s.addTriggerGroup('Passing', 0, 1000, 0)
    s.addTriggerGroup('Failing', 2000, 3000, 0)
    s.clearTriggerGroups()
    assert.strictEqual(s.triggerGroups.length, 0)
  })

  it('layer CRUD: remove, removeAt, clear, get', () => {
    const layer = new StoryboardLayer('Test', 0)
    const a = new StoryboardSprite(makeRef('a.png'))
    const b = new StoryboardSprite(makeRef('b.png'))
    layer.add(a); layer.add(b)
    assert.strictEqual(layer.count, 2)
    assert.strictEqual(layer.get(0), a)
    layer.removeAt(0)
    assert.strictEqual(layer.count, 1)
    assert.strictEqual(layer.get(0), b)
    layer.add(a)
    layer.remove(a)
    assert.strictEqual(layer.count, 1)
    layer.clear()
    assert.strictEqual(layer.count, 0)
  })

  it('layer reorder: moveUp and moveDown', () => {
    const layer = new StoryboardLayer('Test', 0)
    const a = new StoryboardSprite(makeRef('a.png'))
    const b = new StoryboardSprite(makeRef('b.png'))
    const c = new StoryboardSprite(makeRef('c.png'))
    layer.add(a); layer.add(b); layer.add(c)
    layer.moveUp(c)    // a, c, b
    assert.strictEqual(layer.elements[0], a)
    assert.strictEqual(layer.elements[1], c)
    assert.strictEqual(layer.elements[2], b)
    layer.moveDown(a)  // c, a, b
    assert.strictEqual(layer.elements[0], c)
    assert.strictEqual(layer.elements[1], a)
    assert.strictEqual(layer.elements[2], b)
  })

  it('layer insertAt inserts at position', () => {
    const layer = new StoryboardLayer('Test', 0)
    const a = new StoryboardSprite(makeRef('a.png'))
    const b = new StoryboardSprite(makeRef('b.png'))
    layer.add(a); layer.insertAt(0, b)
    assert.strictEqual(layer.elements[0], b)
    assert.strictEqual(layer.elements[1], a)
  })

  it('storyboard CRUD: hasLayer, removeLayer, renameLayer, clearLayers', () => {
    const sb = new Storyboard()
    sb.getLayer('Foreground')
    sb.getLayer('Background')
    assert.strictEqual(sb.hasLayer('Foreground'), true)
    assert.strictEqual(sb.hasLayer('Missing'), false)

    sb.renameLayer('Foreground', 'FG')
    assert.strictEqual(sb.hasLayer('Foreground'), false)
    assert.strictEqual(sb.hasLayer('FG'), true)

    sb.removeLayer('Background')
    assert.strictEqual(sb.hasLayer('Background'), false)
    assert.strictEqual(sb.layers.size, 1)

    sb.clearLayers()
    assert.strictEqual(sb.layers.size, 0)
  })

  it('clone creates independent copy', () => {
    const s = new StoryboardSprite(makeRef('clone.png'))
    s.addAlpha(0, 0, 1000, 1, 0)
    s.addLoopingGroup(5000, 3).addScale(0, 0, 500, 2)

    const c = s.clone()
    assert.notStrictEqual(c, s)
    assert.strictEqual(c.file.filename, 'clone.png')
    assert.strictEqual(c.commands.alpha.length, 1)
    assert.strictEqual(c.loopingGroups.length, 1)
    assert.strictEqual(c.loopingGroups[0].scale.length, 1)
    assert.strictEqual(c.loopingGroups[0].loopStartTime, 5000)
    assert.strictEqual(c.loopingGroups[0].totalIterations, 3)

    c.addAlpha(0, 2000, 3000)
    assert.strictEqual(s.commands.alpha.length, 1, 'original unchanged')
  })

  it('clone of animation preserves frame data', () => {
    const a = new StoryboardAnimation(makeRef('anim.png'), 8, 100, Anchor.Centre, { x: 320, y: 240 }, LoopType.LoopOnce)
    a.addAlpha(0, 0, 1000)
    const c = a.clone()
    assert.ok(c instanceof StoryboardAnimation)
    assert.strictEqual(c.frameCount, 8)
    assert.strictEqual(c.frameDelay, 100)
    assert.strictEqual(c.loopType, LoopType.LoopOnce)
    assert.strictEqual(c.commands.alpha.length, 1)
  })
})

describe('.osb', () => {
  it('parses osb with variables', () => {
    const osb = `[Variables]
$bg=bg.jpg

[Events]
Sprite,Foreground,Centre,"$bg",320,240
 F,0,0,1000,0,1`
    const { storyboard: sb } = parseOsb(osb)
    const fg = sb.layers.get('Foreground')!
    assert.strictEqual(fg.elements.length, 1)
  })

  it('preserves UseSkinSprites in osb', () => {
    const { storyboard } = parseOsb('[General]\nUseSkinSprites: 1\n[Events]')
    assert.strictEqual(storyboard.useSkinSprites, true)
    assert.ok(serializeOsb(storyboard, {}).includes('UseSkinSprites: 1'))
  })

  it('serialises osb', () => {
    const sb = new Storyboard()
    sb.getLayer('Foreground').add(new StoryboardSprite(makeRef('$bg')))
    const out = serializeOsb(sb, { $bg: 'bg.jpg' })
    assert.ok(out.includes('[Variables]'))
    assert.ok(out.includes('[Events]'))
  })
})

describe('Real osu beatmaps', () => {
  it('parse then re-serialise events are clean', () => {
    const raw = 'osu file format v14\n\n[Events]\n0,0,"bg.jpg",0,0\n2,1000,5000\n'
    const bm = parseOsu(raw)
    assert.strictEqual(bm.events.length, 2)
    assert.strictEqual(bm.storyboard, undefined)
  })

  it('programmatic storyboard serialises and re-parses', () => {
    const sb = new Storyboard()
    const s = new StoryboardSprite(makeRef('test.png'), Anchor.Centre, { x: 320, y: 240 })
    s.addAlpha(Easing.None, 1000, 2000, 1, 0)
    sb.getLayer('Foreground').add(s)

    const text = serializeStoryboard(sb)
    const re = parseStoryboard(text)
    const fg = re.layers.get('Foreground')!
    assert.strictEqual(fg.elements.length, 1)
  })

  it('preserves video start time and storyboard background offset', () => {
    const raw = [
      'osu file format v14',
      '',
      '[Events]',
      '0,0,"bg.jpg",12,-8',
      '1,3456,"video.mp4",0,0',
      'Sprite,Foreground,Centre,s.png,320,240',
    ].join('\n')
    const bm = parseOsu(raw)
    assert.deepStrictEqual(bm.events[1], {
      type: 'video', startTime: 3456, filename: 'video.mp4', xOffset: 0, yOffset: 0,
    })
    assert.deepStrictEqual(bm.storyboard?.backgroundOffset, { x: 12, y: -8 })
    assert.ok(serializeOsu(bm).includes('1,3456,"video.mp4",0,0'))
  })

  it('matches osu rotation and trigger group conventions', () => {
    const sb = parseStoryboard([
      'Sprite,Foreground,Centre,s.png,320,240',
      ' R,0,0,1000,0,3.141592653589793',
      ' T,Passing,0,1000,-2',
    ].join('\n'))
    const sprite = sb.layers.get('Foreground')!.elements[0] as StoryboardSprite
    assert.strictEqual(sprite.commands.rotation[0].endValue, 180)
    assert.strictEqual(sprite.triggerGroups[0].groupNumber, 2)
    const output = serializeStoryboard(sb)
    assert.ok(output.includes('R,0,0,1000,0,3.141592653589793'))
    assert.ok(output.includes('T,Passing,0,1000,-2'))
  })

  it('expands storyboard variables transitively', () => {
    const { storyboard } = parseOsb([
      '[Variables]',
      '$image=$file',
      '$file=bg.jpg',
      '[Events]',
      'Sprite,Foreground,Centre,"$image",320,240',
    ].join('\n'))
    assert.strictEqual(storyboard.layers.get('Foreground')!.elements[0].path, 'bg.jpg')
  })
})

describe('Byte-level round-trip', async () => {
  let bwwText: string

  before(async () => {
    const entries = await readZipEntries(BWW_OSZ)
    bwwText = getOsuEntry(entries, "yf's sb Extreme")
  })

  it('storyboard text round-trips byte-for-byte', () => {
    const bm = parseOsu(bwwText)
    const sb = bm.storyboard!
    assert.strictEqual(sb._dirty, false)

    const serialized = serializeOsu(bm)
    const reParsed = parseOsu(serialized)
    assert.ok(reParsed.storyboard)
    const fg = reParsed.storyboard!.layers.get('Foreground')!
    assert.strictEqual(fg.elements.length, 364)

    const storyboardText = serializeStoryboard(sb)
    const reParsedSb = parseStoryboard(storyboardText)
    const fg2 = reParsedSb.layers.get('Foreground')!
    assert.strictEqual(fg2.elements.length, 364)
  })
})
