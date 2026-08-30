import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fc from 'fast-check'
import { defaultRounds, deshuffle, shuffle } from '../src/index.ts'

const UINT256_MAX = 2n ** 256n - 1n
const REFERENCE_SEED = BigInt('0x243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89')

type Vector = readonly [x: bigint, domain: bigint, seed: bigint, rounds: bigint, shuffled: bigint]

// Generated from both libraries at solshuffle v2.0.0. The two implementations
// were required to agree before each expected value was recorded.
const SOLIDITY_VECTORS: readonly Vector[] = [
    [0n, 10n, 0n, 4n, 2n],
    [10n, 11n, UINT256_MAX, 8n, 4n],
    [15n, 31n, REFERENCE_SEED, 20n, 26n],
    [31n, 32n, 0n, 20n, 27n],
    [16n, 33n, UINT256_MAX, 24n, 16n],
    [8_192n, 8_193n, 0n, 56n, 3_533n],
    [0n, 1n, UINT256_MAX, 4n, 0n],
    [
        340282366920938463463374607431768211456n,
        340282366920938463463374607431768211457n,
        0n,
        516n,
        140537182365165871588453049833946801781n,
    ],
    [
        57896044618658097711785492504343953926634992332820282019728792003956564819967n,
        57896044618658097711785492504343953926634992332820282019728792003956564819968n,
        UINT256_MAX,
        12n,
        57896044618658097711785492504343953926634992332820282019728792003956564818273n,
    ],
    [
        57896044618658097711785492504343953926634992332820282019728792003956564819968n,
        57896044618658097711785492504343953926634992332820282019728792003956564819969n,
        REFERENCE_SEED,
        16n,
        57896044618658097711785492504343953926634992332820282019728792003956564707652n,
    ],
    [
        UINT256_MAX - 3n,
        UINT256_MAX - 2n,
        UINT256_MAX,
        8n,
        115792089237316195423570985008687907853269984665640564039457584007913129639525n,
    ],
    [UINT256_MAX - 2n, UINT256_MAX - 1n, 0n, 1n, UINT256_MAX - 3n],
    [
        UINT256_MAX - 2n,
        UINT256_MAX - 1n,
        UINT256_MAX,
        1_024n,
        95551317016554854068467513144992418425877036259673611054662839637210427690888n,
    ],
    [UINT256_MAX - 2n, UINT256_MAX - 1n, UINT256_MAX, 0n, UINT256_MAX - 2n],
]

describe('solshuffle@2.0.0 equivalence', () => {
    it('calculates default rounds from the evenised domain', () => {
        const expected = new Map<bigint, bigint>([
            [1n, 4n],
            [2n, 4n],
            [3n, 8n],
            [7n, 12n],
            [8n, 12n],
            [9n, 16n],
            [15n, 16n],
            [16n, 16n],
            [17n, 20n],
            [10_000n, 56n],
            [UINT256_MAX - 2n, 1_024n],
            [UINT256_MAX - 1n, 1_024n],
        ])

        for (const [domain, rounds] of expected) {
            assert.equal(defaultRounds(domain), rounds)
        }
    })

    it('matches deterministic Solidity and Yul vectors, including full-width uint256 values', () => {
        for (const [x, domain, seed, rounds, expected] of SOLIDITY_VECTORS) {
            const shuffled = shuffle(x, domain, seed, rounds)
            assert.equal(shuffled, expected)
            assert.equal(deshuffle(shuffled, domain, seed, rounds), x)
        }
    })

    it('matches one and two odd-domain evaluation witnesses', () => {
        assert.equal(shuffle(0n, 11n, 0n, 8n), 10n)
        assert.equal(shuffle(3n, 11n, 0n, 8n), 0n)
        assert.equal(deshuffle(10n, 11n, 0n, 8n), 0n)
        assert.equal(deshuffle(0n, 11n, 0n, 8n), 3n)
    })

    it('treats zero rounds as the identity permutation', () => {
        const domains = [1n, 2n, 3n, 10n, 11n, 128n, 129n, UINT256_MAX - 2n]
        for (const domain of domains) {
            for (const x of [0n, domain / 2n, domain - 1n]) {
                assert.equal(shuffle(x, domain, UINT256_MAX, 0n), x)
                assert.equal(deshuffle(x, domain, UINT256_MAX, 0n), x)
            }
        }
    })

    it('accepts one-element domains', () => {
        for (const seed of [0n, REFERENCE_SEED, UINT256_MAX]) {
            for (const rounds of [0n, 1n, 4n, 64n]) {
                assert.equal(shuffle(0n, 1n, seed, rounds), 0n)
                assert.equal(deshuffle(0n, 1n, seed, rounds), 0n)
            }
        }
    })

    it('rejects values that Solidity cannot accept', () => {
        const unsafeNumber = Number.MAX_SAFE_INTEGER + 1
        const calls = [
            () => defaultRounds(0n),
            () => defaultRounds(UINT256_MAX),
            () => defaultRounds(unsafeNumber as unknown as bigint),
            () => shuffle(unsafeNumber as unknown as bigint, 1n, 0n, 4n),
            () => shuffle(0n, unsafeNumber as unknown as bigint, 0n, 4n),
            () => shuffle(0n, 0n, 0n, 4n),
            () => shuffle(1n, 1n, 0n, 4n),
            () => deshuffle(1n, 1n, 0n, 4n),
            () => shuffle(-1n, 1n, 0n, 4n),
            () => shuffle(0n, -1n, 0n, 4n),
            () => shuffle(0n, 1n, -1n, 4n),
            () => shuffle(0n, 1n, 0n, -1n),
            () => shuffle(0n, 1n, UINT256_MAX + 1n, 4n),
            () => shuffle(0n, 1n, 0n, UINT256_MAX + 1n),
            () => shuffle(0n, UINT256_MAX, 0n, 4n),
            () => shuffle(0n, 1n, unsafeNumber as unknown as bigint, 4n),
            () => shuffle(0n, 1n, 0n, unsafeNumber as unknown as bigint),
        ]

        for (const call of calls) {
            assert.throws(call)
        }
    })

    it('is bijective for every domain up to 64', () => {
        for (let domainNumber = 1; domainNumber <= 64; ++domainNumber) {
            const domain = BigInt(domainNumber)
            const rounds = defaultRounds(domain)
            for (const seed of [0n, REFERENCE_SEED, UINT256_MAX]) {
                const shuffled = new Set<bigint>()
                const deshuffled = new Set<bigint>()
                for (let x = 0n; x < domain; ++x) {
                    shuffled.add(shuffle(x, domain, seed, rounds))
                    deshuffled.add(deshuffle(x, domain, seed, rounds))
                }
                assert.equal(shuffled.size, domainNumber)
                assert.equal(deshuffled.size, domainNumber)
            }
        }
    })

    it('round-trips generated inputs in both directions', () => {
        fc.assert(
            fc.property(
                fc.record({
                    domain: fc.integer({ min: 1, max: 10_000 }),
                    seed: fc.bigInt({ min: 0n, max: UINT256_MAX }),
                    rounds: fc.integer({ min: 0, max: 64 }),
                    xSeed: fc.nat(),
                }),
                ({ domain: domainNumber, seed, rounds: roundsNumber, xSeed }) => {
                    const domain = BigInt(domainNumber)
                    const rounds = BigInt(roundsNumber)
                    const x = BigInt(xSeed % domainNumber)
                    const shuffled = shuffle(x, domain, seed, rounds)
                    const deshuffled = deshuffle(x, domain, seed, rounds)
                    assert(shuffled < domain)
                    assert(deshuffled < domain)
                    assert.equal(deshuffle(shuffled, domain, seed, rounds), x)
                    assert.equal(shuffle(deshuffled, domain, seed, rounds), x)
                },
            ),
            { numRuns: 500, seed: 0x5a17 },
        )
    })
})
