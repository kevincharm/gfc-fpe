import { keccak_256 } from '@noble/hashes/sha3.js'

const UINT256_MAX = 2n ** 256n - 1n
const UINT256_BYTES = 32

function assertUint256(value: bigint, name: string): void {
    if (typeof value !== 'bigint') {
        throw new TypeError(`${name} must be a bigint`)
    }
    if (value < 0n || value > UINT256_MAX) {
        throw new RangeError(`${name} must fit in a uint256`)
    }
}

function assertDomain(domain: bigint): void {
    assertUint256(domain, 'domain')
    if (domain === 0n || domain === UINT256_MAX) {
        throw new RangeError('domain must be between 1 and 2**256 - 2')
    }
}

function assertInputs(x: bigint, domain: bigint, seed: bigint, rounds: bigint): void {
    assertUint256(x, 'x')
    assertDomain(domain)
    assertUint256(seed, 'seed')
    assertUint256(rounds, 'rounds')
    if (x >= domain) {
        throw new RangeError('x must be less than domain')
    }
}

function writeUint256(target: Uint8Array, offset: number, value: bigint): void {
    for (let i = UINT256_BYTES - 1; i >= 0; --i) {
        target[offset + i] = Number(value & 0xffn)
        value >>= 8n
    }
}

function makePreimage(seed: bigint, modulus: bigint): Uint8Array {
    const preimage = new Uint8Array(4 * UINT256_BYTES)
    writeUint256(preimage, 0, seed)
    writeUint256(preimage, UINT256_BYTES, modulus)
    return preimage
}

function roundBit(preimage: Uint8Array, halfIndex: bigint, round: bigint): bigint {
    writeUint256(preimage, 2 * UINT256_BYTES, halfIndex)
    writeUint256(preimage, 3 * UINT256_BYTES, round)
    return BigInt(keccak_256(preimage)[UINT256_BYTES - 1]! & 1)
}

function applyPermutation(
    x: bigint,
    modulus: bigint,
    rounds: bigint,
    preimage: Uint8Array,
): bigint {
    const mid = modulus / 2n
    for (let round = 0n; round < rounds; ++round) {
        const halfIndex = x % mid
        const coin = roundBit(preimage, halfIndex, round)
        x = x < mid ? 2n * x + coin : 2n * halfIndex + 1n - coin
    }
    return x
}

function applyInversePermutation(
    x: bigint,
    modulus: bigint,
    rounds: bigint,
    preimage: Uint8Array,
): bigint {
    const mid = modulus / 2n
    for (let round = rounds; round > 0n;) {
        --round
        const half = x / 2n
        const coin = roundBit(preimage, half, round)
        x = coin === x % 2n ? half : half + mid
    }
    return x
}

/**
 * Return the empirical round count used by solshuffle@2.0.0.
 *
 * The result is `4 * ceil(log2(evenisedDomain))`. It does not guarantee an
 * exactly uniform permutation or bound a distinguisher's advantage.
 */
export function defaultRounds(domain: bigint): bigint {
    assertDomain(domain)
    let n = domain + (domain & 1n) - 1n
    let rounds = 0n
    while (n !== 0n) {
        ++rounds
        n >>= 1n
    }
    return 4n * rounds
}

/**
 * Map `x` to its shuffled index using the solshuffle@2.0.0 Thorp permutation.
 */
export function shuffle(x: bigint, domain: bigint, seed: bigint, rounds: bigint): bigint {
    assertInputs(x, domain, seed, rounds)
    const modulus = domain + (domain & 1n)
    const preimage = makePreimage(seed, modulus)
    x = applyPermutation(x, modulus, rounds, preimage)
    if (x === domain) {
        x = applyPermutation(x, modulus, rounds, preimage)
    }
    return x
}

/**
 * Invert `shuffle` using the same domain, seed, and round count.
 */
export function deshuffle(x: bigint, domain: bigint, seed: bigint, rounds: bigint): bigint {
    assertInputs(x, domain, seed, rounds)
    const modulus = domain + (domain & 1n)
    const preimage = makePreimage(seed, modulus)
    x = applyInversePermutation(x, modulus, rounds, preimage)
    if (x === domain) {
        x = applyInversePermutation(x, modulus, rounds, preimage)
    }
    return x
}
