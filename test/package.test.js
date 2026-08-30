import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

function run(command, arguments_, cwd) {
    const result = spawnSync(command, arguments_, {
        cwd,
        encoding: 'utf8',
    })
    assert.equal(
        result.status,
        0,
        `${command} ${arguments_.join(' ')}\n${result.stdout}\n${result.stderr}`,
    )
}

function installConsumer(directory, tarball, typescript = false) {
    writeFileSync(
        join(directory, 'package.json'),
        `${JSON.stringify(
            {
                private: true,
                type: 'module',
                packageManager: packageJson.packageManager,
                dependencies: {
                    '@kevincharm/gfc-fpe': `file:${tarball}`,
                },
                ...(typescript
                    ? {
                          devDependencies: {
                              '@types/node': packageJson.devDependencies['@types/node'],
                              typescript: packageJson.devDependencies.typescript,
                          },
                      }
                    : {}),
            },
            null,
            2,
        )}\n`,
    )
    run('pnpm', ['install', '--ignore-scripts'], directory)
}

describe('packed package', () => {
    it('works from clean JavaScript and TypeScript ESM consumers', () => {
        const temporary = mkdtempSync(join(tmpdir(), 'gfc-fpe-pack-'))
        try {
            const packed = join(temporary, 'packed')
            mkdirSync(packed)
            run('pnpm', ['pack', '--pack-destination', packed], projectRoot)
            const tarballs = readdirSync(packed).filter((file) => file.endsWith('.tgz'))
            assert.equal(tarballs.length, 1)
            const tarball = join(packed, tarballs[0])

            const javascript = join(temporary, 'javascript-consumer')
            mkdirSync(javascript)
            installConsumer(javascript, tarball)
            writeFileSync(
                join(javascript, 'index.js'),
                `import assert from 'node:assert/strict'
import { defaultRounds, deshuffle, shuffle } from '@kevincharm/gfc-fpe'

const rounds = defaultRounds(10n)
const shuffled = shuffle(0n, 10n, 0n, 4n)
assert.equal(rounds, 16n)
assert.equal(shuffled, 2n)
assert.equal(deshuffle(shuffled, 10n, 0n, 4n), 0n)
`,
            )
            run('node', ['index.js'], javascript)

            const typescript = join(temporary, 'typescript-consumer')
            mkdirSync(typescript)
            installConsumer(typescript, tarball, true)
            writeFileSync(
                join(typescript, 'tsconfig.json'),
                `${JSON.stringify(
                    {
                        compilerOptions: {
                            target: 'ES2022',
                            module: 'NodeNext',
                            moduleResolution: 'NodeNext',
                            strict: true,
                            outDir: 'dist',
                            types: ['node'],
                        },
                        include: ['index.ts'],
                    },
                    null,
                    2,
                )}\n`,
            )
            writeFileSync(
                join(typescript, 'index.ts'),
                `import assert from 'node:assert/strict'
import { defaultRounds, deshuffle, shuffle } from '@kevincharm/gfc-fpe'

const rounds: bigint = defaultRounds(11n)
const shuffled: bigint = shuffle(3n, 11n, 0n, 8n)
assert.equal(rounds, 16n)
assert.equal(shuffled, 0n)
assert.equal(deshuffle(shuffled, 11n, 0n, 8n), 3n)
`,
            )
            run('pnpm', ['exec', 'tsc'], typescript)
            run('node', ['dist/index.js'], typescript)
        } finally {
            rmSync(temporary, { recursive: true, force: true })
        }
    })
})
