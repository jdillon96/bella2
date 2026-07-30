# bella2

An interpreter for **Bella 2**, written for CMSI 585 (Programming Language
Foundations), Homework #2, Problem 3.

Bella 2 is strongly typed and dynamically typed: operands are never coerced, and
a type mismatch is a runtime error rather than a silent conversion.

## Running it

```sh
npm install
```

| Command | Description |
| --- | --- |
| `npm test` | Run the test suite |
| `npm run coverage` | Run the suite and enforce 100% line, branch, and function coverage |
| `npm run test:watch` | Re-run tests on change |
| `npm run check` | Typecheck with `tsc --noEmit` |

There is no build step. Node runs the TypeScript sources directly through its
experimental type transformation (`--experimental-transform-types`), and the
tests use Node's built-in `node:test` runner and `node:assert`. No third-party
runtime or test dependencies are involved.

## Layout

| File | Contents |
| --- | --- |
| [src/interpreter.ts](src/interpreter.ts) | Abstract syntax node classes, each with its own `interpret` method, plus the standard library |
| [src/core.ts](src/core.ts) | Factory functions for building a structured program representation, one per production of the grammar |
| [src/interpreter.test.ts](src/interpreter.test.ts) | Behavioral tests for every node and every error path |
| [src/core.test.ts](src/core.test.ts) | Tests that each factory builds the node it claims to |

Interpretation is purely functional. An expression is interpreted against a
memory and yields a value; a statement is interpreted against a `[memory,
output]` state pair and yields a new state. Nothing is mutated in place, so the
implementation lines up directly with the denotational semantics from Problems 1
and 2.

## Writing a program

There is no parser, as the assignment allows. Programs are built directly as
abstract syntax. The factories in `core.ts` exist so this reads like the grammar:

```ts
import {
  assignStmt, binaryExp, block, identifier, numeral, printStmt, program, varDecl, whileStmt,
} from "./src/core.ts";
import { interpret } from "./src/interpreter.ts";

// let i = 0; while i < 3 { print i; i = i + 1; }
const counter = program(
  block([
    varDecl("i", numeral(0)),
    whileStmt(
      binaryExp(identifier("i"), "<", numeral(3)),
      block([
        printStmt(identifier("i")),
        assignStmt("i", binaryExp(identifier("i"), "+", numeral(1))),
      ])
    ),
  ])
);

interpret(counter); // [0, 1, 2]
```

`interpret` returns the program's output as an array of values rather than
writing to the console, which is what makes the whole language testable.

## Semantic decisions

The abstract syntax in the assignment leaves a few things open. These are the
choices this implementation makes.

- **Logical operators short circuit.** `&&` does not interpret its right operand
  when the left is false, and `||` does not when the left is true. Both operands
  must still be booleans wherever they are interpreted.
- **Conditional expressions interpret only the selected arm**, as expected.
- **Equality is defined only on the primitive domains.** `==` and `!=` require
  two numbers or two booleans. Comparing arrays or functions is an error, so
  equality never quietly degrades into reference identity.
- **A `while` body is a scope.** Assignments to variables that already existed
  survive an iteration, but declarations made inside the body do not. Without
  this, a `let` in a loop body would fail as already declared on the second
  iteration.
- **Declarations do not shadow.** Declaring a name that is already bound,
  including a standard library name such as `pi`, is an error.
- **Functions cannot be assigned to.** A name bound by `func`, or a standard
  library function, cannot be rebound by an assignment statement.
- **Subscripts must be integers in range.** A non-integer, negative, or
  out-of-range index is an error rather than a silent `undefined`.
- **Standard library functions check their arguments.** `sqrt(true)` is a type
  error, and `sqrt(1, 2)` is an arity error, rather than returning `NaN` as the
  host `Math` functions would.
- **Arithmetic otherwise follows IEEE 754**, so `1 / 0` is infinity.
- **Function bodies see the memory at the call site.** This is the scoping rule
  in the provided skeleton and is preserved. It makes recursion work without a
  separate fixed-point construction, and it means a function may refer to a
  variable declared after the function itself, as long as the declaration
  precedes the call.

## Deviation from the provided skeleton

The skeleton represents a user function as the tuple
`type UserFunction = [Identifier[], Expression]`. That representation is
ambiguous: the ordinary Bella array `[[1, 2], 3]` is an array of length two whose
first element is an array, so `isUserFunction` reports true for it and a plain
array becomes callable.

`UserFunction` is therefore a class here, which makes the guard
`v instanceof UserFunction` exact and lets `isArray` distinguish arrays from
functions correctly. `Call` is otherwise unchanged apart from destructuring the
class instead of the tuple. A test covers the ambiguous case.

Error messages also name the identifier at fault, for example
`Identifier x was undeclared` rather than `Identifier was undeclared`.

## Coverage

`npm run coverage` reports 100% of lines, branches, and functions across both
source files, and fails the run if any of the three drops below 100%.
