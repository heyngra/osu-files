import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as ts from 'typescript'

const root = resolve(import.meta.dirname, '../..')
const baseFile = resolve(root, 'src/get/base.ts')

describe('source documentation links', () => {
  it('resolves RealmSession from the live result documentation', () => {
    const options: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      strict: true,
      skipLibCheck: true,
    }
    const host = ts.createCompilerHost(options)
    const parsed = ts.createSourceFile(baseFile, readFileSync(baseFile, 'utf8'), ts.ScriptTarget.Latest, true)
    const originalGetSourceFile = host.getSourceFile.bind(host)
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => resolve(fileName) === baseFile
      ? parsed
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
    const program = ts.createProgram([baseFile], options, host)
    const source = program.getSourceFile(baseFile)
    assert.ok(source)

    let link: ts.JSDocLink | undefined
    const visit = (node: ts.Node): void => {
      if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'live') {
        const comment = ts.getJSDocCommentsAndTags(node).find(item => item.kind === ts.SyntaxKind.JSDocComment)
        const parts = comment && Array.isArray(comment.comment) ? comment.comment : []
        link = parts.find(part => part.kind === ts.SyntaxKind.JSDocLink && part.name?.getText(source) === 'RealmSession') as ts.JSDocLink | undefined
      }
      ts.forEachChild(node, visit)
    }
    ts.forEachChild(source, visit)

    assert.ok(link?.name)
    const checker = program.getTypeChecker()
    assert.equal(checker.getSymbolAtLocation(link.name)?.getName(), 'RealmSession')
    assert.notEqual(checker.typeToString(checker.getTypeAtLocation(link.name)), 'any')
  })
})
