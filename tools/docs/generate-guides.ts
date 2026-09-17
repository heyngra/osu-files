import { generateGuides } from './guide-generator.js'

const pages = generateGuides()
console.log(`Generated ${pages.size} guide pages.`)
