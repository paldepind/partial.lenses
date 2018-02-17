import * as I from 'infestines'
import * as R from 'ramda'

import * as L from '../dist/partial.lenses.cjs'

import * as BST from './bst'
import * as T from './types'

//

const later = I.curry(
  (ms, v) => new Promise(resolve => setTimeout(() => resolve(v), ms))
)

//

const id = I.id
const X = L

function XYZ(x, y, z) {
  this.x = x
  this.y = y
  this.z = z
}

// Note that `norm` is intentionally an enumerable property.  Do not convert
// `XYZ` into an ES2015 class!
XYZ.prototype.norm = function norm() {
  return this.x * this.x + this.y * this.y + this.z * this.z
}

const a100000 = Array(100000).fill(1)

const Sum = {empty: () => 0, concat: (x, y) => x + y}

const numeric = f => x => (x !== undefined ? f(x) : undefined)
const offBy1 = L.iso(numeric(R.inc), numeric(R.dec))

const flatten = [
  L.optional,
  L.lazy(rec =>
    L.cond(
      [R.is(Array), [L.elems, rec]],
      [R.is(Object), [L.values, rec]],
      [L.identity]
    )
  )
]

const everywhere = [
  L.optional,
  L.lazy(rec => {
    const elems = L.seq([L.elems, rec], L.identity)
    const values = L.seq([L.values, rec], L.identity)
    return L.choose(
      x =>
        x instanceof Array ? elems : x instanceof Object ? values : L.identity
    )
  })
]

//

const Monad = ({of, chain}) => ({
  of,
  chain,
  ap: (x2yS, xS) => chain(x2y => chain(x => of(x2y(x)), xS), x2yS),
  map: (x2y, xS) => chain(x => of(x2y(x)), xS)
})

//

const MapConcatOf = Monoid =>
  Monad({
    of: x => [x, Monoid.empty()],
    chain: (x2yM, [x, sr]) => {
      const [y, sl] = x2yM(x)
      return [y, Monoid.concat(sl, sr)]
    }
  })

const Collect = {
  empty: () => Object.freeze([]),
  concat: (ls, rs) => Object.freeze([...rs, ...ls])
}

const CollectM = MapConcatOf(Collect)

const collectM = I.curry(
  (o, s) =>
    L.toFunction(o)(Object.freeze(s), undefined, CollectM, x => [x, [x]])[1]
)

//

const StateM = Monad({
  of: x => s => [x, s],
  chain: (x2yS, xS) => s1 => {
    const [x, s] = xS(s1)
    return x2yS(x)(s)
  }
})

const countS = x => x2n => {
  const n = (x2n[x] || 0) + 1
  return [n, L.set(`${x}`, n, x2n)]
}

//

function show(x) {
  switch (typeof x) {
    case 'string':
    case 'object':
      return JSON.stringify(x)
    default:
      return `${x}`
  }
}

const run = expr =>
  eval(`() => ${expr}`)(
    Sum,
    StateM,
    T,
    XYZ,
    a100000,
    collectM,
    countS,
    everywhere,
    flatten,
    id,
    later,
    offBy1,
    X
  )

const equals = (x, y) =>
  R.identical(x && Object.getPrototypeOf(x), y && Object.getPrototypeOf(y)) &&
  R.equals(x, y)

function toggleEnv() {
  process.env.NODE_ENV =
    process.env.NODE_ENV === 'production' ? 'development' : 'production'
}

function testEq(exprIn, expect) {
  const expr = exprIn.replace(/[ \n]+/g, ' ')
  it(`${expr} => ${show(expect)}`, async () => {
    const actual = await run(expr)
    if (!equals(actual, expect))
      throw Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)

    toggleEnv()
    try {
      const actual = await run(expr)
      if (!equals(actual, expect))
        throw Error(`Expected: ${show(expect)}, actual: ${show(actual)}`)
    } finally {
      toggleEnv()
    }

    const exprTy = expr.replace(/\bL\.([a-zA-Z0-9]*)/g, 'T.$1(L.$1)')
    const typed = await run(exprTy)
    if (!equals(actual, typed))
      throw Error(`Typed: ${show(typed)}, actual: ${show(actual)}`)
  })
}

const testThrows = expr =>
  it(`${expr} => throws`, () => {
    let raised
    let result
    try {
      result = run(expr)
      raised = false
    } catch (e) {
      result = e
      raised = true
    }
    if (!raised)
      throw Error(`Expected ${expr} to throw, returned ${show(result)}`)
  })

const empties = [undefined, null, false, true, '', 0, 0.0 / 0.0, {}, []]

describe('L.log', () => {
  testEq(`L.set(L.log("label"), "out", "in")`, 'out')
})

describe('L.compose', () => {
  testEq(`L.get(L.compose(), "any")`, 'any')
  testEq(`L.compose("x")`, 'x')
  testEq(`L.compose(101)`, 101)
  testEq(`L.compose(101, "x")`, [101, 'x'])
})

describe('L.identity', () => {
  testEq(`L.get(L.identity, "any")`, 'any')
  testEq(`L.modify(L.identity, R.add(1), 2)`, 3)
  testEq(`L.modify([], R.add(1), 2)`, 3)
  testEq(`L.remove(["x", L.identity], {x: 1, y: 2})`, {y: 2})
})

describe('arities', () => {
  const arities = {
    Constant: undefined,
    Identity: undefined,
    IdentityAsync: undefined,
    all: 3,
    and: 2,
    any: 3,
    append: 4,
    array: 1,
    assign: 3,
    assignOp: 1,
    branch: 1,
    branchOr: 2,
    branches: 0,
    chain: 2,
    children: 4,
    choice: 0,
    choices: 1,
    choose: 1,
    collect: 2,
    collectAs: 3,
    complement: 4,
    compose: 0,
    concat: 3,
    concatAs: 4,
    cond: 0,
    condOf: 1,
    count: 2,
    countIf: 3,
    counts: 2,
    countsAs: 3,
    defaults: 1,
    define: 1,
    elems: 4,
    entries: 4,
    filter: 1,
    find: 1,
    findWith: 1,
    first: undefined,
    flat: 0,
    flatten: 4,
    foldTraversalLens: 2,
    foldl: 4,
    foldr: 4,
    forEach: 3,
    forEachWith: 4,
    get: 2,
    getInverse: 2,
    identity: 4,
    ifElse: 3,
    iftes: 2,
    index: 1,
    indexed: 4,
    inverse: 1,
    is: 1,
    isDefined: 2,
    isEmpty: 2,
    iso: 2,
    join: 3,
    joinAs: 4,
    json: 1,
    keyed: 4,
    keys: 4,
    last: 4,
    lazy: 1,
    leafs: 4,
    lens: 2,
    log: 0,
    matches: 1,
    maximum: 2,
    maximumBy: 3,
    mean: 2,
    meanAs: 3,
    minimum: 2,
    minimumBy: 3,
    modify: 3,
    modifyAsync: 3,
    modifyOp: 1,
    none: 3,
    normalize: 1,
    optional: 4,
    or: 2,
    orElse: 2,
    pick: 1,
    pickIn: 1,
    pointer: 1,
    prefix: 1,
    product: 2,
    productAs: 3,
    prop: 1,
    props: 0,
    propsOf: 1,
    query: 0,
    removable: 0,
    remove: 2,
    removeOp: 4,
    replace: 2,
    required: 1,
    reread: 1,
    reverse: 4,
    rewrite: 1,
    satisfying: 1,
    seemsArrayLike: 1,
    select: 2,
    selectAs: 3,
    seq: 0,
    set: 3,
    setOp: 1,
    setter: 1,
    singleton: 4,
    slice: 2,
    suffix: 1,
    sum: 2,
    sumAs: 3,
    toFunction: 1,
    transform: 2,
    traverse: 4,
    unless: 1,
    uri: 4,
    uriComponent: 4,
    valueOr: 1,
    values: 4,
    when: 1,
    zero: 4
  }

  for (const f in L) testEq(`L.${f}.length`, arities[f])
})

describe(`L.find`, () => {
  testEq(`L.set(L.find(R.equals(2)), undefined, [2])`, [])
  testEq(`L.set(L.find(R.equals(2)))(undefined, [1, 2, 3])`, [1, 3])
  testEq(`L.set(L.find(R.equals(2)))(4)([1, 2, 3])`, [1, 4, 3])
  testEq(`L.set(L.find(R.equals(2)), 2)([1, 4, 3])`, [1, 4, 3, 2])
  testEq(`L.set(L.find(R.equals(2)), 2, undefined)`, [2])
  testEq(`L.set(L.find(R.equals(2)), 2, [])`, [2])
  testEq(`L.get(L.find(R.equals(2)), undefined)`, undefined)
  testEq(`L.get(L.find(R.equals(2)), [3])`, undefined)
  testEq(
    `L.remove([L.rewrite(R.join("")), L.find(R.equals("A"))], "LOLA")`,
    'LOL'
  )
  testEq(
    `L.set([L.rewrite(R.join("")), L.find(R.equals("O"))], "A-", "LOLA")`,
    'LA-LA'
  )

  testEq(`L.get(L.find(R.equals(1), {hint: 2}), [2,2,2,1,2])`, 1)
  testEq(`L.get(L.find(R.equals(1), {hint: 0}), [2,2,2,1,2])`, 1)
  testEq(`L.get(L.find(R.equals(1), {hint: 4}), [2,1,2,2,2])`, 1)
  testEq(`L.get(L.find(R.equals(1), {hint: 5}), 0)`, undefined)
  testEq(
    `L.get(L.find(R.pipe(Math.abs, R.equals(2)), {hint: 2}),
           [-1,-2,3,1,2,1])`,
    -2
  )
  testEq(`L.get(L.find(R.equals(2), {hint: 10}), [3,2,1,0])`, 2)
  testEq(`L.set(L.find(R.equals(2), {hint: 0}), 2, [0,1])`, [0, 1, 2])
})

describe(`L.get`, () => {
  testEq(`L.get([], [[{x: {y: 101}}]])`, [[{x: {y: 101}}]])
  testEq(
    `L.get([0, L.findWith("x"), L.identity, "y", []], [[{x: {y: 101}}]])`,
    101
  )
  testEq(
    `L.get([0, L.findWith("x"), [L.identity, "y"]], [[{x: {y: 101}}]])`,
    101
  )
  testEq(
    `L.get([[0, L.findWith("x")], [[L.identity], "y"]],
           [[{x: {y: 101}}]])`,
    101
  )
})

describe(`L.index`, () => {
  testEq(`L.remove([L.rewrite(R.join("")), 1], "lol")`, 'll')
  testEq(`L.modify(L.index(1), x => x + 1, [1, 2])`, [1, 3])
  testEq(`L.set([0], undefined, [null])`, [])
  testEq(`L.set([1], 4, [1, 2, 3])`, [1, 4, 3])
  testEq(`L.set(2, 4, undefined)`, [undefined, undefined, 4])
  testEq(`L.set([2], 4, [1])`, [1, undefined, 4])
  testEq(`L.remove([0], [1, 2, 3])`, [2, 3])
  testEq(`L.set([1], undefined, [1, 2, 3])`, [1, 3])
  testEq(`L.set(2)(undefined, [1, 2, 3])`, [1, 2])
  testEq(`L.set([5], undefined, [1, 2, 3])`, [1, 2, 3])
  testEq(`L.get(5)(undefined)`, undefined)
  testEq(`L.get([5], [1, 2, 3])`, undefined)
  testEq(`L.set(1, "2", ["1", "2", "3"])`, ['1', '2', '3'])
  empties.forEach(invalid => {
    testEq(`L.get(0, ${show(invalid)})`, undefined)
    testEq(`L.set(0, "f", ${show(invalid)})`, ['f'])
  })
  testEq(
    `L.set([L.rewrite(R.join("")), L.index(0)], "Hello", "x, world!")`,
    'Hello, world!'
  )
  testEq(`L.remove(0, [])`, [])
  testEq(`L.remove(1, [])`, [])
})

describe(`L.prop`, () => {
  testEq(`Object.keys(L.set("y", 1, {x: 2, z: 3}))`, ['x', 'z', 'y'])
  testEq(`Object.keys(L.set("y", 1, {x: 2, y: 0, z: 3}))`, ['x', 'y', 'z'])
  testEq(`Object.keys(L.remove("y", {z: 2, y: 0, x: 3}))`, ['z', 'x'])
  testEq(`L.modify("x", x => x + 1, {x: 1})`, {x: 2})
  testEq(`L.set([L.prop("x")], undefined, {x: 1})`, {})
  testEq(`L.set(["x", L.required(null)], undefined, {x: 1})`, {x: null})
  testEq(`L.set(["x", L.required(null)], 2, {x: 1})`, {x: 2})
  testEq(`L.remove("y", {x: 1, y: 2})`, {x: 1})
  testEq(`L.set(["y"], 3, {x: 1, y: 2})`, {x: 1, y: 3})
  testEq(`L.set("z", 3, {x: 1, y: 2})`, {x: 1, y: 2, z: 3})
  testEq(`L.set(["z"], 3, undefined)`, {z: 3})
  testEq(`L.get("z", undefined)`, undefined)
  testEq(`L.get(["z"])({x: 1})`, undefined)
  empties.forEach(invalid => {
    testEq(`L.get("x", ${show(invalid)})`, undefined)
    testEq(`L.set("ex", true, ${show(invalid)})`, {ex: true})
  })
  testEq(`L.remove("x", {})`, {})
})

describe('L.replace', () => {
  testEq(`L.get(L.replace(undefined, ""), undefined)`, '')
  testEq(`L.get(L.replace(undefined, ""), "defined")`, 'defined')
  testEq(`L.set(L.replace(undefined, ""), "", "anything")`, undefined)
  testEq(`L.set(L.replace(undefined, ""), "defined", "anything")`, 'defined')
})

describe('L.defaults', () => {
  testEq(`L.get(L.defaults(""), undefined)`, '')
  testEq(`L.get(L.defaults(""), "defined")`, 'defined')
  testEq(`L.set(L.defaults(""), "", "anything")`, undefined)
  testEq(`L.set(L.defaults(""), "defined", "anything")`, 'defined')
})

describe('L.define', () => {
  testEq(`L.get(L.define([]), [1])`, [1])
  testEq(`L.get(["related", L.define([])], {})`, [])
  testEq(`L.set(L.define([]), undefined, undefined)`, [])
})

describe('L.valueOr', () => {
  for (const v of [0, false, true, '', [], {}]) {
    testEq(`L.get(L.valueOr(1), ${show(v)})`, v)
    testEq(`L.set(L.valueOr(1), 1, ${show(v)})`, 1)
  }
  for (const v of [null, undefined]) {
    testEq(`L.get(L.valueOr(1), ${show(v)})`, 1)
    testEq(`L.set(L.valueOr(1), 1, ${show(v)})`, 1)
  }
})

describe('L.normalize', () => {
  testEq(`L.get(L.normalize(R.sortBy(I.id)), [1,3,2,5])`, [1, 2, 3, 5])
  testEq(
    `L.set([L.normalize(R.sortBy(I.id)), L.find(R.equals(2))],
           4,
           [1,3,2,5])`,
    [1, 3, 4, 5]
  )
  testEq(
    `L.set([L.normalize(R.sortBy(I.id)), L.find(R.equals(2))],
           4,
           undefined)`,
    [4]
  )
  testEq(
    `L.remove([L.normalize(R.sortBy(I.id)), L.find(R.equals(2))],
              [2])`,
    []
  )
  testEq(
    `L.remove([L.normalize(R.sortBy(I.id))],
              [2])`,
    undefined
  )
  testEq(
    `L.set([L.normalize(R.sortBy(I.id)), L.find(R.equals(2))],
           undefined,
           [1,3,2,5])`,
    [1, 3, 5]
  )
})

describe('L.rewrite', () => {
  testEq(`L.get(L.rewrite(x => x-1), 1)`, 1)
  testEq(`L.get(L.rewrite(x => x-1), undefined)`, undefined)
  testEq(`L.set(L.rewrite(x => x-1), undefined, 1)`, undefined)
  testEq(`L.set(L.rewrite(x => x-1), 3, 1)`, 2)
})

describe('L.reread', () => {
  testEq(`L.get(L.reread(x => x-1), 1)`, 0)
  testEq(`L.get(L.reread(x => x-1), undefined)`, undefined)
  testEq(`L.set(L.reread(x => x-1), undefined, 1)`, undefined)
  testEq(`L.set(L.reread(x => x-1), 3, 1)`, 3)
})

describe('L.setter', () => {
  testEq(
    `L.get([0,
            L.setter((x, y, i) => [x, y, i]),
            (x, i) => [x, i]],
           ["x"])`,
    ['x', 0]
  )
  testEq(`L.set([0, L.setter((x, y, i) => [x, y, i])], "y", ["x"])`, [
    ['y', 'x', 0]
  ])
})

describe('L.zero', () => {
  testEq(`L.get(L.zero, "anything")`, undefined)
  testEq(`L.get([L.zero, L.valueOr("whatever")], "anything")`, 'whatever')
  testEq(`L.set(L.zero, "anything", "original")`, 'original')
  testEq(`L.collect([L.elems, L.zero], [1,3])`, [])
  testEq(`L.remove([L.elems, L.zero], [1,2])`, [1, 2])
})

describe('composing with plain functions', () => {
  testEq(`L.get(x => x+1, 2)`, 3)
  testEq(`L.modify(R.inc, R.negate, 1)`, 1)
  testEq(`L.get(["x", (x,i) => [x, i]], {x:-1})`, [-1, 'x'])
  testEq(`L.collect([L.elems, (x,i) => [x, i]], ["x","y"])`, [
    ['x', 0],
    ['y', 1]
  ])
  testEq(`L.collect([L.values, (x,i) => [x, i]], {x:1, y:-1})`, [
    [1, 'x'],
    [-1, 'y']
  ])
  testEq(`L.get([0, (x,i) => [x, i]], [-1])`, [-1, 0])
  testEq(`L.get([0, "x", R.negate], [{x:-1}])`, 1)
  testEq(`L.set([0, "x", R.negate], 2, [{x:-1}])`, [{x: -1}])
  testEq(`L.get(I.always("always"), "anything")`, 'always')
  testEq(`L.set(I.always("always"), "anything", "original")`, 'original')
})

describe('L.chain', () => {
  testEq(
    `L.get(L.chain(elems => I.isArray(elems) ? 0 : L.identity, "elems"),
           {elems: ["x"]})`,
    'x'
  )
  testEq(
    `L.set(L.chain(elems => I.isArray(elems) ? 0 : L.identity, "elems"),
           "y",
           {elems: ["x"]})`,
    {elems: ['y']}
  )
  testEq(
    `L.get(L.chain(elems => I.isArray(elems) ? 0 : L.identity, "elems"),
           {notit: true})`,
    undefined
  )
  testEq(
    `L.set(L.chain(elems => I.isArray(elems) ? 0 : L.identity, "elems"),
           false,
           {notit: true})`,
    {notit: true}
  )
})

describe('L.orElse', () => {
  testEq(`L.get(L.orElse("b", "a"), {a: 2, b: 1})`, 2)
  testEq(`L.get(L.orElse("b", "a"), {b: 2})`, 2)
  testEq(`L.set(L.orElse("b", "a"), 3, {a: 2, b: 1})`, {a: 3, b: 1})
  testEq(`L.set(L.orElse("b", "a"), 3, {b: 2})`, {b: 3})
  testEq(`L.modify(L.orElse(L.values, L.elems), R.inc, {x: 1, y: 2})`, {
    x: 2,
    y: 3
  })
  testEq(`L.modify(L.orElse(L.values, L.elems), R.inc, [2,0,3])`, [3, 1, 4])
})

describe('L.choices', () => {
  testEq(`L.get(L.choices("a"), {a: 2, b: 1})`, 2)
  testEq(`L.get(L.choices("a", "b"), {a: 2, b: 1})`, 2)
  testEq(`L.get(L.choices("a", "b"), {b: 2})`, 2)
})

describe('L.choice', () => {
  testEq(`L.get(L.choice("x", "y"), {x: "a"})`, 'a')
  testEq(`L.get(L.choice("x", "y"), {y: "b"})`, 'b')
  testEq(`L.get(L.choice("x", "y"), {z: "c"})`, undefined)
  testEq(`L.set(L.choice("x", "y"), "A", {x: "a"})`, {x: 'A'})
  testEq(`L.set(L.choice("x", "y"), "B", {y: "b"})`, {y: 'B'})
  testEq(`L.set(L.choice("x", "y"), "C", {z: "c"})`, {z: 'c'})
  testEq(`L.modify(L.choice(L.elems, L.values), R.inc, {x: 1, y: 2})`, {
    x: 2,
    y: 3
  })
  testEq(`L.modify(L.choice(L.elems, L.values), R.inc, [2,0,3])`, [3, 1, 4])
})

describe('L.findWith', () => {
  testEq(`L.get(L.findWith(["x", 1]), [{x: ["a"]},{x: ["b","c"]}])`, 'c')
  testEq(`L.set(L.findWith(["x", 1]), "d", [{x: ["a"]},{x: ["b","c"]}])`, [
    {x: ['a']},
    {x: ['b', 'd']}
  ])
  testEq(`L.remove(L.findWith(["x", 1]), [{x: ["a"]},{x: ["b","c"]}])`, [
    {x: ['a']},
    {x: ['b']}
  ])
  testEq(`L.collect(L.findWith(L.elems), [1,[2],3])`, [2])
})

describe('L.filter', () => {
  testEq(`L.set(L.filter(R.T), [], undefined)`, [])
  testEq(`L.set(L.filter(R.T), undefined, [])`, [])
  testEq(`L.get(L.filter(R.lt(9)), [3,1,4,1,5,9,2])`, [])
  testEq(`L.get(L.filter(R.lt(2)), undefined)`, undefined)
  testEq(`L.get(L.filter(R.lt(2)), [3,1,4,1,5,9,2])`, [3, 4, 5, 9])
  testEq(`L.remove([L.filter(R.lt(2)), 1], [3,1,4,1,5,9,2])`, [
    3,
    5,
    9,
    1,
    1,
    2
  ])
  testEq(`L.set(L.filter(R.lt(0)), [], [3,1,4,1,5,9,2])`, [])
  testEq(`L.remove(L.filter(R.lt(0)), [3,1,4,1,5,9,2])`, [])
  testEq(`L.remove(L.filter(R.lt(2)), [3,1,4,1,5,9,2])`, [1, 1, 2])
  empties.filter(x => !I.isArray(x) && !I.isString(x)).forEach(invalid => {
    testEq(`L.get(L.filter(I.always(true)), ${show(invalid)})`, undefined)
    testEq(`L.set(L.filter(I.always(true)), [1,"2",3], ${show(invalid)})`, [
      1,
      '2',
      3
    ])
  })
  testEq(`L.remove(L.filter(c => "a" <= c), "JavaScript")`, ['J', 'S'])
})

describe('L.slice', () => {
  testEq(`L.get(L.slice(undefined, undefined), undefined)`, undefined)
  testEq(`L.get(L.slice(undefined, undefined), 45)`, undefined)
  testEq(`L.get(L.slice(undefined, undefined), [])`, [])
  testEq(`L.get(L.slice(undefined, undefined), "")`, [])
  testEq(`L.set(L.slice(undefined, undefined), [], [101])`, [])
  testEq(`L.remove(L.slice(undefined, undefined), [101])`, [])
  testEq(`L.get(L.slice(4, 1), "abcde")`, [])
  testEq(
    `L.set([L.rewrite(R.join("")), L.slice(4, 1)], "xyz", "abcde")`,
    'abcdxyze'
  )
  testEq(`L.set(L.slice(undefined, undefined), "abba", 45)`, [
    'a',
    'b',
    'b',
    'a'
  ])
  testEq(
    `L.set([L.rewrite(R.join("")), L.slice(-1, -1)], "world", "Hello, !")`,
    'Hello, world!'
  )
  testEq(`L.modify([L.slice(1,-1), L.elems], R.negate, [1,-2,-3,4])`, [
    1,
    2,
    3,
    4
  ])
  testEq(`L.modify([L.slice(-3,3), L.elems], R.negate, [1,-2,-3,4])`, [
    1,
    2,
    3,
    4
  ])
})

describe('L.prefix', () => {
  testEq(`L.set(L.prefix(0), [1,2], [3,4])`, [1, 2, 3, 4])
  testEq(`L.set(L.prefix(), [1,2], [3,4])`, [1, 2])
  testEq(`L.set(L.prefix(Infinity), [], [3,4])`, [])
  testEq(`L.remove(L.prefix(Infinity), [3,4])`, [])
  testEq(`L.set(L.prefix(-1), [], [2,3,4])`, [4])
})

describe('L.suffix', () => {
  testEq(`L.set(L.suffix(0), [1,2], [3,4])`, [3, 4, 1, 2])
  testEq(`L.set(L.suffix(-1), [1,2], [3,4,5])`, [3, 1, 2])
  testEq(`L.set(L.suffix(Infinity), [], [3,4,5])`, [])
  testEq(`L.remove(L.suffix(Infinity), [3,4,5])`, [])
  testEq(`L.set(L.suffix(), [1,2], [3,4,5])`, [1, 2])
})

describe('L.append', () => {
  testEq(`L.get([L.append, (_, i) => i], 56)`, 0)
  testEq(`L.get([L.append, (_, i) => i], [11])`, 1)
  testEq(`L.get([L.append, (_, i) => i], "Hello")`, 5)
  testEq(`L.remove(L.append, 45)`, [])
  testEq(`L.remove([L.rewrite(R.join("")), L.append], "anything")`, 'anything')
  empties.forEach(invalid => {
    testEq(`L.set(L.append, "a", ${show(invalid)})`, ['a'])
  })
  testEq(`L.set(L.append, 1, Int8Array.of(3,1,4))`, [3, 1, 4, 1])
})

describe('L.elems', () => {
  testEq(`L.modify(L.elems, R.negate, [])`, [])
  testEq(`L.remove(L.elems, [1])`, [])
  testEq(
    `L.modify(["xs", L.elems, "x", L.elems],
              R.add(1),
              {xs: [{x: [1]}, {x: [2,3,4]}]})`,
    {xs: [{x: [2]}, {x: [3, 4, 5]}]}
  )
  testEq(
    `L.set(["xs", L.elems, "x", L.elems],
           101,
           {xs: [{x: [1]}, {x: [2,3,4]}]})`,
    {xs: [{x: [101]}, {x: [101, 101, 101]}]}
  )
  testEq(
    `L.remove(["xs", L.elems, "x", L.elems],
              {ys: "hip", xs: [{x: [1]}, {x: [2,3,4]}]})`,
    {ys: 'hip', xs: [{x: []}, {x: []}]}
  )
  testEq(
    `L.modify(["xs", L.elems, "x"],
              x => x < 2 ? undefined : x,
              {xs: [{x:3},{x:1},{x:4},{x:1,y:0},{x:5},{x:9},{x:2}]})`,
    {xs: [{x: 3}, {}, {x: 4}, {y: 0}, {x: 5}, {x: 9}, {x: 2}]}
  )
  testEq(
    `L.modify([L.elems, ["x", L.elems]],
              R.add(1),
              [{x: [1]}, {}, {x: []}, {x: [2, 3]}])`,
    [{x: [2]}, {}, {x: []}, {x: [3, 4]}]
  )
  testEq(
    `L.modify([[L.elems, "x"], L.elems],
              R.add(1),
              [{x: [1]}, {y: "keep"}, {x: [], z: "these"}, {x: [2, 3]}])`,
    [{x: [2]}, {y: 'keep'}, {x: [], z: 'these'}, {x: [3, 4]}]
  )
})

describe('L.values', () => {
  testEq(`L.modify(L.values, R.negate, {x: 11, y: 22})`, {x: -11, y: -22})
  testEq(
    `L.remove([L.values, L.when(x => 11 < x && x < 33)],
              {x: 11, y: 22, z: 33})`,
    {x: 11, z: 33}
  )
  testEq(`L.remove(L.values, {x: 11, y: 22, z: 33})`, {})
  testEq(`L.modify(L.values, R.inc, {})`, {})
  testEq(`L.remove(L.values, {x: 1})`, {})
  testEq(`L.remove(L.values, null)`, null)
  testEq(`L.modify(L.values, R.inc, null)`, null)
  testEq(`L.modify(L.values, R.inc, "anything")`, 'anything')
  testEq(`L.modify(L.values, R.inc, new XYZ(3,1,4))`, {x: 4, y: 2, z: 5})
})

describe('L.optional', () => {
  testEq(`L.collect(L.optional, undefined)`, [])
  testEq(`L.collect(L.optional, 0)`, [0])
  testEq(`L.collect([L.elems, L.elems], [[0, null], [false, NaN]])`, [
    0,
    null,
    false,
    NaN
  ])
  testEq(
    `L.collect([L.elems, "x", L.optional],
               [{x: 1}, {y: 2}, {x: 3, z: 1}])`,
    [1, 3]
  )
  testEq(
    `L.modify([L.elems, "x", L.optional],
              R.add(1),
              [{x: 1}, {y: 2}, {x: 3, z: 1}])`,
    [{x: 2}, {y: 2}, {x: 4, z: 1}]
  )
  testEq(
    `L.collect([L.elems, "x", L.optional, L.elems],
               [{x: [1, 2]}, {y: 2}, {x: [3], z: 1}])`,
    [1, 2, 3]
  )
  testEq(
    `L.modify([L.elems, "x", L.optional, L.elems],
              x => x < 2 ? undefined : x-1,
              [{x: [1, 2]}, {y: 2}, {x: [3], z: 1}])`,
    [{x: [1]}, {y: 2}, {x: [2], z: 1}]
  )
})

describe('L.when', () => {
  testEq(`L.get(L.when(x => x > 2), 1)`, undefined)
  testEq(`L.get([L.when(x => x > 2), I.always(2)], 1)`, 2)
  testEq(`L.get(L.when(x => x > 2), 3)`, 3)
  testEq(`L.collect([L.elems, L.when(x => x > 2)], [1,3,2,4])`, [3, 4])
  testEq(`L.modify([L.elems, L.when(x => x > 2)], R.negate, [1,3,2,4])`, [
    1,
    -3,
    2,
    -4
  ])
})

describe('L.unless', () => {
  testEq(`L.get(L.unless(x => x <= 2), 1)`, undefined)
  testEq(`L.get([L.unless(x => x <= 2), I.always(2)], 1)`, 2)
  testEq(`L.get(L.unless(x => x <= 2), 3)`, 3)
  testEq(`L.collect([L.elems, L.unless(x => x <= 2)], [1,3,2,4])`, [3, 4])
  testEq(`L.modify([L.elems, L.unless(x => x <= 2)], R.negate, [1,3,2,4])`, [
    1,
    -3,
    2,
    -4
  ])
})

describe('L.collect', () => {
  testEq(
    `L.collect(["xs", L.elems, "x", L.elems],
               {xs: [{x:[3,1]},{x:[4,1]},{x:[5,9,2]}]})`,
    [3, 1, 4, 1, 5, 9, 2]
  )
  testEq(
    `L.collect([L.elems, "x", L.elems],
                    [{x: [1]}, {}, {x: []}, {x: [2, 3]}])`,
    [1, 2, 3]
  )
  testEq(`L.collect(L.elems, [])`, [])
  testEq(`L.collect("x", {x: 101})`, [101])
  testEq(`L.collect("y", {x: 101})`, [])
  testEq(
    `L.collect(["a", L.elems, "b", L.elems, "c", L.elems],
               {a:[{b:[]},{b:[{c:[1]}]},{b:[]},{b:[{c:[2]}]}]})`,
    [1, 2]
  )
  testEq(`X.collect(X.elems, a100000).length`, 100000)
})

describe('L.collectAs', () => {
  testEq(`L.collectAs(R.negate, L.elems, [1,2,3])`, [-1, -2, -3])
  testEq(`L.collectAs(x => x < 0 ? undefined : x+1, L.elems, [0,-1,2,-3])`, [
    1,
    3
  ])
})

describe('L.concatAs', () => {
  testEq(`L.concatAs(x => x+1, Sum, L.elems, null)`, 0)
  testEq(`L.concatAs(x => x+1, Sum, [L.elems], [])`, 0)
  testEq(`L.concatAs(x => x+1, Sum, L.elems, [1, 2, 3])`, 9)
  testEq(
    `L.concatAs(x => x+1,
                Sum,
                [L.elems, "x", L.optional],
                [{x:1}, {y:2}, {x:3}])`,
    6
  )
})

describe('L.traverse', () => {
  testEq(
    `L.traverse(StateM,
                countS,
                flatten,
                [1, [[2, 1], 1], 2, [3, [[4]], [3, 4]], 5])({})`,
    [[1, [[1, 2], 3], 2, [1, [[1]], [2, 2]], 1], {1: 3, 2: 2, 3: 2, 4: 2, 5: 1}]
  )
})

describe('folds', () => {
  testEq(`L.isDefined(L.elems, [])`, false)
  testEq(`L.isDefined(L.elems, [1])`, true)
  testEq(`L.isDefined("x", {y: 1})`, false)
  testEq(`L.isDefined([L.elems, "x"], [{}])`, false)
  testEq(`L.isDefined([L.elems, "x", L.optional], [{}])`, false)
  testEq(`L.isEmpty(L.elems, [])`, true)
  testEq(`L.isEmpty(L.elems, [1])`, false)
  testEq(`L.isEmpty([L.elems, "x"], [{}])`, false)
  testEq(`L.isEmpty([L.elems, "x", L.optional], [{}])`, true)
  testEq(`X.concat(Sum, X.elems, a100000)`, 100000)
  testEq(`X.concatAs(id, Sum, X.elems, a100000)`, 100000)
  testEq(`L.maximum([L.elems, "x"], [])`, undefined)
  testEq(`L.minimum([L.elems, "x"], [])`, undefined)
  testEq(`L.maximum(L.elems, "JavaScript")`, 'v')
  testEq(`L.maximumBy(R.negate, L.elems, [1,2,3])`, 1)
  testEq(`L.maximumBy(R.length, L.elems, ["x", "xx", "y", "yy"])`, 'xx')
  testEq(`L.minimumBy(R.length, L.elems, ["x", "xx", "y", "yy"])`, 'x')
  testEq(`L.maximumBy(I.id, flatten, [[1,2], [], [2]])`, 2)
  testEq(`L.maximum(L.elems, [1,2,3])`, 3)
  testEq(`L.minimumBy(R.negate, L.elems, [1,2,3])`, 3)
  testEq(`L.minimum(L.elems, [1,2,3])`, 1)
  testEq(`L.mean(L.elems, [3,4,2])`, 3)
  testEq(`L.mean([L.elems, "x"], [{x: 3}, {y: 4}, {x: 2}])`, 2.5)
  testEq(`L.mean(L.elems, [])`, NaN)
  testEq(`L.meanAs(x => x + 1, L.elems, [])`, NaN)
  testEq(`L.meanAs((x, i) => x+i, L.elems, [1,1,1])`, 2)
  testEq(`L.meanAs(x => x < 0 ? undefined : x, L.elems, [-1,0,1])`, 0.5)
  testEq(`L.sum([L.elems, "x"], undefined)`, 0)
  testEq(`L.product([L.elems, "x"], undefined)`, 1)
  testEq(
    `L.sumAs(x => x === undefined ? 0 : R.negate(x),
             [L.elems, "x"],
             [{x:-2},{y:1},{x:-3}])`,
    5
  )
  testEq(`L.sum([L.elems, "x"], [{x:-2},{y:1},{x:-3}])`, -5)
  testEq(
    `L.productAs(x => x === undefined ? 1 : x + 1,
                 [L.elems, "x"],
                 [{x:-2},{y:1},{x:-3}])`,
    2
  )
  testEq(`L.product([L.elems, "x"], [{x:-2},{y:1},{x:-3}])`, 6)
  testEq(`L.join(", ", L.elems, [])`, '')
  testEq(`L.join(", ", L.elems, [1,2,3])`, '1, 2, 3')
  testEq(`L.join(", ", [L.elems, "x"], [{x: 1}, {y: 2}, {x: 3}])`, '1, 3')
  testEq(`L.joinAs(x => "(" + x + ")", ", ", L.elems, [1, 2])`, '(1), (2)')
  testEq(`L.foldr((x,y) => [x,y], 0, [L.elems, L.elems], [])`, 0)
  testEq(`L.foldl((x,y) => [x,y], 0, [L.elems, L.elems], [])`, 0)
  testEq(`L.foldr((x,y) => [x,y], 0, [L.elems, L.elems], [[1,2],[3]])`, [
    [[0, 3], 2],
    1
  ])
  testEq(`L.foldr((x,y,i) => [x,y,i], 0, [L.elems, L.elems], [[1,2],[3]])`, [
    [[0, 3, 0], 2, 1],
    1,
    0
  ])
  testEq(`L.foldl((x,y) => [x,y], 0, [L.elems, L.elems], [[1,2],[3]])`, [
    [[0, 1], 2],
    3
  ])
  testEq(`L.foldl((x,y,i) => [x,y,i], 0, [L.elems, L.elems], [[1,2],[3]])`, [
    [[0, 1, 0], 2, 1],
    3,
    0
  ])
  testEq(`L.countIf((x, i) => i & 1, L.elems, [1, 2, 3])`, 1)
  testEq(`L.count([L.elems, L.orElse("x","y")], [{x:11}, {z:33}, {y:22}])`, 2)
  testEq(`L.count(flatten, [[],{},[[[],[{x:[],y:[]}],{}]]])`, 0)
  testEq(
    `Array.from(L.countsAs(L.get(0), L.elems, [
       ["x", 1],
       ["y", 2],
       ["x", 3],
       [],
       [  0, 4],
       ["0", 5],
       ["y", 6]
     ]).entries())`,
    [['x', 2], ['y', 2], [undefined, 1], [0, 1], ['0', 1]]
  )
  testEq(
    `Array.from(L.counts([L.elems, 0], [
       ["x", 1],
       ["y", 2],
       ["x", 3],
       [],
       [  0, 4],
       ["0", 5],
       ["y", 6]
     ]).entries())`,
    [['x', 2], ['y', 2], [undefined, 1], [0, 1], ['0', 1]]
  )
  ;[`foldl`, `foldr`].forEach(fold => {
    testEq(`X.${fold}((x,y) => x+y, 0, X.elems, a100000)`, 100000)
  })
})

describe('L.pick', () => {
  testEq(`L.get(L.pick({x: "c"}), {a: [2], b: 1})`, undefined)
  testEq(`L.get(L.pick({x: {y: "z"}}), null)`, undefined)
  testEq(`L.set([L.pick({x: "c"}), "x"], 4, {a: [2], b: 1})`, {
    a: [2],
    b: 1,
    c: 4
  })
  testEq(`L.get(L.pick({x: "b", y: "a"}), {a: [2], b: 1})`, {x: 1, y: [2]})
  testEq(`L.set([L.pick({x: "b", y: "a"}), "x"], 3, {a: [2], b: 1})`, {
    a: [2],
    b: 3
  })
  testEq(`L.remove([L.pick({x: "b", y: "a"}), "y"], {a: [2], b: 1})`, {b: 1})
  testEq(`L.remove([L.pick({x: "b"}), "x"], {a: [2], b: 1})`, {a: [2]})
  testEq(`L.get(L.pick({x: 0, y: 1}), ["a", "b"])`, {x: 'a', y: 'b'})

  testEq(
    `L.get(L.pick({x: {y: "a", z: "b"}, b: ["c", 0]}),
           {a: 1, b: 2, c: [3]})`,
    {x: {y: 1, z: 2}, b: 3}
  )
  testEq(
    `L.set(L.pick({x: {y: "a", z: "b"}, b: ["c", 0]}),
           {x: {y: 4}, b: 5, z: 2},
           {a: 1, b: 2, c: [3]})`,
    {a: 4, c: [5]}
  )
})

describe('L.pickIn', () => {
  testEq(
    `L.get(L.pickIn({meta: {file: [], ext: []}}),
           {meta: {file: "./foo.txt", base: "foo", ext: "txt"}})`,
    {meta: {file: './foo.txt', ext: 'txt'}}
  )
})

describe('L.props', () => {
  testEq(`L.get(L.props("x", "y"), {x: 1, y: 2, z: 3})`, {x: 1, y: 2})
  testEq(`L.get(L.props("x", "y"), {z: 3})`, undefined)
  testEq(`L.get(L.props("x", "y"), {x: 2, z: 3})`, {x: 2})
  testEq(`L.remove(L.props("x", "y"), {x: 1, y: 2, z: 3})`, {z: 3})
  testEq(`L.set(L.props("x", "y"), {}, {x: 1, y: 2, z: 3})`, {z: 3})
  testEq(`L.set(L.props("x", "y"), {y: 4}, {x: 1, y: 2, z: 3})`, {y: 4, z: 3})
  testEq(`L.remove(L.props("x", "y"), {x: 1, y: 2})`, {})
  testEq(`L.set(L.props("a", "b"), {a: 2}, {a: 1, b: 3})`, {a: 2})
  testEq(`I.keys(L.get(L.props("x", "b", "y"), {b: 1, y: 1, x: 1}))`, [
    'x',
    'b',
    'y'
  ])
})

describe('L.assign', () => {
  testEq(`L.assign([], {x:2, z:2}, {x:1, y:1, z:1})`, {x: 2, y: 1, z: 2})
})

describe('L.getInverse', () => {
  testEq(`L.getInverse(offBy1, undefined)`, undefined)
  testEq(`L.getInverse(offBy1, 1)`, 0)
})

describe('L.lazy', () => {
  testEq(`L.collect(flatten, [[[1], 2], 3, [4, [[5]], [6]]])`, [
    1,
    2,
    3,
    4,
    5,
    6
  ])
  testEq(`L.modify(flatten, x => x+1, [[[1], 2], 3, [4, [[5]], [6]]])`, [
    [[2], 3],
    4,
    [5, [[6]], [7]]
  ])
  testEq(
    `L.modify(flatten,
              x => 3 <= x && x <= 5 ? undefined : x,
              [[[1], 2], 3, [4, [[5]], [6]]])`,
    [[[1], 2], [[[]], [6]]]
  )
})

describe('L.inverse', () => {
  testEq(`L.get(L.inverse(offBy1), undefined)`, undefined)
  testEq(`L.get(L.inverse(offBy1), 1)`, 0)
  testEq(`L.getInverse(L.inverse(offBy1), 0)`, 1)
  testEq(`L.remove(["x", L.inverse(offBy1)], {x:1})`, {})
})

describe('L.complement', () => {
  testEq(`L.get(L.complement, undefined)`, undefined)
  testEq(`L.set(L.complement, undefined, true)`, undefined)
  testEq(`L.get(L.complement, true)`, false)
  testEq(`L.set(L.complement, true, undefined)`, false)
})

describe('L.branch', () => {
  testEq(`L.modify(L.branch({}), x => x+1, null)`, null)
  testEq(`L.modify(L.branch({}), x => x+1, "anything")`, 'anything')
  testEq(`L.modify(L.branch({}), x => x+1, {})`, {})
  testEq(`L.set(L.branch({x: []}), 1, 9)`, {x: 1})
  testEq(`L.remove(L.branch({x: []}), 1)`, {})
  testEq(`L.remove(L.branch({}), {})`, {})
  testEq(`L.modify(L.branch({}), x => x+1, {x: 1})`, {x: 1})
  testEq(
    `L.modify(L.branch({a: "x", b: [], c: 0, d: L.identity}),
              x => x+1,
              {a:{x:1},b:2,c:[3],d:4,extra:"one"})`,
    {a: {x: 2}, b: 3, c: [4], d: 5, extra: 'one'}
  )
  testEq(`L.set(L.branch({a: ["x",0], b: []}), 0, null)`, {a: {x: [0]}, b: 0})
  testEq(`L.modify(L.branch({y: L.identity}), R.inc, new XYZ(3,1,4))`, {
    x: 3,
    y: 2,
    z: 4
  })
  testEq(`L.or(L.branch({x: [], y: []}), {x: false, y: false})`, false)

  testEq(
    `L.modify(L.branch({x: {a: []}, y: []}),
              R.negate,
              {x: {a: 1}, y: 2})`,
    {x: {a: -1}, y: -2}
  )
})

describe('L.branchOr', () => {
  testEq(
    `L.transform(L.branchOr(L.modifyOp(R.inc),
                            {x: L.modifyOp(R.dec)}),
                 {x: 1, y: 1})`,
    {x: 0, y: 2}
  )
})

describe('L.branches', () => {
  testEq(`L.collect(L.branches('a', 'b'), {a: 2, b: 3})`, [2, 3])
})

describe('L.removable', () => {
  testEq(`L.set(L.removable("x"), 42, "non object")`, 42)
  testEq(`L.get(L.removable("x"), {x: 1, y: 2})`, {x: 1, y: 2})
  testEq(`L.get([L.removable("y"), "y"], {x: 1, y: 2})`, 2)
  testEq(`L.set([L.removable("y"), "y"], 3, {x: 1, y: 2})`, {x: 1, y: 3})
  testEq(`L.set([L.removable("x"), "x"], undefined, {x: 1, y: 2})`, undefined)
})

describe('L.is', () => {
  testEq(`L.get(L.is("foo"), "bar")`, false)
  testEq(`L.get(L.is("foo"), undefined)`, false)
  testEq(`L.get(L.is("foo"), "foo")`, true)
  testEq(`L.set(L.is("foo"), false, "bar")`, undefined)
  testEq(`L.set(L.is("foo"), undefined, "bar")`, undefined)
  testEq(`L.set(L.is("foo"), "bar", "bar")`, undefined)
  testEq(`L.set(L.is("foo"), true, "bar")`, 'foo')
  testEq(`L.set(L.is("foo"), true, undefined)`, 'foo')
})

describe('indexing', () => {
  testEq(`L.modify(L.identity, (x, i) => [typeof x, typeof i], 0)`, [
    'number',
    'undefined'
  ])
  testEq(`L.modify(["x", 0], (x, i) => [x, i], {x: ["y"]})`, {x: [['y', 0]]})
  testEq(`L.modify(["x", L.required([])], (x, i) => [x, i], {x: ["y"]})`, {
    x: [['y'], 'x']
  })
  testEq(`L.modify(L.elems, (x, i) => i & 1 ? -x : x, [1,2,3,4])`, [
    1,
    -2,
    3,
    -4
  ])
  testEq(`L.modify([L.elems, L.when((_, i) => i & 1)], x => -x, [1,2,3,4])`, [
    1,
    -2,
    3,
    -4
  ])
  testEq(`L.collectAs((x, i) => [x, i], L.elems, ["a", "b"])`, [
    ['a', 0],
    ['b', 1]
  ])
  testEq(`L.collectAs((x, i) => [x, i], L.values, {x: 101, y: 42})`, [
    [101, 'x'],
    [42, 'y']
  ])
})

describe('L.toFunction', () => {
  testEq('typeof L.toFunction(1)', 'function')
  testEq('typeof L.toFunction(`x`)', 'function')
  testEq('typeof L.toFunction(L.find(I.id))', 'function')
})

describe('BST', () => {
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min)) + min
  const randomPick = (...choices) => choices[randomInt(0, choices.length)]

  it('maintains validity through operations', () => {
    let before
    let after
    let op
    let key

    const error = () => {
      throw Error(
        'From ' +
          show(before) +
          ' ' +
          op +
          ' with ' +
          key +
          ' gave ' +
          show(after)
      )
    }

    for (let i = 0; i < 1000; ++i) {
      key = randomInt(0, 10)
      op = randomPick('set', 'delete')

      switch (op) {
        case 'set':
          after = L.set(BST.valueOf(key), key, before)
          if (undefined === L.get(BST.valueOf(key), after)) error()
          break
        case 'delete':
          after = L.remove(BST.valueOf(key), before)
          if (undefined !== L.get(BST.valueOf(key), after)) error()
          break
      }

      if (!BST.isValid(after)) error()

      before = after
    }
  })

  testEq(
    `I.seq([["m", 1], ["a", 2], ["g", 3], ["i", 4], ["c", 5]],
           BST.fromPairs,
           L.modify(BST.values, x => -x))`,
    I.seq(
      [['m', -1], ['a', -2], ['g', -3], ['i', -4], ['c', -5]],
      BST.fromPairs
    )
  )
})

describe('L.seq', () => {
  testEq(`L.set(L.seq(), "ignored", "anything")`, 'anything')
  testEq(`L.set([L.seq(), "x"], "ignored", {x: "anything"})`, {x: 'anything'})
  testEq(`L.set(L.seq("x", "y", "z"), 1, undefined)`, {x: 1, y: 1, z: 1})
  testEq(`L.modify(everywhere, x => [x], {x: {y: 1}})`, [{x: [{y: [1]}]}])

  testEq(`collectM(L.seq(1, 0, 2), ["b", "a", "c"])`, ['a', 'b', 'c'])
})

describe('lazy folds', () => {
  testEq(`L.select(flatten, [[[[[[[[[[101]]]]]]]]]])`, 101)
  testEq(`L.select(L.elems, [])`, undefined)
  testEq(`L.select(L.values, {})`, undefined)
  testEq(
    `L.selectAs((x, i) => x > 3 ? [x + 2, i] : undefined,
                L.elems,
                [3, 1, 4, 1, 5])`,
    [6, 2]
  )
  testEq(
    `L.selectAs((x, i) => x > 3 ? [x + 2, i] : undefined,
                L.values,
                {a:3, b:1, c:4, d:1, e:5})`,
    [6, 'c']
  )
  testEq(`L.selectAs(x => {}, L.values, {x:1})`, undefined)
  testEq(
    `L.selectAs(x => x < 9 ? undefined : [x],
                flatten,
                [[[1], 2], {y: 3}, [{l: 41, r: [5]}, {x: 6}]])`,
    [41]
  )
  testEq(
    `{ let n = 0
     ; const v =
         X.selectAs(x => { n += 1; return x === 42 ? x : undefined },
                    X.elems,
                    [1, 3, 42, 56, 32])
     ; return [n, v] }`,
    [3, 42]
  )
  testEq(
    `{ let n = 0
     ; const v =
         X.selectAs(x => { n += 1; return x === 42 ? x : undefined },
                    X.values,
                    {x: 1, y: 42, z: 25})
     ; return [n, v] }`,
    [2, 42]
  )
  testEq(
    `{ let n = 0
     ; const v =
         X.selectAs(x => { n += 1; return x === 42 ? x : undefined },
                    X.branch({x: [], y: 0, z: []}),
                    {x: 5, z: 5, y: [42]})
     ; return [n, v] }`,
    [2, 42]
  )
  testEq(
    `{ let n = 0
     ; const v =
         X.selectAs(x => { n += 1; return x === 'ba' ? x : undefined },
                    X.matches(/[ab]+/g),
                    "Ab-ba CD b")
     ; return [n, v] }`,
    [2, 'ba']
  )
  testEq(`L.any((x, i) => x > i, L.elems, [0,1,3])`, true)
  testEq(`L.any((x, i) => x > i, L.elems, [0,1,2])`, false)
  testEq(`L.all((x, i) => x > i, L.elems, [1,2,3])`, true)
  testEq(`L.all((x, i) => x > i, L.elems, [1,2,2])`, false)
  testEq(`L.none((x, i) => x > i, L.elems, [0,1,3])`, false)
  testEq(`L.none((x, i) => x > i, L.elems, [0,1,2])`, true)
  testEq(`L.and(L.elems, [])`, true)
  testEq(`L.or(L.elems, [])`, false)
})

describe('L.first', () => {
  testEq(`L.get(L.first, undefined)`, undefined)
  testEq(`L.get(L.first, [])`, undefined)
  testEq(`L.get(L.first, [5])`, 5)
  testEq(`L.set(L.first, 5, undefined)`, [5])
  testEq(`L.set(L.first, 5, [])`, [5])
  testEq(`L.set(L.first, 5, [1,2])`, [5, 2])
  testEq(`L.get([L.first, (_, i) => i], ['a','b'])`, 0)
})

describe('L.last', () => {
  testEq(`L.get(L.last, undefined)`, undefined)
  testEq(`L.get(L.last, [])`, undefined)
  testEq(`L.get(L.last, [5])`, 5)
  testEq(`L.set(L.last, 5, undefined)`, [5])
  testEq(`L.set(L.last, 5, [])`, [5])
  testEq(`L.set(L.last, 5, [1,2])`, [1, 5])
  testEq(`L.get([L.last, (_, i) => i], ['a','b'])`, 1)
})

describe('standard isos', () => {
  testEq(
    `L.getInverse(L.uri, "http://www.Not a URL.com")`,
    'http://www.Not%20a%20URL.com'
  )
  testEq(
    `L.get(L.uri, "http://www.Not%20a%20URL.com")`,
    'http://www.Not a URL.com'
  )
  testEq(`L.getInverse(L.uri, null)`, undefined)

  testEq(`L.getInverse(L.uriComponent, "Hello, world!")`, 'Hello%2C%20world!')
  testEq(`L.get(L.uriComponent, "Hello%2C%20world!")`, 'Hello, world!')
  testEq(`L.getInverse(L.uriComponent, {})`, undefined)

  testEq(
    `L.getInverse(L.json({space: 2}), {this: ["Is", true]})`,
    '{\n  "this": [\n    "Is",\n    true\n  ]\n}'
  )
  testEq(`L.get(L.json(undefined), '{"this":["Is",true]}')`, {
    this: ['Is', true]
  })
  testEq(`L.getInverse(L.json(), undefined)`, undefined)
})

describe('L.matches', () => {
  testEq(`L.collect(L.matches(/\\w+/g), "Hello, world!")`, ['Hello', 'world'])
  testEq(`L.and(L.matches(/\\w+/g), "This is another test!")`, true)
  testEq(
    `L.modify(L.matches(/\\w+/g), R.toUpper, "Hello, world!")`,
    'HELLO, WORLD!'
  )
  testEq(
    `L.modify(L.matches(/does not match/g),
              R.toUpper,
              "what does't match")`,
    "what does't match"
  )
  testEq(
    `L.modify(L.matches(/does not matter/g), R.toUpper, ["Not a string"])`,
    ['Not a string']
  )
  testEq(`L.or(L.matches(/does not matter/g), ["Not a string"])`, false)
  testEq(`L.set(L.matches(/\\w+|\\W+/g), "", "Hello, world!")`, '')
  testEq(`L.remove(L.matches(/\\w+|\\W+/g), "Hello, world!")`, '')

  testEq(`L.collect(L.matches(/a?b?/g), "x")`, [])

  testEq(`L.get(L.matches(/\\w+/), "Hello, world!")`, 'Hello')
  testEq(`L.set(L.matches(/\\w+/), "Salut", "Hello, world!")`, 'Salut, world!')
  testEq(`L.get(L.matches(/does not match/), "Hello, world!")`, undefined)
  testEq(
    `L.set(L.matches(/does not match/), "Anything", "Hello, world!")`,
    'Hello, world!'
  )
  testEq(
    `L.set(L.matches(/does not match/), "Anything", {not_a_string: true})`,
    {not_a_string: true}
  )
  testEq(`L.set(L.matches(/\\w+/g), "", "Hello")`, '')
  testEq(`L.remove(L.matches(/\\w+/g), "Hello")`, '')
  testEq(`L.remove(L.matches(/^/), "")`, '')
})

describe('L.foldTraversalLens', () => {
  testEq(`L.get(L.foldTraversalLens(L.maximum, L.elems), [3,1,4,1])`, 4)
  testEq(`L.set(L.foldTraversalLens(L.maximum, L.elems), 2, [3,1,4,1])`, [
    2,
    2,
    2,
    2
  ])
})

describe('transforming', () => {
  testEq(`L.transform(L.assignOp({y: 2}), {x: 1, y: 1, z: 1})`, {
    x: 1,
    y: 2,
    z: 1
  })
  testEq(`L.transform([L.elems, L.modifyOp(x => x+1)], [1,2,3])`, [2, 3, 4])
  testEq(`L.transform([L.elems, L.setOp(4)], [1,2,3])`, [4, 4, 4])
  testEq(
    `L.transform([L.elems, L.when(x => x > 3), L.removeOp], [3,1,4,1,5])`,
    [3, 1, 1]
  )
  testEq(`L.get(L.setOp(42), 101)`, 42)
  testEq(`L.set(L.setOp(42), 96, 101)`, 42)
})

describe('L.cond', () => {
  testEq(`L.set(L.cond([R.not, L.setOp(1)]), 3, 2)`, 2)
  testEq(`L.set(L.cond([R.not, L.setOp(1)]), 3, 0)`, 1)
  testEq(`L.transform(L.cond([R.not, L.setOp(1)], [L.setOp(0)]), null)`, 1)
  testEq(`L.transform(L.cond([R.not, L.setOp(1)], [L.setOp(0)]), 2)`, 0)
  testEq(
    `L.transform(L.cond([R.equals(1), L.setOp(-1)],
                        [R.equals(2), L.setOp(1)],
                        [L.setOp(2)]),
                 -1)`,
    2
  )
  testEq(
    `L.transform(L.cond([R.equals(1), L.setOp(-1)],
                        [R.equals(2), L.setOp(1)],
                        [R.T,         L.setOp(2)]),
                 -1)`,
    2
  )
  testEq(
    `L.transform(L.cond([R.equals(1), L.setOp(-1)],
                        [R.equals(2), L.setOp(1)],
                        [L.setOp(2)]),
                 2)`,
    1
  )
})

describe('L.condOf', () => {
  testEq(
    `L.collect(
       [
         L.elems,
         L.condOf(
           'type',
           [R.equals('a'), 'foo'],
           [R.equals('b'), 'bar'],
           ['lol']
         )
       ],
       [
         {type: 'a', foo: 42},
         {type: 'b', bar: 101},
         {type: 'c', lol: 76}
       ]
     )`,
    [42, 101, 76]
  )
  testEq(
    `L.collect(
       [
         L.elems,
         L.condOf(
           'type',
           [R.equals('a'), 'foo'],
           [R.equals('b'), 'bar']
         )
       ],
       [
         {type: 'a', foo: 42},
         {type: 'b', bar: 101},
         {type: 'c', lol: 76}
       ]
     )`,
    [42, 101]
  )
  testEq(`L.get(L.condOf([]), 'anything')`, undefined)
})

describe('L.ifElse', () => {
  testEq(`L.set(L.ifElse(R.not, L.setOp(1), L.zero), 3, 2)`, 2)
  testEq(`L.set(L.ifElse(R.not, L.setOp(1), L.zero), 3, 0)`, 1)
  testEq(`L.transform(L.ifElse(R.not, L.setOp(1), L.setOp(0)), null)`, 1)
  testEq(`L.transform(L.ifElse(R.not, L.setOp(1), L.setOp(0)), 2)`, 0)
})

describe('L.iftes', () => {
  testEq(`L.set(L.iftes(R.not, L.setOp(1)), 3, 2)`, 2)
  testEq(`L.set(L.iftes(R.not, L.setOp(1)), 3, 0)`, 1)
  testEq(`L.transform(L.iftes(R.not, L.setOp(1), L.setOp(0)), null)`, 1)
  testEq(`L.transform(L.iftes(R.not, L.setOp(1), L.setOp(0)), 2)`, 0)
  testEq(
    `L.transform(L.iftes(R.equals(1), L.setOp(-1),
                         R.equals(2), L.setOp(1),
                         L.setOp(2)),
                 -1)`,
    2
  )
  testEq(
    `L.transform(L.iftes(R.equals(1), L.setOp(-1),
                         R.equals(2), L.setOp(1),
                         L.setOp(2)),
                 2)`,
    1
  )
})

describe('L.singleton', () => {
  testEq(`L.get(L.singleton, ["too", "long"])`, undefined)
  testEq(`L.get(L.singleton, "too-long")`, undefined)
  testEq(`L.get(L.singleton, "x")`, 'x')
  testEq(`L.get(L.singleton, [101])`, 101)
  testEq(`L.get(L.singleton, {})`, undefined)
  testEq(`L.getInverse(L.singleton)(43)`, [43])
  testEq(`L.getInverse(L.singleton, undefined)`, undefined)
})

describe('L.flatten', () => {
  testEq(`L.collect(L.flatten, 101)`, [101])
  testEq(`L.collect(L.flatten, [["x"], [1, [], {y: 2}], [[false]]])`, [
    'x',
    1,
    {y: 2},
    false
  ])
})

describe('L.leafs', () => {
  testEq(`L.collect(L.leafs, 101)`, [101])
  testEq(`L.collect(L.leafs, new XYZ(1, 2, 3))`, [new XYZ(1, 2, 3)])
  testEq(`L.collect(L.leafs, [["x"], [1, [], {y: 2}], [[false]]])`, [
    'x',
    1,
    2,
    false
  ])
})

describe('L.query', () => {
  testEq(
    `L.modify(
       L.query(L.choice('a', 'b')),
       R.inc,
       [
         {foo: [{a: 1}, {b: 2}]},
         {bar: {b: 3}},
         {a: 4}
       ]
     )`,
    [{foo: [{a: 2}, {b: 3}]}, {bar: {b: 4}}, {a: 5}]
  )
})

describe('L.satisfying', () => {
  testEq(`L.collect(L.satisfying(R.is(Number)), [3, '1', 4, {x: 1}])`, [
    3,
    4,
    1
  ])
})

describe('L.array', () => {
  testEq(`L.get(L.array(L.pick({x:"y", z:"x"})), [{x:1, y:2}, {x:3, y:4}])`, [
    {x: 2, z: 1},
    {x: 4, z: 3}
  ])
  testEq(
    `L.getInverse(L.array(L.pick({x:"y", z:"x"})),
                       [{x:2, z:1}, {x:4, z:3}])`,
    [{x: 1, y: 2}, {x: 3, y: 4}]
  )
  testEq(`L.get(L.array(L.pick({x:"y", z:"x"})), [])`, [])
  testEq(`L.get(L.array(L.pick({x:"y", z:"x"})), {})`, undefined)
  testEq(`L.set(L.array(L.pick({x:"y", z:"x"})), [], [{x:1, y:2}])`, [])
  testEq(`L.remove([L.array(L.iso(R.toUpper, R.toLower)), 0], ["it"])`, [])
  testEq(`L.remove([L.array(L.iso(R.toUpper, R.toLower))], ["it"])`, undefined)
  testEq(`L.get(L.array(L.iso(R.toUpper, R.toLower)), "string")`, [
    'S',
    'T',
    'R',
    'I',
    'N',
    'G'
  ])
})

describe('L.forEach', () => {
  testEq(
    `{ let xs=[]
     ; L.forEach((x, i) => xs.push([x, i]),
                 L.matches(/[ab]+/g),
                 "Diiba daaba!");
       return xs }`,
    [['ba', 3], ['aaba', 7]]
  )
  testEq(
    `{ let xs=[]
     ; L.forEach((x, i) => xs.push([x, i]),
                 L.elems,
                 ["a", "b"]);
       return xs }`,
    [['a', 0], ['b', 1]]
  )
  testEq(
    `{ let xs=[]
     ; L.forEach((x, i) => xs.push([x, i]),
                 L.values,
                 {x: 1, y: 2});
       return xs }`,
    [[1, 'x'], [2, 'y']]
  )
  testEq(
    `{ let xs=[]
     ; L.forEach((x, i) => xs.push([x, i]),
                 L.branch({y: [], x: L.elems}),
                 {x: ["a", "b", "c"], y: 4});
       return xs}`,
    [[4, 'y'], ['a', 0], ['b', 1], ['c', 2]]
  )
})

describe('L.forEachWith', () => {
  testEq(
    `L.forEachWith(
       () => ({}),
       (o, v, k) => o[R.toUpper(k)] = v,
       L.values,
       {x: 2, y: 1})`,
    {X: 2, Y: 1}
  )
})

describe('L.indexed', () => {
  testEq(`L.get(L.indexed, ["a", "b"])`, [[0, 'a'], [1, 'b']])
  testEq(`L.getInverse(L.indexed, [[0, "a"], [1, "b"]])`, ['a', 'b'])
  testEq(`L.set(L.indexed, [], ["a", "b"])`, [])
  testEq(`L.remove(L.indexed, ["a", "b"])`, undefined)
  testEq(`L.set([L.indexed, 2], [0, "c"], ["a", "b"])`, ['c', 'b'])
  testEq(`L.set([L.indexed, 2], [3, "c"], ["a", "b"])`, ['a', 'b', 'c'])
  testEq(`L.remove([L.indexed, 1, 0], ["a", "b"])`, ['a'])
  testEq(`L.remove([L.indexed, 0, 1], ["a", "b"])`, ['b'])
  testEq(`L.getInverse(L.indexed, null)`, undefined)
})

describe('L.keyed', () => {
  testEq(`L.get(L.keyed, {x: 4, y: 2})`, [['x', 4], ['y', 2]])
  testEq(`L.getInverse(L.keyed, [["x", 4], ["y", 2]])`, {x: 4, y: 2})
  testEq(`L.set(L.keyed, {}, {x: 4, y: 2})`, undefined)
  testEq(`L.set(L.keyed, [], {x: 4, y: 2})`, {})
  testEq(`L.set(L.keyed, undefined, {x: 4, y: 2})`, undefined)
  testEq(`L.set([L.keyed, 2], ["z", 6], {x: 4, y: 2})`, {x: 4, y: 2, z: 6})
  testEq(`L.remove([L.keyed, 1, 0], {x: 4, y: 2})`, {x: 4})
  testEq(`L.remove([L.keyed, 0, 1], {x: 4, y: 2})`, {y: 2})
  testEq(`L.getInverse(L.keyed, null)`, undefined)
})

describe('L.entries', () => {
  testEq(`L.modify(L.entries, (kv) => [kv[1], kv[0]], {x: "a", y: "b"})`, {
    a: 'x',
    b: 'y'
  })
  testEq(`L.remove([L.entries, 1, L.when(x => x === "a")], {x: "a", y: "b"})`, {
    y: 'b'
  })
})

describe('L.keys', () => {
  testEq(`L.modify(L.keys, R.toUpper, {x: 6, y: 9})`, {X: 6, Y: 9})
  testEq(`L.remove([L.keys, L.when(x => x > "b")], {a: 1, c: 3, b: 2})`, {
    a: 1,
    b: 2
  })
})

describe('L.reverse', () => {
  testEq(`L.get(L.reverse, 42)`, undefined)
  testEq(`L.set(L.reverse, undefined, 42)`, undefined)
  testEq(`L.modify([L.reverse, L.elems], (x, i) => [x, i], [3,1,4])`, [
    [3, 2],
    [1, 1],
    [4, 0]
  ])
  testEq(`L.getInverse(L.reverse, null)`, undefined)
})

describe('L.pointer', () => {
  testEq(`L.get(L.pointer('/f1'), {f1: 101})`, 101)

  testEq(`L.get(L.pointer(""), {a: 1, b: 2})`, {a: 1, b: 2})
  testEq(`L.get(L.pointer("/"), {"": 1, b: 2})`, 1)
  testEq(`L.get(L.pointer("/ "), {" ": 1})`, 1)
  testEq(`L.get(L.pointer("/0"), {"0": 1})`, 1)
  testEq(
    `L.get(L.pointer("/a~1bc%de^fg|hi\\\\jk\\"lm~0n"),
           {"a/bc%de^fg|hi\\\\jk\\"lm~n": [1,2]})`,
    [1, 2]
  )
  testEq(
    `L.get(L.pointer("/a~1bc%de^fg|hi\\\\jk\\"lm~0n/0"),
           {"a/bc%de^fg|hi\\\\jk\\"lm~n": [1,2]})`,
    1
  )
  testEq(`L.set(L.pointer("/b/0"), 3, {a: 1, b: [2,3]})`, {a: 1, b: [3, 3]})
  testEq(`L.remove(L.pointer("/b/0"), {a: 1, b: [2,3]})`, {a: 1, b: [3]})
  testEq(`L.modify(L.pointer("/b/0"), R.inc, {a: 1, b: [2,3]})`, {
    a: 1,
    b: [3, 3]
  })

  testEq(`L.get(L.pointer("#"), {a: 1, b: 2})`, {a: 1, b: 2})
  testEq(`L.get(L.pointer("#/"), {"": 1, b: 2})`, 1)
  testEq(`L.get(L.pointer("#/%20"), {" ": 1})`, 1)
  testEq(`L.get(L.pointer("#/0"), {"0": 1})`, 1)
  testEq(
    `L.get(L.pointer("#/a~1bc%25de^fg%7Chi%5Cjk%22lm~0n"),
           {"a/bc%de^fg|hi\\\\jk\\"lm~n": [1,2]})`,
    [1, 2]
  )
  testEq(
    `L.get(L.pointer("#/a~1bc%25de^fg%7Chi%5Cjk%22lm~0n/0"),
           {"a/bc%de^fg|hi\\\\jk\\"lm~n": [1,2]})`,
    1
  )
  testEq(`L.set(L.pointer("#/b/0"), 3, {a: 1, b: [2,3]})`, {a: 1, b: [3, 3]})
  testEq(`L.remove(L.pointer("#/b/0"), {a: 1, b: [2,3]})`, {a: 1, b: [3]})
  testEq(`L.modify(L.pointer("#/b/0"), R.inc, {a: 1, b: [2,3]})`, {
    a: 1,
    b: [3, 3]
  })
})

describe('L.flat', () => {
  testEq(
    `L.modify(
      L.flat(
        'a',
        'b',
        'c'
      ),
      R.negate,
      [{a: [[{b: {c: 1}}], [{b: [{c: 2}]}]]}, {a: {b: {c: [[[3]]]}}}]
    )`,
    [{a: [[{b: {c: -1}}], [{b: [{c: -2}]}]]}, {a: {b: {c: [[[-3]]]}}}]
  )
})

describe('L.modifyAsync', () => {
  testEq(`L.modifyAsync(L.elems, x => later(10, -x), [3, 1, 4])`, [-3, -1, -4])
})

if (process.env.NODE_ENV !== 'production') {
  describe('debug', () => {
    testThrows(`X.set(-1, 0, 0)`)

    testThrows(`X.index("x")`)
    testThrows(`X.index(-1)`)
    testThrows(`X.index()`)

    testThrows(`X.prop(2)`)
    testThrows(`X.prop(x => x)`)
    testThrows(`X.prop()`)

    testThrows(`L.get(L.elems, [])`)
    testThrows(`L.get(L.values, {})`)
    testThrows(`L.get(L.branch({a: []}), {})`)
    testThrows(`L.get(L.matches(/a/g), "foo")`)

    testThrows(`L.set(L.props("length"), "lol", undefined)`)
    testThrows(`L.set(L.slice(undefined, undefined), 11, [])`)
    testThrows(`L.pick(new XYZ(1,2,3))`)
    testThrows(`L.set(L.filter(undefined, undefined), {x: 11}, [])`)

    testThrows(`L.set(null, 1, 2)`)

    testThrows(`L.toFunction((one, too, many) => 1)`)

    testThrows(`L.get(L.seq(0), ["x"])`)

    testThrows(`L.branch(new XYZ(L.identity, L.identity, L.identity))`)

    testThrows(`L.toFunction(-1)`)

    testThrows(`L.joinAs(I.id, 0)`)

    testThrows(`L.cond([])`)
  })

  describe('diagnostics', () => {
    testEq(`L.set(L.required([]), [], undefined)`, [])
    testEq(`L.get(L.define([]), [])`, [])
    testEq(`L.set(L.define([]), [], [])`, [])
  })
}
