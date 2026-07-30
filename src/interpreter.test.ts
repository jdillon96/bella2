import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  arrayLiteral,
  assignStmt,
  binaryExp,
  block,
  booleanLiteral,
  conditionalExp,
  functionCall,
  functionDecl,
  identifier,
  numeral,
  printStmt,
  program,
  subscriptExp,
  unaryExp,
  varDecl,
  whileStmt,
} from "./core.ts";
import {
  Block,
  Numeral,
  PrintStatement,
  Program,
  UserFunction,
  interpret,
  standardLibrary,
} from "./interpreter.ts";
import type { Expression, Statement, Value } from "./interpreter.ts";

/** Runs a program made of the given statements and returns everything printed. */
function run(...statements: Statement[]): Value[] {
  return interpret(program(block(statements)));
}

/** Evaluates a single expression by printing it and reading back the output. */
function value(expression: Expression): Value {
  return run(printStmt(expression))[0]!;
}

/** Asserts that running the given statements fails with exactly `message`. */
function fails(statements: Statement[], message: string): void {
  assert.throws(() => run(...statements), { message });
}

/** Asserts that evaluating a single expression fails with exactly `message`. */
function failsToEvaluate(expression: Expression, message: string): void {
  fails([printStmt(expression)], message);
}

/** An identifier that is guaranteed not to be in memory. */
const undeclared = identifier("nope");

describe("literals", () => {
  it("interprets a numeral", () => {
    assert.equal(value(numeral(5)), 5);
  });

  it("interprets true", () => {
    assert.equal(value(booleanLiteral(true)), true);
  });

  it("interprets false", () => {
    assert.equal(value(booleanLiteral(false)), false);
  });

  it("interprets an empty array literal", () => {
    assert.deepEqual(value(arrayLiteral([])), []);
  });

  it("interprets a populated array literal", () => {
    assert.deepEqual(
      value(arrayLiteral([numeral(1), numeral(2), booleanLiteral(true)])),
      [1, 2, true]
    );
  });
});

describe("identifiers", () => {
  it("reads a standard library constant", () => {
    assert.equal(value(identifier("pi")), Math.PI);
  });

  it("reads a declared variable", () => {
    assert.deepEqual(run(varDecl("x", numeral(3)), printStmt(identifier("x"))), [3]);
  });

  it("rejects an undeclared identifier", () => {
    failsToEvaluate(undeclared, "Identifier nope was undeclared");
  });
});

describe("unary operators", () => {
  it("negates a number", () => {
    assert.equal(value(unaryExp("-", numeral(8))), -8);
  });

  it("complements a boolean", () => {
    assert.equal(value(unaryExp("!", booleanLiteral(true))), false);
  });

  it("rejects negation of a non-number", () => {
    failsToEvaluate(unaryExp("-", booleanLiteral(true)), "Expected a number");
  });

  it("rejects complement of a non-boolean", () => {
    failsToEvaluate(unaryExp("!", numeral(1)), "Expected a boolean");
  });

  it("rejects an unknown operator", () => {
    failsToEvaluate(unaryExp("~", numeral(1)), "Unknown unary operator ~");
  });
});

describe("arithmetic operators", () => {
  const cases: [string, number, number, number][] = [
    ["+", 3, 4, 7],
    ["-", 3, 4, -1],
    ["*", 3, 4, 12],
    ["/", 3, 4, 0.75],
    ["%", 7, 4, 3],
    ["**", 3, 4, 81],
  ];

  for (const [operator, left, right, expected] of cases) {
    it(`interprets ${left} ${operator} ${right}`, () => {
      assert.equal(value(binaryExp(numeral(left), operator, numeral(right))), expected);
    });
  }

  it("rejects a non-numeric left operand", () => {
    failsToEvaluate(
      binaryExp(booleanLiteral(true), "+", numeral(1)),
      "Expected a number"
    );
  });

  it("rejects a non-numeric right operand", () => {
    failsToEvaluate(
      binaryExp(numeral(1), "+", booleanLiteral(true)),
      "Expected a number"
    );
  });

  it("rejects an unknown operator", () => {
    failsToEvaluate(
      binaryExp(numeral(1), "<>", numeral(2)),
      "Unknown binary operator <>"
    );
  });
});

describe("relational operators", () => {
  const cases: [string, number, number, boolean][] = [
    ["<", 1, 2, true],
    ["<", 2, 1, false],
    ["<=", 2, 2, true],
    ["<=", 3, 2, false],
    [">=", 2, 2, true],
    [">=", 1, 2, false],
    [">", 2, 1, true],
    [">", 1, 2, false],
  ];

  for (const [operator, left, right, expected] of cases) {
    it(`interprets ${left} ${operator} ${right}`, () => {
      assert.equal(value(binaryExp(numeral(left), operator, numeral(right))), expected);
    });
  }

  it("rejects a non-numeric operand", () => {
    failsToEvaluate(
      binaryExp(booleanLiteral(true), "<", numeral(1)),
      "Expected a number"
    );
  });
});

describe("equality operators", () => {
  it("compares equal numbers", () => {
    assert.equal(value(binaryExp(numeral(2), "==", numeral(2))), true);
  });

  it("compares unequal numbers", () => {
    assert.equal(value(binaryExp(numeral(2), "!=", numeral(3))), true);
  });

  it("compares booleans", () => {
    assert.equal(
      value(binaryExp(booleanLiteral(true), "==", booleanLiteral(false))),
      false
    );
  });

  it("rejects comparison of two arrays", () => {
    failsToEvaluate(
      binaryExp(arrayLiteral([]), "==", arrayLiteral([])),
      "Equality requires two numbers or two booleans"
    );
  });

  it("rejects comparison of mixed primitive types", () => {
    failsToEvaluate(
      binaryExp(numeral(1), "!=", booleanLiteral(true)),
      "Equality requires two numbers or two booleans"
    );
  });
});

describe("logical operators", () => {
  it("interprets a conjunction of two truths", () => {
    assert.equal(
      value(binaryExp(booleanLiteral(true), "&&", booleanLiteral(true))),
      true
    );
  });

  it("short circuits a false conjunction", () => {
    // The right operand would throw if it were interpreted.
    assert.equal(value(binaryExp(booleanLiteral(false), "&&", undeclared)), false);
  });

  it("interprets a disjunction of two falsehoods", () => {
    assert.equal(
      value(binaryExp(booleanLiteral(false), "||", booleanLiteral(false))),
      false
    );
  });

  it("short circuits a true disjunction", () => {
    assert.equal(value(binaryExp(booleanLiteral(true), "||", undeclared)), true);
  });

  it("rejects a non-boolean left operand of a conjunction", () => {
    failsToEvaluate(
      binaryExp(numeral(1), "&&", booleanLiteral(true)),
      "Expected a boolean"
    );
  });

  it("rejects a non-boolean right operand of a conjunction", () => {
    failsToEvaluate(
      binaryExp(booleanLiteral(true), "&&", numeral(1)),
      "Expected a boolean"
    );
  });

  it("rejects a non-boolean left operand of a disjunction", () => {
    failsToEvaluate(
      binaryExp(numeral(1), "||", booleanLiteral(true)),
      "Expected a boolean"
    );
  });

  it("rejects a non-boolean right operand of a disjunction", () => {
    failsToEvaluate(
      binaryExp(booleanLiteral(false), "||", numeral(1)),
      "Expected a boolean"
    );
  });
});

describe("conditional expressions", () => {
  it("selects the consequent", () => {
    // The alternate would throw if it were interpreted.
    assert.equal(
      value(conditionalExp(booleanLiteral(true), numeral(1), undeclared)),
      1
    );
  });

  it("selects the alternate", () => {
    assert.equal(
      value(conditionalExp(booleanLiteral(false), undeclared, numeral(2))),
      2
    );
  });

  it("rejects a non-boolean test", () => {
    failsToEvaluate(
      conditionalExp(numeral(1), numeral(1), numeral(2)),
      "Expected a boolean"
    );
  });
});

describe("subscript expressions", () => {
  const array = arrayLiteral([numeral(10), numeral(20), numeral(30)]);

  it("reads an element", () => {
    assert.equal(value(subscriptExp(array, numeral(1))), 20);
  });

  it("rejects subscripting a non-array", () => {
    failsToEvaluate(
      subscriptExp(numeral(1), numeral(0)),
      "Subscripted value is not an array"
    );
  });

  it("rejects subscripting a function", () => {
    fails(
      [
        functionDecl("f", [], numeral(1)),
        printStmt(subscriptExp(identifier("f"), numeral(0))),
      ],
      "Subscripted value is not an array"
    );
  });

  it("rejects a non-numeric subscript", () => {
    failsToEvaluate(subscriptExp(array, booleanLiteral(true)), "Expected a number");
  });

  it("rejects a non-integer subscript", () => {
    failsToEvaluate(subscriptExp(array, numeral(1.5)), "Array index out of bounds");
  });

  it("rejects a negative subscript", () => {
    failsToEvaluate(subscriptExp(array, numeral(-1)), "Array index out of bounds");
  });

  it("rejects a subscript past the end", () => {
    failsToEvaluate(subscriptExp(array, numeral(3)), "Array index out of bounds");
  });
});

describe("the standard library", () => {
  it("exposes pi", () => {
    assert.equal(standardLibrary.get("pi"), Math.PI);
  });

  it("applies a one-argument function", () => {
    assert.equal(value(functionCall("sqrt", [numeral(16)])), 4);
  });

  it("applies a two-argument function", () => {
    assert.equal(value(functionCall("hypot", [numeral(3), numeral(4)])), 5);
  });

  for (const name of ["sin", "cos", "ln", "exp"]) {
    it(`applies ${name}`, () => {
      assert.equal(typeof value(functionCall(name, [numeral(1)])), "number");
    });
  }

  it("rejects the wrong number of arguments", () => {
    failsToEvaluate(
      functionCall("sqrt", [numeral(1), numeral(2)]),
      "Wrong number of arguments"
    );
  });

  it("rejects a non-numeric argument", () => {
    failsToEvaluate(functionCall("sqrt", [booleanLiteral(true)]), "Expected a number");
  });
});

describe("calls", () => {
  it("applies a user function", () => {
    assert.deepEqual(
      run(
        functionDecl("double", ["x"], binaryExp(identifier("x"), "*", numeral(2))),
        printStmt(functionCall("double", [numeral(21)]))
      ),
      [42]
    );
  });

  it("applies a recursive user function", () => {
    assert.deepEqual(
      run(
        functionDecl(
          "fact",
          ["n"],
          conditionalExp(
            binaryExp(identifier("n"), "<=", numeral(1)),
            numeral(1),
            binaryExp(
              identifier("n"),
              "*",
              functionCall("fact", [binaryExp(identifier("n"), "-", numeral(1))])
            )
          )
        ),
        printStmt(functionCall("fact", [numeral(5)]))
      ),
      [120]
    );
  });

  it("sees variables declared before the call", () => {
    assert.deepEqual(
      run(
        functionDecl(
          "addBase",
          ["x"],
          binaryExp(identifier("x"), "+", identifier("base"))
        ),
        varDecl("base", numeral(100)),
        printStmt(functionCall("addBase", [numeral(1)]))
      ),
      [101]
    );
  });

  it("rejects the wrong number of arguments", () => {
    fails(
      [
        functionDecl("double", ["x"], identifier("x")),
        printStmt(functionCall("double", [])),
      ],
      "Wrong number of arguments"
    );
  });

  it("rejects calling an undeclared identifier", () => {
    failsToEvaluate(functionCall("nope", []), "Identifier nope was undeclared");
  });

  it("rejects calling a non-function", () => {
    fails(
      [varDecl("x", numeral(1)), printStmt(functionCall("x", []))],
      "Not a function"
    );
  });
});

describe("variable declarations", () => {
  it("binds a name", () => {
    assert.deepEqual(run(varDecl("x", numeral(1)), printStmt(identifier("x"))), [1]);
  });

  it("rejects redeclaration", () => {
    fails(
      [varDecl("x", numeral(1)), varDecl("x", numeral(2))],
      "Identifier x already declared"
    );
  });

  it("rejects shadowing the standard library", () => {
    fails([varDecl("pi", numeral(3))], "Identifier pi already declared");
  });
});

describe("function declarations", () => {
  it("binds a user function", () => {
    assert.deepEqual(
      run(functionDecl("one", [], numeral(1)), printStmt(functionCall("one", []))),
      [1]
    );
  });

  it("rejects redeclaration", () => {
    fails(
      [functionDecl("f", [], numeral(1)), functionDecl("f", [], numeral(2))],
      "Identifier f already declared"
    );
  });
});

describe("assignment", () => {
  it("rebinds a declared variable", () => {
    assert.deepEqual(
      run(
        varDecl("x", numeral(1)),
        assignStmt("x", numeral(2)),
        printStmt(identifier("x"))
      ),
      [2]
    );
  });

  it("rejects assignment to an undeclared identifier", () => {
    fails([assignStmt("x", numeral(1))], "Identifier x was undeclared");
  });

  it("rejects assignment to a user function", () => {
    fails(
      [functionDecl("f", [], numeral(1)), assignStmt("f", numeral(2))],
      "Cannot assign to a function"
    );
  });

  it("rejects assignment to a standard library function", () => {
    fails([assignStmt("sqrt", numeral(2))], "Cannot assign to a function");
  });
});

describe("print statements", () => {
  it("appends to the output in order", () => {
    assert.deepEqual(run(printStmt(numeral(1)), printStmt(numeral(2))), [1, 2]);
  });
});

describe("while statements", () => {
  it("does not run a body whose test is false", () => {
    assert.deepEqual(
      run(whileStmt(booleanLiteral(false), block([printStmt(numeral(1))]))),
      []
    );
  });

  it("iterates until the test fails", () => {
    assert.deepEqual(
      run(
        varDecl("i", numeral(0)),
        whileStmt(
          binaryExp(identifier("i"), "<", numeral(3)),
          block([
            printStmt(identifier("i")),
            assignStmt("i", binaryExp(identifier("i"), "+", numeral(1))),
          ])
        )
      ),
      [0, 1, 2]
    );
  });

  it("gives the body a fresh scope on each iteration", () => {
    // Declaring inside the body would fail as already declared on the second
    // iteration if the body's bindings survived.
    assert.deepEqual(
      run(
        varDecl("i", numeral(0)),
        whileStmt(
          binaryExp(identifier("i"), "<", numeral(2)),
          block([
            varDecl("doubled", binaryExp(identifier("i"), "*", numeral(2))),
            printStmt(identifier("doubled")),
            assignStmt("i", binaryExp(identifier("i"), "+", numeral(1))),
          ])
        )
      ),
      [0, 2]
    );
  });

  it("does not leak the body's declarations after the loop", () => {
    fails(
      [
        varDecl("i", numeral(0)),
        whileStmt(
          binaryExp(identifier("i"), "<", numeral(1)),
          block([varDecl("inner", numeral(9)), assignStmt("i", numeral(1))])
        ),
        printStmt(identifier("inner")),
      ],
      "Identifier inner was undeclared"
    );
  });

  it("rejects a non-boolean test", () => {
    fails([whileStmt(numeral(1), block([]))], "Expected a boolean");
  });
});

describe("programs", () => {
  it("interprets the empty program", () => {
    assert.deepEqual(run(), []);
  });

  it("interprets the sample from the assignment", () => {
    const sample: Program = new Program(
      new Block([new PrintStatement(new Numeral(5))])
    );
    assert.deepEqual(interpret(sample), [5]);
  });

  it("starts each run from a fresh standard library", () => {
    run(varDecl("x", numeral(1)));
    assert.deepEqual(run(printStmt(identifier("pi"))), [Math.PI]);
  });
});

describe("user functions", () => {
  it("are distinguishable from arrays of the same shape", () => {
    // A two element array whose first element is an array has the shape of the
    // tuple representation of a function, but must not be callable.
    fails(
      [
        varDecl("x", arrayLiteral([arrayLiteral([numeral(1)]), numeral(2)])),
        printStmt(functionCall("x", [numeral(1)])),
      ],
      "Not a function"
    );
  });

  it("carry their parameters and body", () => {
    const body = numeral(1);
    const fun = new UserFunction([identifier("x")], body);
    assert.deepEqual(
      fun.parameters.map((p) => p.name),
      ["x"]
    );
    assert.equal(fun.expression, body);
  });
});
