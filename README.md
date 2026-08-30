# Stateless Thorp shuffle

![Welcome to the crypto casino](https://user-images.githubusercontent.com/10385659/235708675-d264838a-b1fb-4084-8cbe-3b0abd6013f0.png)

An offchain TypeScript implementation of the stateless Thorp shuffle published
as [`solshuffle@2.0.0`](https://github.com/kevincharm/solshuffle/tree/v2.0.0).
It produces the same permutation as the readable Solidity library and the
optimised Yul library, including their odd-domain cycle walk and inverse
mapping.

```sh
pnpm add @kevincharm/gfc-fpe
```

The package is ESM-only and requires Node 20.19 or newer.

## Usage

The API mirrors the Solidity implementation:

```typescript
shuffle(x: bigint, domain: bigint, seed: bigint, rounds: bigint): bigint
deshuffle(x: bigint, domain: bigint, seed: bigint, rounds: bigint): bigint
defaultRounds(domain: bigint): bigint
```

Every `uint256` is represented by a `bigint`. JavaScript numbers, including
unsafe numbers that have already lost precision, are rejected instead of being
coerced.

```typescript
import { defaultRounds, deshuffle, shuffle } from '@kevincharm/gfc-fpe'

const domain = 10_000n
const seed = BigInt(
    '0x243f6a8885a308d313198a2e03707344a4093822299f31d0082efa98ec4e6c89',
)
const rounds = defaultRounds(domain)

const shuffled = shuffle(42n, domain, seed, rounds)
const original = deshuffle(shuffled, domain, seed, rounds)

console.log({ shuffled, original })
// original === 42n
```

Keep `domain`, `seed`, and `rounds` constant wherever the same permutation is
required. A secure seed is the caller's responsibility; if somebody can retry
the seed after seeing an outcome, they can select from several permutations.

## Specification

For a requested domain `D`, the shuffle operates on the evenised domain:

```text
M = D + (D & 1)
```

Each round splits the current index into one bit and a half-index, then uses the
low bit of Ethereum Keccak-256:

```solidity
keccak256(abi.encodePacked(seed, M, halfIndex, round))
```

The preimage is exactly 128 bytes in this order:

```text
seed || evenisedDomain || halfIndex || round
```

Each value occupies one 32-byte, big-endian `uint256` word. The hash is Ethereum
Keccak-256, not FIPS SHA3-256. `deshuffle` applies the same round functions in
reverse order.

`defaultRounds(D)` returns `4 * ceil(log2(M))`. This is the empirical default
published with `solshuffle@2.0.0`, and is not a guarantee of an exactly uniform
permutation, PRP security, or a bound on a distinguisher's advantage. The round
count is not selected or enforced inside `shuffle` or `deshuffle`, so zero
rounds deliberately returns the identity permutation.

### Odd domains

Evenisation adds one excluded element when `D` is odd. The complete permutation
is evaluated once and, only if the result is that excluded element, evaluated
once more. As the excluded element has exactly one preimage, the second result
must be inside the requested domain. Therefore, even domains use exactly
`rounds` hashes, while odd domains use at most `2 * rounds` hashes. The same
bound applies to `deshuffle`.

### Input boundaries

- A one-element domain is accepted.
- A zero domain and `2**256 - 1` are rejected.
- An index outside `[0, domain)` is rejected.
- Seeds from zero through `2**256 - 1` are accepted.
- Every argument must fit in a Solidity `uint256`.

## Development

Development uses Node 24, pnpm 10, TypeScript, Prettier, Node's test runner, and
fast-check.

```sh
pnpm install --frozen-lockfile
pnpm verify
```

`pnpm verify` checks formatting and types, runs deterministic and property-based
tests, builds the package, installs the packed tarball into clean JavaScript and
TypeScript ESM consumers, and runs `npm pack --dry-run`.

## Licence

This library is licenced under the WTFPL.

## Reference

Ben Morris, Phillip Rogaway, and Till Stegers,
[How to encipher messages on a small domain](https://www.cs.ucdavis.edu/~rogaway/papers/thorp.pdf),
CRYPTO 2009.
